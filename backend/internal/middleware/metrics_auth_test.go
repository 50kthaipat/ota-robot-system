package middleware

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestRequireMetricsAuth_WithToken(t *testing.T) {
	app := fiber.New()
	app.Use("/metrics", RequireMetricsAuth("secret123", "production"))
	app.Get("/metrics", func(c fiber.Ctx) error {
		return c.SendString("ok_metrics")
	})

	// 1. Missing header -> 401
	req := httptest.NewRequest("GET", "/metrics", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 401 Unauthorized for missing token, got %d (body: %s)", resp.StatusCode, string(body))
	}

	// 2. Wrong token -> 401
	req = httptest.NewRequest("GET", "/metrics", nil)
	req.Header.Set("Authorization", "Bearer wrongtoken")
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 401 Unauthorized for invalid token, got %d (body: %s)", resp.StatusCode, string(body))
	}

	// 3. Correct token -> 200
	req = httptest.NewRequest("GET", "/metrics", nil)
	req.Header.Set("Authorization", "Bearer secret123")
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 200 OK for valid token, got %d (body: %s)", resp.StatusCode, string(body))
	}
}

func TestRequireMetricsAuth_ProductionNoToken(t *testing.T) {
	app := fiber.New()
	app.Use("/metrics", RequireMetricsAuth("", "production"))
	app.Get("/metrics", func(c fiber.Ctx) error {
		return c.SendString("ok_metrics")
	})

	req := httptest.NewRequest("GET", "/metrics", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 403 Forbidden in production without token, got %d (body: %s)", resp.StatusCode, string(body))
	}
}

func TestRequireMetricsAuth_DevelopmentLocalhost(t *testing.T) {
	app := fiber.New()
	app.Use("/metrics", RequireMetricsAuth("", "development"))
	app.Get("/metrics", func(c fiber.Ctx) error {
		return c.SendString("ok_metrics")
	})

	// Localhost loopback in test harness -> 200
	req := httptest.NewRequest("GET", "/metrics", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 200 OK in development for local request, got %d (body: %s)", resp.StatusCode, string(body))
	}
}
