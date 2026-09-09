-- name: CreateDeployment :one
INSERT INTO deployments (firmware_version_id, strategy, canary_percentage, total_devices, rollback_threshold, created_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetDeployment :one
SELECT * FROM deployments WHERE id = $1;

-- name: ListDeployments :many
SELECT * FROM deployments ORDER BY created_at DESC LIMIT $1;

-- name: UpdateDeploymentStatus :one
UPDATE deployments SET status = $2 WHERE id = $1 RETURNING *;

-- name: UpdateDeploymentPhase :one
UPDATE deployments SET current_phase = $2, canary_percentage = $3 WHERE id = $1 RETURNING *;

-- name: IncrementDeploymentSuccess :exec
UPDATE deployments SET success_count = success_count + 1 WHERE id = $1;

-- name: IncrementDeploymentFailure :exec
UPDATE deployments SET failure_count = failure_count + 1 WHERE id = $1;

-- name: CreateDeploymentDevice :one
INSERT INTO deployment_devices (deployment_id, device_id, previous_version)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateDeploymentDeviceStatus :one
UPDATE deployment_devices
SET status = $3, progress = $4, error_message = $5
WHERE deployment_id = $1 AND device_id = $2
RETURNING *;

-- name: ListDeploymentDevices :many
SELECT dd.*, d.name as device_name, d.factory_id, d.hw_model
FROM deployment_devices dd
JOIN devices d ON d.id = dd.device_id
WHERE dd.deployment_id = $1
ORDER BY dd.created_at;

-- name: GetActiveDeploymentDeviceByDevice :one
SELECT dd.*
FROM deployment_devices dd
JOIN deployments d ON d.id = dd.deployment_id
WHERE dd.device_id = $1 AND (d.status = 'running' OR dd.status NOT IN ('success', 'failed', 'rolled_back'))
ORDER BY dd.created_at DESC
LIMIT 1;

