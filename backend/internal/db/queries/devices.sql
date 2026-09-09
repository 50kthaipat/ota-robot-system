-- name: GetDevice :one
SELECT * FROM devices WHERE id = $1;

-- name: ListDevices :many
SELECT * FROM devices ORDER BY factory_id, created_at DESC;

-- name: ListDevicesByFactory :many
SELECT * FROM devices WHERE factory_id = $1 ORDER BY created_at DESC;

-- name: UpsertDevice :one
INSERT INTO devices (id, name, factory_id, hw_model, current_version, status, last_seen, ip_address)
VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    current_version = EXCLUDED.current_version,
    last_seen = NOW(),
    ip_address = EXCLUDED.ip_address,
    updated_at = NOW()
RETURNING *;

-- name: UpdateDeviceStatus :one
UPDATE devices SET status = $2, last_seen = NOW(), updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateDeviceVersion :one
UPDATE devices SET current_version = $2, status = 'online', updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CountDevicesByStatus :many
SELECT status, COUNT(*) as count FROM devices GROUP BY status;
