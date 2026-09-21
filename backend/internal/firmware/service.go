package firmware

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/sha256"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	mycrypto "github.com/ota-robot/api/internal/crypto"
	db "github.com/ota-robot/api/internal/db/generated"
)

const (
	MaxFirmwareSize = 100 * 1024 * 1024 // 100 MB
	MinFirmwareSize = 4                  // Minimum binary header
)

// ReleaseServiceImpl implements the Service interface.
type ReleaseServiceImpl struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	minio   *minio.Client
	bucket  string
	privKey *ecdsa.PrivateKey
	pubKey  *ecdsa.PublicKey
}

// NewService creates a new firmware ReleaseService.
func NewService(pool *pgxpool.Pool, mc *minio.Client, bucket string) (*ReleaseServiceImpl, error) {
	privPath := os.Getenv("ECDSA_PRIVATE_KEY_PATH")
	if privPath == "" {
		privPath = "./keys/private.pem"
	}
	pubPath := os.Getenv("ECDSA_PUBLIC_KEY_PATH")
	if pubPath == "" {
		pubPath = "./keys/public.pem"
	}

	priv, pub, err := mycrypto.EnsureKeypair(privPath, pubPath)
	if err != nil {
		return nil, fmt.Errorf("initialize firmware signing keypair: %w", err)
	}

	s := &ReleaseServiceImpl{
		pool:    pool,
		queries: db.New(pool),
		minio:   mc,
		bucket:  bucket,
		privKey: priv,
		pubKey:  pub,
	}

	s.backfillSignatures(context.Background())
	return s, nil
}

// Release coordinates validation, signing, storage, and persistence with atomic compensation.
func (s *ReleaseServiceImpl) Release(ctx context.Context, params ReleaseParams) (*db.FirmwareVersion, error) {
	version := strings.TrimSpace(params.Version)
	if version == "" {
		return nil, errors.New("version is required")
	}

	filename := filepath.Base(params.Filename)
	if filename == "" || filename == "." {
		filename = "firmware.bin"
	}

	size := len(params.Data)
	if size < MinFirmwareSize {
		return nil, fmt.Errorf("firmware file too small: must be at least %d bytes", MinFirmwareSize)
	}
	if size > MaxFirmwareSize {
		return nil, fmt.Errorf("firmware file exceeds maximum limit of %d bytes", MaxFirmwareSize)
	}

	// 1. Invariant Check: Check uniqueness in database BEFORE uploading to storage
	_, err := s.queries.GetFirmwareVersionByVersion(ctx, version)
	if err == nil {
		return nil, fmt.Errorf("firmware version %s already exists", version)
	}

	// 2. Digest & Digital Signature
	checksum := fmt.Sprintf("%x", sha256.Sum256(params.Data))
	if s.privKey == nil {
		return nil, errors.New("firmware signing key unavailable")
	}
	sigStr, err := mycrypto.SignSHA256(s.privKey, checksum)
	if err != nil {
		return nil, fmt.Errorf("sign firmware: %w", err)
	}
	log.Printf("[firmware] signed firmware v%s with ECDSA P-256", version)

	// 3. Storage Upload
	storageKey := fmt.Sprintf("firmware/%s/%s", version, filename)
	_, err = s.minio.PutObject(
		ctx,
		s.bucket,
		storageKey,
		bytes.NewReader(params.Data),
		int64(size),
		minio.PutObjectOptions{ContentType: "application/octet-stream"},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to upload firmware to storage: %w", err)
	}

	// 4. Persistence with Compensating Cleanup
	fw, err := s.queries.CreateFirmwareVersion(ctx, db.CreateFirmwareVersionParams{
		Version:        version,
		StorageKey:     storageKey,
		FileSize:       int64(size),
		Sha256Checksum: checksum,
		EcdsaSignature: pgtype.Text{String: sigStr, Valid: sigStr != ""},
		ReleaseNotes:   pgtype.Text{String: params.ReleaseNotes, Valid: params.ReleaseNotes != ""},
		UploadedBy:     pgtype.Text{String: "operator", Valid: true},
	})
	if err != nil {
		// Compensating action: remove uploaded object to prevent orphans
		log.Printf("[firmware] database insert failed, removing orphaned storage object: %s", storageKey)
		_ = s.minio.RemoveObject(ctx, s.bucket, storageKey, minio.RemoveObjectOptions{})
		return nil, fmt.Errorf("failed to record firmware in database: %w", err)
	}

	return &fw, nil
}

