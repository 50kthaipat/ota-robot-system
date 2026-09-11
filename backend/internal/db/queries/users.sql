-- name: GetUserByUsername :one
SELECT * FROM users
WHERE username = $1 LIMIT 1;

-- name: GetUserByEmailOrUsername :one
SELECT * FROM users
WHERE (email = $1 OR username = $1) LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (username, email, password_hash, role)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateUserFailedAttempts :exec
UPDATE users
SET failed_attempts = $2, locked_until = $3, updated_at = NOW()
WHERE id = $1;

-- name: ResetUserFailedAttempts :exec
UPDATE users
SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
WHERE id = $1;

-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetRefreshToken :one
SELECT * FROM refresh_tokens
WHERE token_hash = $1 AND expires_at > NOW()
LIMIT 1;

-- name: DeleteRefreshToken :exec
DELETE FROM refresh_tokens
WHERE token_hash = $1;

-- name: DeleteUserRefreshTokens :exec
DELETE FROM refresh_tokens
WHERE user_id = $1;
