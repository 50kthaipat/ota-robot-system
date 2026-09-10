package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
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
	mqttBroker := os.Getenv("MQTT_BROKER")
	if mqttBroker == "" {
		mqttBroker = "tcp://localhost:1883"
	}
	mqttOpts := mqtt.NewClientOptions()
	mqttOpts.AddBroker(mqttBroker)
	mqttOpts.SetClientID("ota-api-server-" + fmt.Sprintf("%d", time.Now().Unix()))
	mqttOpts.SetAutoReconnect(true)
	mqttOpts.SetMaxReconnectInterval(30 * time.Second)

	// TLS config for cloud brokers (ssl:// prefix or MQTT_USE_TLS=true)
	useTLS := strings.HasPrefix(mqttBroker, "ssl://") || os.Getenv("MQTT_USE_TLS") == "true"
	if useTLS {
		mqttOpts.SetTLSConfig(&tls.Config{
			MinVersion: tls.VersionTLS12,
		})
		log.Println("[INFO] MQTT TLS enabled")
	}

	// Credentials for cloud brokers (HiveMQ requires username/password)
	if mqttUsername := os.Getenv("MQTT_USERNAME"); mqttUsername != "" {
		mqttOpts.SetUsername(mqttUsername)
		mqttOpts.SetPassword(os.Getenv("MQTT_PASSWORD"))
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

	app := fiber.New()
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(cors.New())
	app.Use(metrics.HTTPMiddleware())

	metrics.StartFleetMetricsSync(dbPool, 5*time.Second)

	deviceHandler := handlers.NewDeviceHandler(dbPool)
	firmwareHandler := handlers.NewFirmwareHandler(dbPool, minioClient, bucket)
	deploymentHandler := handlers.NewDeploymentHandler(dbPool, minioClient, bucket, myMqttClient)

	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "ota-robot-system-api",
			"health":  "/health",
			"docs":    "/api/v1/devices",
		})
	})
	app.Get("/health", func(c fiber.Ctx) error { return c.SendString("OK") })

	api := app.Group("/api/v1")
	api.Get("/devices", deviceHandler.ListDevices)
	api.Get("/devices/:id", deviceHandler.GetDevice)
	api.Post("/firmware/upload", firmwareHandler.Upload)
	api.Get("/firmware", firmwareHandler.List)
	api.Get("/firmware/:id/url", firmwareHandler.GetDownloadURL)
	api.Patch("/firmware/:id", firmwareHandler.Update)
	api.Delete("/firmware/:id", firmwareHandler.Delete)
	api.Post("/deployments", deploymentHandler.CreateDeployment)
	api.Get("/deployments", deploymentHandler.ListDeployments)
	api.Get("/deployments/:id", deploymentHandler.GetDeployment)
	api.Post("/deployments/:id/rollback", deploymentHandler.Rollback)

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
