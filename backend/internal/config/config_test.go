package config

import (
	"os"
	"testing"
)

func TestConfig_DevelopmentDefaults(t *testing.T) {
	// Clear env
	os.Setenv("APP_ENV", "development")
	os.Setenv("DATABASE_URL", "")
	os.Setenv("JWT_SECRET", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected successful load in development, got error: %v", err)
	}

	if cfg.AppEnv != EnvDevelopment {
		t.Errorf("expected AppEnv %s, got %s", EnvDevelopment, cfg.AppEnv)
	}

	if cfg.Database.URL == "" {
		t.Error("expected default development database URL, got empty")
	}

	if cfg.Auth.JWTSecret == "" {
		t.Error("expected default development JWT secret, got empty")
	}
}

func TestConfig_ProductionFailFast_InsecureJWT(t *testing.T) {
	cfg := &Config{
		AppEnv: EnvProduction,
		Database: DatabaseConfig{
			URL: "postgres://prod_user:secret_pass@prod-db.internal:5432/otadb",
		},
		Auth: AuthConfig{
			JWTSecret: "ota-robot-system-default-jwt-secret-key-32b",
		},
	}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected validation error for default JWT secret in production, got nil")
	}
}

func TestConfig_ProductionFailFast_InsecureDB(t *testing.T) {
	cfg := &Config{
		AppEnv: EnvProduction,
		Database: DatabaseConfig{
			URL: "postgres://ota:ota_password@localhost:5432/otadb?sslmode=disable",
		},
		Auth: AuthConfig{
			JWTSecret: "super-secure-production-random-jwt-secret-key",
		},
	}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected validation error for default local DB in production, got nil")
	}
}

func TestConfig_ProductionValid(t *testing.T) {
	cfg := &Config{
		AppEnv: EnvProduction,
		Database: DatabaseConfig{
			URL: "postgres://prod_user:prod_pass@aws.rds.com:5432/otadb",
		},
		Auth: AuthConfig{
			JWTSecret:     "very-secure-high-entropy-jwt-secret-phrase-64chars",
			AdminPassword: "CustomSecureAdminPassword123!",
		},
		Metrics: MetricsConfig{
			Token: "secure-metrics-prom-token-2026",
		},
	}

	err := cfg.Validate()
	if err != nil {
		t.Fatalf("expected production config to pass validation, got: %v", err)
	}
}

func TestConfig_ProductionFailFast_MissingMetricsToken(t *testing.T) {
	cfg := &Config{
		AppEnv: EnvProduction,
		Database: DatabaseConfig{
			URL: "postgres://prod_user:prod_pass@aws.rds.com:5432/otadb",
		},
		Auth: AuthConfig{
			JWTSecret:     "very-secure-high-entropy-jwt-secret-phrase-64chars",
			AdminPassword: "CustomSecureAdminPassword123!",
		},
		Metrics: MetricsConfig{
			Token: "",
		},
	}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected validation error for missing METRICS_TOKEN in production, got nil")
	}
}

