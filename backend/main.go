package main

import (
	"context"
	"fmt"
	"log"
	"os"
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
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer dbPool.Close()

	redisUrl := os.Getenv("REDIS_URL")
	if redisUrl == "" {
		redisUrl = "redis://localhost:6379"
	}
	opt, err := redis.ParseURL(redisUrl)
	if err != nil {
		log.Fatalf("Unable to parse redis url: %v\n", err)
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	minioEndpoint := os.Getenv("MINIO_ENDPOINT")
	if minioEndpoint == "" {
		minioEndpoint = "localhost:9000"
	}
	minioClient, err := minio.New(minioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(os.Getenv("MINIO_ACCESS_KEY"), os.Getenv("MINIO_SECRET_KEY"), ""),
		Secure: os.Getenv("MINIO_USE_SSL") == "true",
	})
	if err != nil {
		log.Fatalf("Unable to connect to minio: %v\n", err)
	}
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "firmware"
	}
	exists, err := minioClient.BucketExists(context.Background(), bucket)
	if err == nil && !exists {
		minioClient.MakeBucket(context.Background(), bucket, minio.MakeBucketOptions{})
	}

	mqttBroker := os.Getenv("MQTT_BROKER")
	if mqttBroker == "" {
		mqttBroker = "tcp://localhost:1883"
	}
	mqttOpts := mqtt.NewClientOptions()
	mqttOpts.AddBroker(mqttBroker)
	mqttOpts.SetClientID("api-server-" + fmt.Sprintf("%d", time.Now().Unix()))
	mqttClient := mqtt.NewClient(mqttOpts)
	if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
		log.Fatalf("MQTT Connect error: %v", token.Error())
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

	app.Get("/health", func(c fiber.Ctx) error { return c.SendString("OK") })

	api := app.Group("/api/v1")
	api.Get("/devices", deviceHandler.ListDevices)
	api.Get("/devices/:id", deviceHandler.GetDevice)
	api.Post("/firmware/upload", firmwareHandler.Upload)
	api.Get("/firmware", firmwareHandler.List)
	api.Get("/firmware/:id/url", firmwareHandler.GetDownloadURL)
	api.Post("/deployments", deploymentHandler.CreateDeployment)
	api.Get("/deployments", deploymentHandler.ListDeployments)
	api.Get("/deployments/:id", deploymentHandler.GetDeployment)
	api.Post("/deployments/:id/rollback", deploymentHandler.Rollback)

	app.Get("/metrics", metrics.Handler())

	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8000"
	}
	log.Fatal(app.Listen(":" + port))
}