// GetDownloadURL generates a secure time-limited presigned URL for downloading the binary.
func (s *ReleaseServiceImpl) GetDownloadURL(ctx context.Context, id pgtype.UUID, expiry time.Duration) (*DownloadDetails, error) {
	fw, err := s.queries.GetFirmwareVersion(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("firmware version not found: %w", err)
	}

	presignedURL, err := s.minio.PresignedGetObject(ctx, s.bucket, fw.StorageKey, expiry, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to generate download URL: %w", err)
	}

	return &DownloadDetails{
		URL:       presignedURL.String(),
		Checksum:  fw.Sha256Checksum,
		Signature: fw.EcdsaSignature.String,
	}, nil
}

// List returns all firmware versions.
func (s *ReleaseServiceImpl) List(ctx context.Context) ([]db.FirmwareVersion, error) {
	return s.queries.ListFirmwareVersions(ctx)
}

// Delete removes firmware records and their backing storage objects.
func (s *ReleaseServiceImpl) Delete(ctx context.Context, id pgtype.UUID) error {
	fw, err := s.queries.GetFirmwareVersion(ctx, id)
	if err != nil {
		return fmt.Errorf("firmware not found: %w", err)
	}

	// Delete from storage
	_ = s.minio.RemoveObject(ctx, s.bucket, fw.StorageKey, minio.RemoveObjectOptions{})

	// Delete from database
	_, err = s.pool.Exec(ctx, "DELETE FROM firmware_versions WHERE id = $1", id)
	return err
}

// Update modifies release notes and active status.
func (s *ReleaseServiceImpl) Update(ctx context.Context, id pgtype.UUID, notes, status string) (*db.FirmwareVersion, error) {
	fw, err := s.queries.GetFirmwareVersion(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("firmware not found: %w", err)
	}

	var isActive bool
	if status == "active" {
		isActive = true
	} else if status == "deprecated" {
		isActive = false
	} else {
		isActive = fw.IsActive
	}

	if notes == "" && fw.ReleaseNotes.Valid {
		notes = fw.ReleaseNotes.String
	}

	query := `UPDATE firmware_versions SET release_notes = $1, is_active = $2 WHERE id = $3 RETURNING id, version, storage_key, file_size, sha256_checksum, ecdsa_signature, release_notes, is_active, created_at`
	var updated db.FirmwareVersion
	err = s.pool.QueryRow(ctx, query, notes, isActive, id).Scan(
		&updated.ID, &updated.Version, &updated.StorageKey, &updated.FileSize,
		&updated.Sha256Checksum, &updated.EcdsaSignature, &updated.ReleaseNotes,
		&updated.IsActive, &updated.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update firmware: %w", err)
	}

	return &updated, nil
}

// ResignAll resigns any firmware version that lacks an ECDSA signature.
func (s *ReleaseServiceImpl) ResignAll(ctx context.Context) (int, error) {
	if s.privKey == nil {
		return 0, errors.New("private key not available for signing")
	}

	fws, err := s.queries.ListFirmwareVersions(ctx)
	if err != nil {
		return 0, err
	}

	signedCount := 0
	for _, fw := range fws {
		if !fw.EcdsaSignature.Valid || fw.EcdsaSignature.String == "" {
			sigStr, err := mycrypto.SignSHA256(s.privKey, fw.Sha256Checksum)
			if err != nil {
				continue
			}
			_, _ = s.pool.Exec(ctx, "UPDATE firmware_versions SET ecdsa_signature = $1 WHERE id = $2", sigStr, fw.ID)
			signedCount++
		}
	}
	return signedCount, nil
}

// GetSigningKeys returns the loaded private and public key pair.
func (s *ReleaseServiceImpl) GetSigningKeys() (*ecdsa.PrivateKey, *ecdsa.PublicKey) {
	return s.privKey, s.pubKey
}

func (s *ReleaseServiceImpl) backfillSignatures(ctx context.Context) {
	if s.privKey == nil {
		return
	}
	go func() {
		_, _ = s.ResignAll(context.Background())
	}()
}
