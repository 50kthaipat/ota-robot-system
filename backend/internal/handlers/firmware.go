package handlers

import (
    "bytes"
    "context"
    "crypto/ecdsa"
    "crypto/sha256"
    "fmt"
    "io"
    "log"
    "os"
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
        return c.Status(500).JSON(fiber.Map{"error": "storage upload failed"})
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
    if h.privKey == nil {
        return
    }
    versions, err := h.queries.ListFirmwareVersions(ctx)
    if err != nil {
        log.Printf("Warning: failed to list firmware for signature backfill: %v", err)
        return
    }
    for _, fw := range versions {
        if !fw.EcdsaSignature.Valid || fw.EcdsaSignature.String == "" {
            sig, err := mycrypto.SignSHA256(h.privKey, fw.Sha256Checksum)
            if err != nil {
                log.Printf("Warning: failed to sign existing firmware %s: %v", fw.Version, err)
                continue
            }
            _, err = h.db.Exec(ctx, "UPDATE firmware_versions SET ecdsa_signature = $1 WHERE id = $2", sig, fw.ID)
            if err != nil {
                log.Printf("Warning: failed to backfill signature for %s: %v", fw.Version, err)
            } else {
                log.Printf("Successfully backfilled ECDSA signature for firmware %s", fw.Version)
            }
        }
    }
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

func bytesReader(d []byte) io.Reader { return bytes.NewReader(d) }
