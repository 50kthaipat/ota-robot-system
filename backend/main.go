package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/redis/go-redis/v9"
	
	mqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/ota-robot/api/internal/config"
	db "github.com/ota-robot/api/internal/db/generated"
	"github.com/ota-robot/api/internal/firmware"
	"github.com/ota-robot/api/internal/handlers"
	"github.com/ota-robot/api/internal/metrics"
	"github.com/ota-robot/api/internal/middleware"
	mymqtt "github.com/ota-robot/api/internal/mqtt"
	"github.com/ota-robot/api/internal/rollout"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL CONFIG] Configuration validation failed: %v", err)
	}

	dbPool, err := pgxpool.New(context.Background(), cfg.Database.URL)
	if err != nil {
		log.Fatalf("Unable to configure database pool: %v\n", err)
	}
	defer dbPool.Close()
	log.Println("[INFO] Database pool configured")

	// Redis — optional, skip gracefully when not available
	if cfg.Redis.Enabled {
		opt, err := redis.ParseURL(cfg.Redis.URL)
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

	minioClient, err := minio.New(cfg.Storage.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.Storage.AccessKey, cfg.Storage.SecretKey, ""),
		Secure: cfg.Storage.UseSSL,
		Region: cfg.Storage.Region,
	})
	if err != nil {
		log.Fatalf("Unable to connect to minio/R2: %v\n", err)
	}
	log.Printf("[INFO] MinIO/R2 client initialized with endpoint %s (region: %s)", cfg.Storage.Endpoint, cfg.Storage.Region)
	bucket := cfg.Storage.Bucket

	// MQTT Client
	mqttOpts := mqtt.NewClientOptions()
	mqttOpts.AddBroker(cfg.MQTT.Broker)
	mqttOpts.SetClientID("ota-api-server-" + fmt.Sprintf("%d", time.Now().Unix()))
	mqttOpts.SetAutoReconnect(true)
	mqttOpts.SetMaxReconnectInterval(30 * time.Second)

	if cfg.MQTT.UseTLS {
		mqttOpts.SetTLSConfig(&tls.Config{
			MinVersion: tls.VersionTLS12,
			ServerName: cfg.MQTT.ServerHost,
		})
		log.Printf("[INFO] MQTT TLS enabled (SNI: %s)", cfg.MQTT.ServerHost)
	}

	if cfg.MQTT.Username != "" {
		mqttOpts.SetUsername(cfg.MQTT.Username)
		mqttOpts.SetPassword(cfg.MQTT.Password)
		log.Printf("[INFO] MQTT authenticating as user: %s", cfg.MQTT.Username)
	}

	mqttClient := mqtt.NewClient(mqttOpts)
	if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
		log.Printf("[WARN] MQTT initial connect failed: %v — background auto-reconnect active", token.Error())
	} else {
		log.Printf("[INFO] MQTT connected successfully to %s", cfg.MQTT.Broker)
	}

	myMqttClient := mymqtt.NewClient(mqttClient, dbPool)
	rolloutManager := rollout.NewManager(db.New(dbPool), myMqttClient)
	myMqttClient.SetRolloutManager(rolloutManager)
	myMqttClient.Subscribe()

	app := fiber.New(fiber.Config{
		BodyLimit:         100 * 1024 * 1024, // 100 MB to support large binary firmware uploads
		StreamRequestBody: true,
	})
	app.Use(logger.New())
	app.Use(recover.New())

	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORS.AllowedOrigins,
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
	firmwareSvc := firmware.NewService(dbPool, minioClient, bucket)
	firmwareHandler := handlers.NewFirmwareHandler(firmwareSvc)
	deploymentHandler := handlers.NewDeploymentHandler(dbPool, minioClient, bucket, rolloutManager)
	authHandler := handlers.NewAuthHandler(dbPool)

	if err := authHandler.AutoMigrateAndSeed(context.Background(), cfg.Auth.AdminUsername, cfg.Auth.AdminEmail, cfg.Auth.AdminPassword); err != nil {
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

	// Fleet device management
	protected.Delete("/devices/:id", middleware.RequireRole("admin", "operator"), deviceHandler.DeleteDevice)
	protected.Post("/devices/prune-offline", middleware.RequireRole("admin", "operator"), deviceHandler.PruneOfflineDevices)

	// Mutations requiring operator or admin privileges
	protected.Post("/firmware/upload", middleware.RequireRole("admin", "operator"), firmwareHandler.Upload)
	protected.Patch("/firmware/:id", middleware.RequireRole("admin"), firmwareHandler.Update)
	protected.Delete("/firmware/:id", middleware.RequireRole("admin"), firmwareHandler.Delete)
	protected.Post("/firmware/resign", middleware.RequireRole("admin"), firmwareHandler.ResignAll)
	protected.Post("/deployments", middleware.RequireRole("admin", "operator"), deploymentHandler.CreateDeployment)
	protected.Post("/deployments/:id/rollback", middleware.RequireRole("admin", "operator"), deploymentHandler.Rollback)

	app.Get("/metrics", metrics.Handler())

	port := ":" + cfg.Port
	log.Printf("[INFO] Server starting on %s (env: %s)", port, cfg.AppEnv)
	log.Fatal(app.Listen(port))
}
