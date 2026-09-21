package config

import (
	"errors"
	"net/url"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Environment names
const (
	EnvDevelopment = "development"
	EnvProduction  = "production"
	EnvTest         = "test"
)

// Config aggregates and validates all runtime environment configuration.
type Config struct {
	AppEnv   string
	Port     string
	Database DatabaseConfig
	Redis    RedisConfig
	Storage  StorageConfig
	MQTT     MQTTConfig
	Auth     AuthConfig
	CORS     CORSConfig
}

// DatabaseConfig stores database connection settings.
type DatabaseConfig struct {
	URL string
}

// RedisConfig stores Redis cache settings.
type RedisConfig struct {
	URL     string
	Enabled bool
}

// StorageConfig stores S3 / MinIO object storage parameters.
type StorageConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	Region    string
	UseSSL    bool
}

// MQTTConfig stores broker connection and authentication parameters.
type MQTTConfig struct {
	Broker     string
	Username   string
	Password   string
	ServerHost string
	UseTLS     bool
}

// AuthConfig stores token and provisioning parameters.
type AuthConfig struct {
	JWTSecret     string
	AdminUsername string
	AdminEmail    string
	AdminPassword string
	CookieSecure  bool
}

// CORSConfig stores allowed origins.
type CORSConfig struct {
	AllowedOrigins []string
}

// Load reads environment variables and produces a validated Config instance.
func Load() (*Config, error) {
	// Best-effort load from .env files
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env == "" {
		env = strings.ToLower(strings.TrimSpace(os.Getenv("ENV")))
	}
	if env == "" {
		env = EnvDevelopment
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8000"
	}

	// Database
	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" && env != EnvProduction {
		dbURL = "postgres://ota:ota_password@localhost:5432/otadb?sslmode=disable"
	}

	// Redis
	redisURL := strings.TrimSpace(os.Getenv("REDIS_URL"))

	// MinIO / S3
	minioEndpoint := strings.TrimSpace(os.Getenv("MINIO_ENDPOINT"))
	if minioEndpoint == "" {
		minioEndpoint = "localhost:9000"
	} else {
		minioEndpoint = strings.TrimPrefix(minioEndpoint, "https://")
		minioEndpoint = strings.TrimPrefix(minioEndpoint, "http://")
		minioEndpoint = strings.TrimRight(minioEndpoint, "/")
	}

	bucket := strings.TrimSpace(os.Getenv("MINIO_BUCKET"))
	if bucket == "" {
		bucket = "firmware"
	}

	region := strings.TrimSpace(os.Getenv("MINIO_REGION"))
	if region == "" {
		region = "auto"
	}

	// MQTT
	mqttBroker := strings.TrimSpace(os.Getenv("MQTT_BROKER"))
	if mqttBroker == "" {
		mqttBroker = "tcp://localhost:1883"
	}

	useTLS := strings.EqualFold(os.Getenv("MQTT_USE_TLS"), "true") || strings.HasPrefix(mqttBroker, "ssl://") || strings.HasPrefix(mqttBroker, "tls://")
	serverHost := ""
	if parsedBroker, err := url.Parse(mqttBroker); err == nil {
		serverHost = parsedBroker.Hostname()
	}

	// Auth & Secrets
	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwtSecret == "" && env != EnvProduction {
		jwtSecret = "ota-robot-system-default-jwt-secret-key-32b"
	}

	adminUser := strings.TrimSpace(os.Getenv("ADMIN_USERNAME"))
	if adminUser == "" {
		adminUser = "admin"
	}

	adminEmail := strings.TrimSpace(os.Getenv("ADMIN_EMAIL"))
	if adminEmail == "" {
		adminEmail = "admin@ota-robotics.internal"
	}

	adminPassword := strings.TrimSpace(os.Getenv("ADMIN_PASSWORD"))
	if adminPassword == "" && env != EnvProduction {
		adminPassword = "Admin@OTA2026!"
	}

	cookieSecure := env == EnvProduction || strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true")

	// CORS Origins
	origins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"https://ota-robot-system.vercel.app",
	}
	if custom := os.Getenv("FRONTEND_URL"); custom != "" {
		for _, o := range strings.Split(custom, ",") {
			o = strings.TrimSpace(strings.TrimRight(o, "/"))
			if o != "" {
				origins = append(origins, o)
			}
		}
	}

	cfg := &Config{
		AppEnv: env,
		Port:   port,
		Database: DatabaseConfig{
			URL: dbURL,
		},
		Redis: RedisConfig{
			URL:     redisURL,
			Enabled: redisURL != "",
		},
		Storage: StorageConfig{
			Endpoint:  minioEndpoint,
			AccessKey: strings.TrimSpace(os.Getenv("MINIO_ACCESS_KEY")),
			SecretKey: strings.TrimSpace(os.Getenv("MINIO_SECRET_KEY")),
			Bucket:    bucket,
			Region:    region,
			UseSSL:    strings.EqualFold(os.Getenv("MINIO_USE_SSL"), "true") || strings.Contains(minioEndpoint, "r2.cloudflarestorage.com"),
		},
		MQTT: MQTTConfig{
			Broker:     mqttBroker,
			Username:   strings.Trim(strings.TrimSpace(os.Getenv("MQTT_USERNAME")), "<>"),
			Password:   strings.Trim(strings.TrimSpace(os.Getenv("MQTT_PASSWORD")), "<>"),
			ServerHost: serverHost,
			UseTLS:     useTLS,
		},
		Auth: AuthConfig{
			JWTSecret:     jwtSecret,
			AdminUsername: adminUser,
			AdminEmail:    adminEmail,
			AdminPassword: adminPassword,
			CookieSecure:  cookieSecure,
		},
		CORS: CORSConfig{
			AllowedOrigins: origins,
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate enforces runtime invariants and fail-fast rules.
func (c *Config) Validate() error {
	if c.Database.URL == "" {
		return errors.New("DATABASE_URL is required and cannot be empty")
	}

	if c.AppEnv == EnvProduction {
		if c.Database.URL == "postgres://ota:ota_password@localhost:5432/otadb?sslmode=disable" {
			return errors.New("cannot use default local database credentials in production mode")
		}

		if c.Auth.JWTSecret == "" ||
			c.Auth.JWTSecret == "ota-robot-system-default-jwt-secret-key-32b" ||
			c.Auth.JWTSecret == "change-me-in-production-use-long-random-string" {
			return errors.New("JWT_SECRET must be configured with a secure high-entropy secret in production mode")
		}

		if c.Auth.AdminPassword == "Admin@OTA2026!" {
			return errors.New("ADMIN_PASSWORD must be explicitly provided in production mode instead of default password")
		}
	}

	return nil
}

// ShouldProvisionAdmin returns true if default admin creation parameters are supplied.
func (c *Config) ShouldProvisionAdmin() bool {
	return c.Auth.AdminUsername != "" && c.Auth.AdminPassword != ""
}
