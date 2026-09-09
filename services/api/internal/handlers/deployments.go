package handlers

import (
	"context"
	"log"
	"math"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	db "github.com/ota-robot/api/internal/db/generated"
	mymqtt "github.com/ota-robot/api/internal/mqtt"
)

type DeploymentHandler struct {
	db         *pgxpool.Pool
	queries    *db.Queries
	minio      *minio.Client
	bucket     string
	mqttClient *mymqtt.Client
}

func NewDeploymentHandler(pool *pgxpool.Pool, mc *minio.Client, bucket string, mqttClient *mymqtt.Client) *DeploymentHandler {
	return &DeploymentHandler{
		db:         pool,
		queries:    db.New(pool),
		minio:      mc,
		bucket:     bucket,
		mqttClient: mqttClient,
	}
}

type CreateDeploymentRequest struct {
	FirmwareID        string   `json:"firmware_id"`
	Strategy          string   `json:"strategy"`
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

	var targetDevices []db.Device
	if len(req.DeviceIDs) > 0 {
		for _, devID := range req.DeviceIDs {
			dev, err := h.queries.GetDevice(ctx, devID)
			if err == nil {
				targetDevices = append(targetDevices, dev)
			}
		}
	} else {
		allDevs, err := h.queries.ListDevices(ctx)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to list devices"})
		}
		for _, dev := range allDevs {
			if dev.Status == "online" {
				targetDevices = append(targetDevices, dev)
			}
		}
	}

	if len(targetDevices) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "no eligible target devices found"})
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
		"download_url":    presignedURL.String(),
		"sha256_checksum": fw.Sha256Checksum,
		"signature":       fw.EcdsaSignature.String,
	}

	if strategy == "canary" {
		go h.runCanaryRollout(dep.ID, targetDevices, cmd)
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

func (h *DeploymentHandler) runCanaryRollout(depID pgtype.UUID, devices []db.Device, cmd map[string]string) {
	n := len(devices)
	if n == 0 {
		return
	}

	// Calculate slice bounds
	// Phase 1: 20% (min 1)
	p1End := int(math.Ceil(float64(n) * 0.20))
	if p1End < 1 {
		p1End = 1
	}
	if p1End > n {
		p1End = n
	}

	// Phase 2: up to 60%
	p2End := int(math.Ceil(float64(n) * 0.60))
	if p2End <= p1End && p1End < n {
		p2End = p1End + 1
	}
	if p2End > n {
		p2End = n
	}

	phases := []struct {
		phaseNum   int32
		percentage int32
		devices    []db.Device
	}{
		{phaseNum: 1, percentage: 20, devices: devices[:p1End]},
		{phaseNum: 2, percentage: 60, devices: devices[p1End:p2End]},
		{phaseNum: 3, percentage: 100, devices: devices[p2End:]},
	}

	for _, p := range phases {
		if len(p.devices) == 0 {
			continue
		}

		ctx := context.Background()
		// Check if deployment is still running
		curDep, err := h.queries.GetDeployment(ctx, depID)
		if err != nil || curDep.Status != "running" {
			log.Printf("Canary rollout for %v stopped at Phase %d because status is %s", depID, p.phaseNum, curDep.Status)
			return
		}

		// Update phase in DB
		_, _ = h.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
			ID:               depID,
			CurrentPhase:     p.phaseNum,
			CanaryPercentage: p.percentage,
		})
		log.Printf("Canary rollout %v entering Phase %d (%d%%) with %d devices", depID, p.phaseNum, p.percentage, len(p.devices))

		// Dispatch command to this phase's devices
		for _, dev := range p.devices {
			_ = h.mqttClient.PublishCommand(dev.ID, cmd)
		}

		// If this is the last phase, no need to wait for next phase
		if p.phaseNum == 3 || p2End == n && p.phaseNum == 2 {
			break
		}

		// Observation wait window (15 seconds)
		for i := 0; i < 15; i++ {
			time.Sleep(1 * time.Second)
			checkDep, err := h.queries.GetDeployment(ctx, depID)
			if err != nil || checkDep.Status != "running" {
				log.Printf("Canary rollout %v halted during Phase %d observation window (status: %s)", depID, p.phaseNum, checkDep.Status)
				return
			}
		}
	}
}

