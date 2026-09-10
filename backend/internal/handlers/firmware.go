package handlers

import (
    "bytes"
    "context"
    "crypto/ecdsa"
    "crypto/sha256"
    "errors"
    "fmt"
    "io"
    "log"
    "os"
    "strings"
    "time"
    
    "github.com/gofiber/fiber/v3"
    "github.com/google/uuid"
    "github.com/jackc/pgx/v5/pgtype"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/minio/minio-go/v7"
    mycrypto "github.com/ota-robot/api/internal/crypto"
    db "github.com/ota-robot/api/internal/db/generated"
)

type FirmwareHandler struct {
    db      *pgxpool.Pool
    queries *db.Queries
    minio   *minio.Client
    bucket  string
    privKey *ecdsa.PrivateKey
    pubKey  *ecdsa.PublicKey
}

func NewFirmwareHandler(pool *pgxpool.Pool, mc *minio.Client, bucket string) *FirmwareHandler {
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
        log.Printf("Warning: failed to load ECDSA keypair: %v", err)
    }

    h := &FirmwareHandler{
        db:      pool,
        queries: db.New(pool),
        minio:   mc,
        bucket:  bucket,
        privKey: priv,
        pubKey:  pub,
    }
    h.backfillSignatures(context.Background())
    return h
}

func (h *FirmwareHandler) Upload(c fiber.Ctx) error {
    file, err := c.FormFile("file")
    if err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "file is required"})
    }
    version := c.FormValue("version")
    if version == "" {
        return c.Status(400).JSON(fiber.Map{"error": "version is required"})
    }
    releaseNotes := c.FormValue("release_notes", "")

    src, err := file.Open()
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "cannot open file"})
    }
    defer src.Close()

    data, err := io.ReadAll(src)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "cannot read file"})
    }
    checksum := fmt.Sprintf("%x", sha256.Sum256(data))

    var sigStr string
    if h.privKey != nil {
        var err error
        sigStr, err = mycrypto.SignSHA256(h.privKey, checksum)
        if err != nil {
            log.Printf("Warning: failed to sign firmware: %v", err)
        } else {
            log.Printf("Signed firmware v%s with ECDSA P-256", version)
        }
    }

    storageKey := fmt.Sprintf("firmware/%s/%s", version, file.Filename)
    _, err = h.minio.PutObject(
        context.Background(),
        h.bucket,
        storageKey,
        bytesReader(data),
        int64(len(data)),
        minio.PutObjectOptions{ContentType: "application/octet-stream"},
    )
    if err != nil {
        log.Printf("Storage upload to bucket '%s' failed: %v", h.bucket, err)
        return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("storage upload failed: %v", err)})
    }

    fw, err := h.queries.CreateFirmwareVersion(c.Context(), db.CreateFirmwareVersionParams{
        Version:        version,
        StorageKey:     storageKey,
        FileSize:       int64(len(data)),
        Sha256Checksum: checksum,
        EcdsaSignature: pgtype.Text{String: sigStr, Valid: sigStr != ""},
        ReleaseNotes:   pgtype.Text{String: releaseNotes, Valid: releaseNotes != ""},
        UploadedBy:     pgtype.Text{String: "system", Valid: true},
    })
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "db insert failed: " + err.Error()})
    }

    return c.Status(201).JSON(fw)
}

func (h *FirmwareHandler) backfillSignatures(ctx context.Context) {
    count, err := h.resignAllInternal(ctx)
    if err != nil {
        log.Printf("[SECURITY] backfillSignatures error: %v", err)
    } else if count > 0 {
        log.Printf("[SECURITY] backfillSignatures updated %d firmware signature(s)", count)
    }
}

func (h *FirmwareHandler) resignAllInternal(ctx context.Context) (int, error) {
    if h.privKey == nil {
        return 0, errors.New("private key not loaded")
    }
    versions, err := h.queries.ListFirmwareVersions(ctx)
    if err != nil {
        return 0, err
    }
    count := 0
    for _, fw := range versions {
        needSign := !fw.EcdsaSignature.Valid || fw.EcdsaSignature.String == ""
        if !needSign && h.pubKey != nil {
            if !mycrypto.VerifySignature(h.pubKey, fw.Sha256Checksum, fw.EcdsaSignature.String) {
                log.Printf("[SECURITY] Firmware %s signature is invalid or signed with mismatched key; re-signing with master key...", fw.Version)
                needSign = true
            }
        }
        if needSign {
            sig, err := mycrypto.SignSHA256(h.privKey, fw.Sha256Checksum)
            if err != nil {
                log.Printf("Warning: failed to sign firmware %s: %v", fw.Version, err)
                continue
            }
            _, err = h.db.Exec(ctx, "UPDATE firmware_versions SET ecdsa_signature = $1 WHERE id = $2", sig, fw.ID)
            if err != nil {
                log.Printf("Warning: failed to backfill signature for %s: %v", fw.Version, err)
            } else {
                count++
                log.Printf("Successfully signed firmware %s with master key", fw.Version)
            }
        }
    }
    return count, nil
}

func (h *FirmwareHandler) ResignAll(c fiber.Ctx) error {
    count, err := h.resignAllInternal(c.Context())
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": err.Error()})
    }
    return c.JSON(fiber.Map{"status": "ok", "updated_count": count})
}

