-- name: CreateFirmwareVersion :one
INSERT INTO firmware_versions (version, storage_key, file_size, sha256_checksum, ecdsa_signature, release_notes, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetFirmwareVersion :one
SELECT * FROM firmware_versions WHERE id = $1;

-- name: GetFirmwareVersionByVersion :one
SELECT * FROM firmware_versions WHERE version = $1;

-- name: ListFirmwareVersions :many
SELECT * FROM firmware_versions WHERE is_active = true ORDER BY created_at DESC;

-- name: DeactivateFirmwareVersion :exec
UPDATE firmware_versions SET is_active = false WHERE id = $1;
