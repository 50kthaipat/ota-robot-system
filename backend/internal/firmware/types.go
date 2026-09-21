package firmware

import (
	"context"
	"crypto/ecdsa"
	"io"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/ota-robot/api/internal/db/generated"
)

// StorageClient defines the object storage interface required by the firmware release module.
type StorageClient interface {
	PutObject(ctx context.Context, bucket, objectName string, reader io.Reader, objectSize int64, opts interface{}) error
	RemoveObject(ctx context.Context, bucket, objectName string, opts interface{}) error
	PresignedGetObject(ctx context.Context, bucket, objectName string, expires time.Duration, reqParams interface{}) (string, error)
}

// ReleaseParams specifies the parameters needed to release a new firmware version.
type ReleaseParams struct {
	Version      string
	Filename     string
	Data         []byte
	ReleaseNotes string
}

// DownloadDetails provides the presigned URL and integrity verification metadata.
type DownloadDetails struct {
	URL       string
	Checksum  string
	Signature string
}

// Service defines the interface for the deep firmware release lifecycle module.
type Service interface {
	Release(ctx context.Context, params ReleaseParams) (*db.FirmwareVersion, error)
	GetDownloadURL(ctx context.Context, id pgtype.UUID, expiry time.Duration) (*DownloadDetails, error)
	List(ctx context.Context) ([]db.FirmwareVersion, error)
	Delete(ctx context.Context, id pgtype.UUID) error
	Update(ctx context.Context, id pgtype.UUID, notes, status string) (*db.FirmwareVersion, error)
	ResignAll(ctx context.Context) (int, error)
	GetSigningKeys() (*ecdsa.PrivateKey, *ecdsa.PublicKey)
}
