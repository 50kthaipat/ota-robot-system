package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/ota-robot/api/internal/auth"
)

// Authenticate verifies the Bearer JWT token in the Authorization header
func Authenticate() fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing Authorization header",
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid Authorization header format, expected Bearer <token>",
			})
		}

		claims, err := auth.ValidateAccessToken(parts[1])
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or expired token",
			})
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("username", claims.Username)
		c.Locals("role", claims.Role)

		return c.Next()
	}
}

// RequireRole checks if the authenticated user has at least one of the allowed roles
func RequireRole(allowedRoles ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		userRole, ok := c.Locals("role").(string)
		if !ok || userRole == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "user role not determined",
			})
		}

		for _, role := range allowedRoles {
			if strings.EqualFold(userRole, role) {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "insufficient permissions for this action",
		})
	}
}