func (h *FirmwareHandler) List(c fiber.Ctx) error {
    versions, err := h.queries.ListFirmwareVersions(c.Context())
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": err.Error()})
    }
    return c.JSON(fiber.Map{"data": versions})
}

func (h *FirmwareHandler) GetDownloadURL(c fiber.Ctx) error {
    id := c.Params("id")
    uid, err := uuid.Parse(id)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
    }
    fw, err := h.queries.GetFirmwareVersion(c.Context(), pgtype.UUID{Bytes: uid, Valid: true})
    if err != nil {
        return c.Status(404).JSON(fiber.Map{"error": "not found"})
    }
    url, err := h.minio.PresignedGetObject(context.Background(), h.bucket, fw.StorageKey, 15*time.Minute, nil)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "presign failed"})
    }
    return c.JSON(fiber.Map{
        "url":       url.String(),
        "checksum":  fw.Sha256Checksum,
        "signature": fw.EcdsaSignature.String,
    })
}

func (h *FirmwareHandler) Delete(c fiber.Ctx) error {
    id := c.Params("id")
    uid, err := uuid.Parse(id)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
    }

    fwUUID := pgtype.UUID{Bytes: uid, Valid: true}
    fw, err := h.queries.GetFirmwareVersion(c.Context(), fwUUID)
    if err != nil {
        return c.Status(404).JSON(fiber.Map{"error": "firmware not found"})
    }

    // Check if this firmware has been referenced in any deployments
    var deploymentCount int64
    err = h.db.QueryRow(c.Context(), "SELECT COUNT(*) FROM deployments WHERE firmware_version_id = $1", fwUUID).Scan(&deploymentCount)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "failed to verify deployment references: " + err.Error()})
    }

    if deploymentCount > 0 {
        // Soft delete to preserve historical deployment audit records
        err = h.queries.DeactivateFirmwareVersion(c.Context(), fwUUID)
        if err != nil {
            return c.Status(500).JSON(fiber.Map{"error": "failed to deactivate firmware: " + err.Error()})
        }
        log.Printf("[INFO] Soft-deleted firmware v%s (%s) — referenced in %d deployments", fw.Version, id, deploymentCount)
        return c.JSON(fiber.Map{
            "message": "firmware deactivated successfully (retained for deployment history)",
            "id":      id,
            "mode":    "soft_delete",
        })
    }

    // Hard delete: remove object from storage bucket and row from database
    if fw.StorageKey != "" {
        _ = h.minio.RemoveObject(context.Background(), h.bucket, fw.StorageKey, minio.RemoveObjectOptions{})
    }

    _, err = h.db.Exec(c.Context(), "DELETE FROM firmware_versions WHERE id = $1", fwUUID)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "failed to delete firmware record: " + err.Error()})
    }

    log.Printf("[INFO] Hard-deleted firmware v%s (%s) and removed storage object %s", fw.Version, id, fw.StorageKey)
    return c.JSON(fiber.Map{
        "message": "firmware and storage object deleted successfully",
        "id":      id,
        "mode":    "hard_delete",
    })
}

type UpdateFirmwareRequest struct {
    Version      *string `json:"version"`
    ReleaseNotes *string `json:"release_notes"`
}

func (h *FirmwareHandler) Update(c fiber.Ctx) error {
    id := c.Params("id")
    uid, err := uuid.Parse(id)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
    }

    var req UpdateFirmwareRequest
    if err := c.Bind().Body(&req); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
    }

    fwUUID := pgtype.UUID{Bytes: uid, Valid: true}
    existing, err := h.queries.GetFirmwareVersion(c.Context(), fwUUID)
    if err != nil {
        return c.Status(404).JSON(fiber.Map{"error": "firmware not found"})
    }

    newVersion := existing.Version
    if req.Version != nil && strings.TrimSpace(*req.Version) != "" {
        newVersion = strings.TrimSpace(*req.Version)
    }

    newNotes := existing.ReleaseNotes.String
    if req.ReleaseNotes != nil {
        newNotes = strings.TrimSpace(*req.ReleaseNotes)
    }

    var updated db.FirmwareVersion
    row := h.db.QueryRow(c.Context(),
        "UPDATE firmware_versions SET version = $1, release_notes = $2 WHERE id = $3 RETURNING id, version, storage_key, file_size, sha256_checksum, ecdsa_signature, release_notes, is_active, uploaded_by, created_at",
        newVersion, pgtype.Text{String: newNotes, Valid: true}, fwUUID,
    )
    err = row.Scan(
        &updated.ID,
        &updated.Version,
        &updated.StorageKey,
        &updated.FileSize,
        &updated.Sha256Checksum,
        &updated.EcdsaSignature,
        &updated.ReleaseNotes,
        &updated.IsActive,
        &updated.UploadedBy,
        &updated.CreatedAt,
    )
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "failed to update firmware: " + err.Error()})
    }

    log.Printf("[INFO] Updated firmware %s: version=%s, notes=%s", id, newVersion, newNotes)
    return c.JSON(updated)
}

func bytesReader(d []byte) io.Reader { return bytes.NewReader(d) }
