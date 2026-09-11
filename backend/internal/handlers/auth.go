package handlers

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ota-robot/api/internal/auth"
	db "github.com/ota-robot/api/internal/db/generated"
)

type AuthHandler struct {
	db      *pgxpool.Pool
	queries *db.Queries
}

func NewAuthHandler(pool *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{
		db:      pool,
		queries: db.New(pool),
	}
}

// AutoMigrateAndSeed ensures auth tables exist and seeds a default admin if none exists
func (h *AuthHandler) AutoMigrateAndSeed(ctx context.Context) error {
	queries := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;`,
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash VARCHAR(255) NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);`,
	}

	for _, q := range queries {
		if _, err := h.db.Exec(ctx, q); err != nil {
			log.Printf("[WARN] Auth migration query notice: %v", err)
		}
	}

	// Check if any user exists
	var count int
	err := h.db.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err == nil && count == 0 {
		adminUser := os.Getenv("ADMIN_USERNAME")
		if adminUser == "" {
			adminUser = "admin"
		}
		adminEmail := os.Getenv("ADMIN_EMAIL")
		if adminEmail == "" {
			adminEmail = "admin@ota-robotics.internal"
		}
		adminPass := os.Getenv("ADMIN_PASSWORD")
		if adminPass == "" {
			adminPass = "Admin@OTA2026!"
		}

		hashedPass, err := auth.HashPassword(adminPass)
		if err != nil {
			return fmt.Errorf("failed to hash default admin password: %w", err)
		}

		_, err = h.db.Exec(ctx,
			"INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
			adminUser, adminEmail, hashedPass,
		)
		if err != nil {
			return fmt.Errorf("failed to insert default admin user: %w", err)
		}
		log.Printf("[SECURITY] Initialized default admin account: '%s' (Email: %s)", adminUser, adminEmail)
	}

	return nil
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
	Role     string `json:"role"`
}

func (h *AuthHandler) Login(c fiber.Ctx) error {
	var req LoginRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)

	if req.Username == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "username and password are required",
		})
	}

	ctx := c.Context()
	user, err := h.queries.GetUserByEmailOrUsername(ctx, pgtype.Text{String: req.Username, Valid: true})
	if err != nil {
		// Constant-time mitigation against user enumeration
		_ = auth.CheckPassword("$2a$12$e8ZbzKk4B7Q5xV5bC2/90u3cR2vNqYqg9aV8kL6r4N0P1E3L5O1S2", req.Password)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid username or password",
		})
	}

	// Check if account is locked
	if user.LockedUntil.Valid && user.LockedUntil.Time.After(time.Now()) {
		remaining := time.Until(user.LockedUntil.Time).Round(time.Second)
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"error": fmt.Sprintf("account is locked due to consecutive failed attempts. Try again in %v", remaining),
		})
	}

	// Check password
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		newAttempts := user.FailedAttempts + 1
		var lockUntil pgtype.Timestamptz
		if newAttempts >= 5 {
			lockUntil = pgtype.Timestamptz{
				Time:  time.Now().Add(15 * time.Minute),
				Valid: true,
			}
		}

		_ = h.queries.UpdateUserFailedAttempts(ctx, db.UpdateUserFailedAttemptsParams{
			ID:             user.ID,
			FailedAttempts: newAttempts,
			LockedUntil:    lockUntil,
		})

		if newAttempts >= 5 {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "account has been locked for 15 minutes due to multiple failed login attempts",
			})
		}

		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fmt.Sprintf("invalid username or password. Remaining attempts: %d", 5-newAttempts),
		})
	}

	// Password valid: reset failed attempts
	_ = h.queries.ResetUserFailedAttempts(ctx, user.ID)

	userIDStr := uuid.UUID(user.ID.Bytes).String()

	// Generate Access Token (15 mins)
	accessToken, err := auth.GenerateAccessToken(userIDStr, user.Username, user.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate access token",
		})
	}

	// Generate Refresh Token (7 days)
	rawRefreshToken, hashedRefresh, err := auth.GenerateRefreshToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate refresh token",
		})
	}

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	_, err = h.queries.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: hashedRefresh,
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to record session",
		})
	}

	// Set HttpOnly, Secure, SameSite=Strict cookie
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    rawRefreshToken,
		Expires:  expiresAt,
		HTTPOnly: true,
		Secure:   os.Getenv("COOKIE_INSECURE") != "true", // secure unless explicitly turned off for local dev
		SameSite: "Strict",
		Path:     "/",
	})

	emailStr := ""
	if user.Email.Valid {
		emailStr = user.Email.String
	}

	return c.JSON(fiber.Map{
		"token": accessToken,
		"user": UserResponse{
			ID:       userIDStr,
			Username: user.Username,
			Email:    emailStr,
			Role:     user.Role,
		},
	})
}

func (h *AuthHandler) Refresh(c fiber.Ctx) error {
	rawToken := c.Cookies("refresh_token")
	if rawToken == "" {
		// Fallback to body or header
		rawToken = c.Get("X-Refresh-Token")
	}

	if rawToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "refresh token missing",
		})
	}

	ctx := c.Context()
	tokenHash := auth.HashRefreshToken(rawToken)

	record, err := h.queries.GetRefreshToken(ctx, tokenHash)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "session expired or invalid",
		})
	}

	// Token rotation: delete used token
	_ = h.queries.DeleteRefreshToken(ctx, tokenHash)

	user, err := h.queries.GetUserByID(ctx, record.UserID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "user no longer exists",
		})
	}

	userIDStr := uuid.UUID(user.ID.Bytes).String()

	// Generate new access token
	newAccessToken, err := auth.GenerateAccessToken(userIDStr, user.Username, user.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate access token",
		})
	}

	// Generate new refresh token
	newRawRefresh, newHashRefresh, err := auth.GenerateRefreshToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to rotate refresh token",
		})
	}

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	_, _ = h.queries.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: newHashRefresh,
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    newRawRefresh,
		Expires:  expiresAt,
		HTTPOnly: true,
		Secure:   os.Getenv("COOKIE_INSECURE") != "true",
		SameSite: "Strict",
		Path:     "/",
	})

	emailStr := ""
	if user.Email.Valid {
		emailStr = user.Email.String
	}

	return c.JSON(fiber.Map{
		"token": newAccessToken,
		"user": UserResponse{
			ID:       userIDStr,
			Username: user.Username,
			Email:    emailStr,
			Role:     user.Role,
		},
	})
}

func (h *AuthHandler) Logout(c fiber.Ctx) error {
	rawToken := c.Cookies("refresh_token")
	if rawToken != "" {
		tokenHash := auth.HashRefreshToken(rawToken)
		_ = h.queries.DeleteRefreshToken(c.Context(), tokenHash)
	}

	// Expire cookie
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HTTPOnly: true,
		Secure:   os.Getenv("COOKIE_INSECURE") != "true",
		SameSite: "Strict",
		Path:     "/",
	})

	return c.JSON(fiber.Map{
		"status":  "ok",
		"message": "session terminated successfully",
	})
}

func (h *AuthHandler) Me(c fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthenticated",
		})
	}

	parsedUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid user id in context",
		})
	}

	ctx := c.Context()
	user, err := h.queries.GetUserByID(ctx, pgtype.UUID{Bytes: parsedUUID, Valid: true})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "user not found",
		})
	}

	emailStr := ""
	if user.Email.Valid {
		emailStr = user.Email.String
	}

	return c.JSON(fiber.Map{
		"user": UserResponse{
			ID:       userIDStr,
			Username: user.Username,
			Email:    emailStr,
			Role:     user.Role,
		},
	})
}
