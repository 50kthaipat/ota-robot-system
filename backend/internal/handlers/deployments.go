package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	db "github.com/ota-robot/api/internal/db/generated"
	mymqtt "github.com/ota-robot/api/internal/mqtt"
	"github.com/ota-robot/api/internal/orchestrator"
)

type DeploymentHandler struct {
	db                 *pgxpool.Pool
	queries            *db.Queries
	minio              *minio.Client
	bucket             string
	mqttClient         *mymqtt.Client
	canaryOrchestrator *orchestrator.CanaryOrchestrator
}

func NewDeploymentHandler(pool *pgxpool.Pool, mc *minio.Client, bucket string, mqttClient *mymqtt.Client) *DeploymentHandler {
	queries := db.New(pool)
	return &DeploymentHandler{
		db:                 pool,
		queries:            queries,
		minio:              mc,
		bucket:             bucket,
		mqttClient:         mqttClient,
		canaryOrchestrator: orchestrator.NewCanaryOrchestrator(queries, mqttClient),
	}
}

type CreateDeploymentRequest struct {
	FirmwareID        string   `json:"firmware_id"`
	Strategy          string   `json:"strategy"`
	HwModel           string   `json:"hw_model"`
	DeviceIDs         []string `json:"device_ids"`
	RollbackThreshold float64  `json:"rollback_threshold"`
}

func (h *DeploymentHandler) CreateDeployment(c fiber.Ctx) error {
	var req CreateDeploymentRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body: " + err.Error()})
	}

	fwUUID, err := uuid.Parse(req.FirmwareID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid firmware_id UUID"})
	}

	ctx := c.Context()
	fw, err := h.queries.GetFirmwareVersion(ctx, pgtype.UUID{Bytes: fwUUID, Valid: true})
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "firmware version not found"})
	}

	presignedURL, err := h.minio.PresignedGetObject(context.Background(), h.bucket, fw.StorageKey, 30*time.Minute, nil)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate download URL: " + err.Error()})
	}

	strategy := req.Strategy
	if strategy == "" {
		strategy = "full"
	}

	threshold := req.RollbackThreshold
	if threshold <= 0 {
		threshold = 0.20
	}

	targetHw := req.HwModel
	if targetHw == "" {
		targetHw = "all"
	}

	var targetDevices []db.Device
	if len(req.DeviceIDs) > 0 {
		for _, devID := range req.DeviceIDs {
			dev, err := h.queries.GetDevice(ctx, devID)
			if err != nil {
				continue
			}
			// Enforce hardware-model compatibility if deployment specifies a target model
			if targetHw != "all" && dev.HwModel != targetHw {
				return c.Status(400).JSON(fiber.Map{
					"error": fmt.Sprintf("device %s has incompatible hardware model %s for deployment target %s", dev.ID, dev.HwModel, targetHw),
				})
			}
			targetDevices = append(targetDevices, dev)
		}
	} else {
		allDevs, err := h.queries.ListDevices(ctx)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to list devices"})
		}
		for _, dev := range allDevs {
			if dev.Status == "online" {
				// Filter to only compatible online devices
				if targetHw == "all" || dev.HwModel == targetHw {
					targetDevices = append(targetDevices, dev)
				}
			}
		}
	}

	if len(targetDevices) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "no eligible target devices found matching hardware model"})
	}

	initPercentage := int32(100)
	if strategy == "canary" {
		initPercentage = 20
	}

	dep, err := h.queries.CreateDeployment(ctx, db.CreateDeploymentParams{
		FirmwareVersionID: fw.ID,
		Strategy:          strategy,
		CanaryPercentage:  initPercentage,
		TotalDevices:      int32(len(targetDevices)),
		RollbackThreshold: threshold,
		CreatedBy:         pgtype.Text{String: "operator", Valid: true},
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create deployment: " + err.Error()})
	}

	_, _ = h.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
		ID:     dep.ID,
		Status: "running",
	})

	for _, dev := range targetDevices {
		_, _ = h.queries.CreateDeploymentDevice(ctx, db.CreateDeploymentDeviceParams{
			DeploymentID:    dep.ID,
			DeviceID:        dev.ID,
			PreviousVersion: pgtype.Text{String: dev.CurrentVersion, Valid: true},
		})
	}

	cmd := map[string]string{
		"action":          "update",
		"version":         fw.Version,
		"hw_model":        targetHw,
		"download_url":    presignedURL.String(),
		"sha256_checksum": fw.Sha256Checksum,
		"signature":       fw.EcdsaSignature.String,
	}

	if strategy == "canary" {
		go h.canaryOrchestrator.Run(dep.ID, targetDevices, cmd)
	} else {
		for _, dev := range targetDevices {
			_ = h.mqttClient.PublishCommand(dev.ID, cmd)
		}
	}

	return c.Status(201).JSON(fiber.Map{
		"id":            dep.ID,
		"status":        "running",
		"total_devices": len(targetDevices),
		"strategy":      strategy,
	})
}

