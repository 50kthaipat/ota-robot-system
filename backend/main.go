package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/redis/go-redis/v9"
	
	mqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/ota-robot/api/internal/handlers"
	"github.com/ota-robot/api/internal/metrics"
	"github.com/ota-robot/api/internal/middleware"
	mymqtt "github.com/ota-robot/api/internal/mqtt"
)

func main() {
	_ = godotenv.Load("../../.env")

	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		dbUrl = "postgres://ota:ota_password@localhost:5432/otadb?sslmode=disable"
	}
	dbPool, err := pgxpool.New(context.Background(), dbUrl)
	if err != nil {
		log.Fatalf("Unable to configure database pool: %v\n", err)
	}
	defer dbPool.Close()
	log.Println("[INFO] Database pool configured")

	// Redis — optional, skip gracefully when not available (cloud free tier)
	redisUrl := os.Getenv("REDIS_URL")
	if redisUrl != "" {
		opt, err := redis.ParseURL(redisUrl)
		if err != nil {
			log.Printf("[WARN] Unable to parse REDIS_URL: %v — skipping Redis", err)
		} else {
			rdb := redis.NewClient(opt)
			defer rdb.Close()
			if pingErr := rdb.Ping(context.Background()).Err(); pingErr != nil {
				log.Printf("[WARN] Redis not reachable: %v — continuing without cache", pingErr)
			} else {
				log.Println("[INFO] Redis connected")
			}
		}
	} else {
		log.Println("[INFO] REDIS_URL not set — running without Redis cache")
	}

	minioEndpoint := strings.TrimSpace(os.Getenv("MINIO_ENDPOINT"))
	if minioEndpoint == "" {
		minioEndpoint = "localhost:9000"
	} else {
		minioEndpoint = strings.TrimPrefix(minioEndpoint, "https://")
		minioEndpoint = strings.TrimPrefix(minioEndpoint, "http://")
		minioEndpoint = strings.TrimRight(minioEndpoint, "/")
	}
	accessKey := strings.TrimSpace(os.Getenv("MINIO_ACCESS_KEY"))
	secretKey := strings.TrimSpace(os.Getenv("MINIO_SECRET_KEY"))
	region := strings.TrimSpace(os.Getenv("MINIO_REGION"))
	if region == "" {
		region = "auto"
	}
	minioClient, err := minio.New(minioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: os.Getenv("MINIO_USE_SSL") == "true",
		Region: region,
	})
	if err != nil {
		log.Fatalf("Unable to connect to minio/R2: %v\n", err)
	}
	log.Printf("[INFO] MinIO/R2 client initialized with endpoint %s (region: %s)", minioEndpoint, region)
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "firmware"
	}

	// ── MQTT Client ─────────────────────────────────────────────────────────────
	// Supports both local tcp:// (EMQX) and cloud ssl:// (HiveMQ Cloud)
	mqttBroker := strings.TrimSpace(os.Getenv("MQTT_BROKER"))
	if mqttBroker == "" {
		mqttBroker = "tcp://localhost:1883"
	}
	if !strings.Contains(mqttBroker, "://") {
		if strings.Contains(mqttBroker, "8883") || strings.Contains(mqttBroker, "hivemq") {
			mqttBroker = "ssl://" + mqttBroker
		} else {
			mqttBroker = "tcp://" + mqttBroker
		}
	}
	mqttOpts := mqtt.NewClientOptions()
	mqttOpts.AddBroker(mqttBroker)
	mqttOpts.SetClientID("ota-api-server-" + fmt.Sprintf("%d", time.Now().Unix()))
	mqttOpts.SetAutoReconnect(true)
	mqttOpts.SetMaxReconnectInterval(30 * time.Second)

	// TLS config for cloud brokers (ssl:// prefix or MQTT_USE_TLS=true)
	useTLS := strings.HasPrefix(mqttBroker, "ssl://") || strings.HasPrefix(mqttBroker, "tls://") || os.Getenv("MQTT_USE_TLS") == "true"
	if useTLS {
		serverHost := ""
		if u, err := url.Parse(mqttBroker); err == nil {
			serverHost = u.Hostname()
		}
		mqttOpts.SetTLSConfig(&tls.Config{
			MinVersion: tls.VersionTLS12,
			ServerName: serverHost,
		})
		log.Printf("[INFO] MQTT TLS enabled (SNI: %s)", serverHost)
	}

	// Credentials for cloud brokers (HiveMQ requires username/password)
	if mqttUsername := strings.Trim(strings.TrimSpace(os.Getenv("MQTT_USERNAME")), "<>"); mqttUsername != "" {
		mqttPass := strings.Trim(strings.TrimSpace(os.Getenv("MQTT_PASSWORD")), "<>")
		mqttOpts.SetUsername(mqttUsername)
		mqttOpts.SetPassword(mqttPass)
		log.Printf("[INFO] MQTT authenticating as user: %s", mqttUsername)
	}

	mqttClient := mqtt.NewClient(mqttOpts)
	if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
		log.Printf("[WARN] MQTT initial connect failed: %v — background auto-reconnect active", token.Error())
	} else {
		log.Printf("[INFO] MQTT connected successfully to %s", mqttBroker)
	}

	myMqttClient := mymqtt.NewClient(mqttClient, dbPool)
	myMqttClient.Subscribe()

	app := fiber.New(fiber.Config{
		BodyLimit:         100 * 1024 * 1024, // 100 MB to support large binary firmware uploads
		StreamRequestBody: true,
	})
	app.Use(logger.New())
	app.Use(recover.New())

	// Explicit CORS Whitelist for Vercel & Localhost
	allowedOrigins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"https://ota-robot-system.vercel.app",
	}
	if customOrigin := os.Getenv("FRONTEND_URL"); customOrigin != "" {
		for _, o := range strings.Split(customOrigin, ",") {
			o = strings.TrimSpace(strings.TrimRight(o, "/"))
			if o != "" {
				allowedOrigins = append(allowedOrigins, o)
			}
		}
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Refresh-Token"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowCredentials: true,
	}))

	// Security Headers
	app.Use(helmet.New())

	// General API Rate Limiter: 120 req/min
	app.Use(limiter.New(limiter.Config{
		Max:        120,
		Expiration: 1 * time.Minute,
	}))

	app.Use(metrics.HTTPMiddleware())

	metrics.StartFleetMetricsSync(dbPool, 5*time.Second)

	deviceHandler := handlers.NewDeviceHandler(dbPool)
	firmwareHandler := handlers.NewFirmwareHandler(dbPool, minioClient, bucket)
	deploymentHandler := handlers.NewDeploymentHandler(dbPool, minioClient, bucket, myMqttClient)
	authHandler := handlers.NewAuthHandler(dbPool)

	if err := authHandler.AutoMigrateAndSeed(context.Background()); err != nil {
		log.Printf("[WARN] Auth database setup notification: %v", err)
	}

	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "ota-robot-system-api",
			"health":  "/health",
			"docs":    "/api/v1/devices",
		})
	})
	app.Get("/health", func(c fiber.Ctx) error { return c.SendString("OK") })

	// Strict rate limiter for Login: 5 attempts per 1 minute
	loginLimiter := limiter.New(limiter.Config{
		Max:        5,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "too many login attempts. Please wait 1 minute before trying again.",
			})
		},
	})

	api := app.Group("/api/v1")

	// Public Auth endpoints
	authGroup := api.Group("/auth")
	authGroup.Post("/login", loginLimiter, authHandler.Login)
	authGroup.Post("/refresh", authHandler.Refresh)
	authGroup.Post("/logout", authHandler.Logout)
	authGroup.Get("/me", middleware.Authenticate(), authHandler.Me)

	// Protected Application endpoints
	protected := api.Group("", middleware.Authenticate())

	// Fleet telemetry & firmware reads
	protected.Get("/devices", deviceHandler.ListDevices)
	protected.Get("/devices/:id", deviceHandler.GetDevice)
	protected.Get("/firmware", firmwareHandler.List)
	protected.Get("/firmware/:id/url", firmwareHandler.GetDownloadURL)
	protected.Get("/deployments", deploymentHandler.ListDeployments)
	protected.Get("/deployments/:id", deploymentHandler.GetDeployment)

	// Mutations requiring operator or admin privileges
	protected.Post("/firmware/upload", middleware.RequireRole("admin", "operator"), firmwareHandler.Upload)
	protected.Patch("/firmware/:id", middleware.RequireRole("admin"), firmwareHandler.Update)
	protected.Delete("/firmware/:id", middleware.RequireRole("admin"), firmwareHandler.Delete)
	protected.Post("/firmware/resign", middleware.RequireRole("admin"), firmwareHandler.ResignAll)
	protected.Post("/deployments", middleware.RequireRole("admin", "operator"), deploymentHandler.CreateDeployment)
	protected.Post("/deployments/:id/rollback", middleware.RequireRole("admin", "operator"), deploymentHandler.Rollback)

	app.Get("/metrics", metrics.Handler())

	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("API_PORT")
	}
	if port == "" {
		port = "8000"
	}
	log.Printf("[INFO] Server starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
