package middleware

import (
	"net"
	"strings"

	"github.com/gofiber/fiber/v3"
)

// RequireMetricsAuth protects the Prometheus /metrics endpoint.
// In all environments, if a token is configured, it strictly requires Authorization: Bearer <token>.
// If no token is configured:
// - In production: fail-closed with 403 Forbidden.
// - In development/test: allows requests originating from loopback or private network subnets.
func RequireMetricsAuth(token string, appEnv string) fiber.Handler {
	return func(c fiber.Ctx) error {
		if token != "" {
			authHeader := c.Get("Authorization")
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") && parts[1] == token {
				return c.Next()
			}
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized metrics access: invalid bearer token",
			})
		}

		// In production, reject access if no authentication token is configured
		if strings.EqualFold(appEnv, "production") {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "metrics endpoint is restricted in production; configure METRICS_TOKEN",
			})
		}

		// In development or testing without token, allow loopback and private network CIDRs
		clientIP := c.IP()
		if isPrivateOrLoopback(clientIP) {
			return c.Next()
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "metrics access restricted to private network",
		})
	}
}

func isPrivateOrLoopback(ipStr string) bool {
	// Handle host:port if present
	host, _, err := net.SplitHostPort(ipStr)
	if err == nil {
		ipStr = host
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return ipStr == "localhost" || ipStr == ""
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified()
}