func (h *DeploymentHandler) GetDeployment(c fiber.Ctx) error {
	idStr := c.Params("id")
	depUUID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid deployment UUID"})
	}

	ctx := c.Context()
	dep, err := h.queries.GetDeployment(ctx, pgtype.UUID{Bytes: depUUID, Valid: true})
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "deployment not found"})
	}

	devs, err := h.queries.ListDeploymentDevices(ctx, dep.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var targetVersion string
	fw, err := h.queries.GetFirmwareVersion(ctx, dep.FirmwareVersionID)
	if err == nil {
		targetVersion = fw.Version
	}

	// Self-healing reconciliation: if all target devices succeeded/failed, ensure marked completed
	if dep.TotalDevices > 0 && (dep.SuccessCount+dep.FailureCount >= dep.TotalDevices) && dep.Status != "rolled_back" && dep.Status != "failed" {
		if dep.Status != "completed" {
			_, _ = h.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
				ID:     dep.ID,
				Status: "completed",
			})
			dep.Status = "completed"
		}
		if dep.Strategy == "canary" && dep.CurrentPhase < 3 {
			_, _ = h.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
				ID:               dep.ID,
				CurrentPhase:     3,
				CanaryPercentage: 100,
			})
			dep.CurrentPhase = 3
			dep.CanaryPercentage = 100
		}
	}

	return c.JSON(fiber.Map{
		"deployment":     dep,
		"devices":        devs,
		"target_version": targetVersion,
	})
}

func (h *DeploymentHandler) ListDeployments(c fiber.Ctx) error {
	ctx := c.Context()
	deps, err := h.queries.ListDeployments(ctx, 50)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	type DeploymentWithFW struct {
		db.Deployment
		FirmwareVersion string `json:"firmware_version"`
	}

	result := make([]DeploymentWithFW, 0, len(deps))
	for _, d := range deps {
		// Self-healing reconciliation for list view
		if d.TotalDevices > 0 && (d.SuccessCount+d.FailureCount >= d.TotalDevices) && d.Status != "rolled_back" && d.Status != "failed" {
			if d.Status != "completed" {
				_, _ = h.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
					ID:     d.ID,
					Status: "completed",
				})
				d.Status = "completed"
			}
			if d.Strategy == "canary" && d.CurrentPhase < 3 {
				_, _ = h.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
					ID:               d.ID,
					CurrentPhase:     3,
					CanaryPercentage: 100,
				})
				d.CurrentPhase = 3
				d.CanaryPercentage = 100
			}
		}

		fwVer := ""
		fw, err := h.queries.GetFirmwareVersion(ctx, d.FirmwareVersionID)
		if err == nil {
			fwVer = fw.Version
		}
		result = append(result, DeploymentWithFW{
			Deployment:      d,
			FirmwareVersion: fwVer,
		})
	}
	return c.JSON(fiber.Map{"data": result})
}

func (h *DeploymentHandler) Rollback(c fiber.Ctx) error {
	idStr := c.Params("id")
	depUUID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid deployment UUID"})
	}

	ctx := c.Context()
	dep, err := h.queries.GetDeployment(ctx, pgtype.UUID{Bytes: depUUID, Valid: true})
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "deployment not found"})
	}

	devs, err := h.queries.ListDeploymentDevices(ctx, dep.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	for _, d := range devs {
		prevVer := "1.0.0"
		if d.PreviousVersion.Valid && d.PreviousVersion.String != "" {
			prevVer = d.PreviousVersion.String
		}
		cmd := map[string]string{
			"action":  "rollback",
			"version": prevVer,
		}
		_ = h.mqttClient.PublishCommand(d.DeviceID, cmd)
	}

	_, _ = h.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
		ID:     dep.ID,
		Status: "rolled_back",
	})

	return c.JSON(fiber.Map{"status": "rolled_back", "deployment_id": dep.ID})
}



