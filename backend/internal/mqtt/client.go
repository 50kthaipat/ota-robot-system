package mqtt

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	db "github.com/ota-robot/api/internal/db/generated"
)

type Client struct {
	mqttClient mqtt.Client
	dbPool     *pgxpool.Pool
	queries    *db.Queries
}

func NewClient(mqttClient mqtt.Client, pool *pgxpool.Pool) *Client {
	return &Client{
		mqttClient: mqttClient,
		dbPool:     pool,
		queries:    db.New(pool),
	}
}

func (c *Client) Subscribe() {
	c.mqttClient.Subscribe("ota/device/+/status", 1, c.handleStatus)
	c.mqttClient.Subscribe("ota/device/+/progress", 1, c.handleProgress)
	c.mqttClient.Subscribe("ota/device/+/error", 1, c.handleError)
}

func (c *Client) handleStatus(client mqtt.Client, msg mqtt.Message) {
	var payload struct {
		DeviceID  string `json:"device_id"`
		FactoryID string `json:"factory_id"`
		HwModel   string `json:"hw_model"`
		Version   string `json:"version"`
		Status    string `json:"status"`
	}
	if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
		log.Printf("error parsing status: %v", err)
		return
	}

	ipAddress := "0.0.0.0"
	model := payload.HwModel
	if model == "" {
		model = "sim-v1"
	}
	
	_, err := c.queries.UpsertDevice(context.Background(), db.UpsertDeviceParams{
		ID:             payload.DeviceID,
		Name:           payload.DeviceID,
		FactoryID:      payload.FactoryID,
		HwModel:        model,
		CurrentVersion: payload.Version,
		Status:         payload.Status,
		IpAddress:      pgtype.Text{String: ipAddress, Valid: true},
	})
	if err != nil {
		log.Printf("error upserting device: %v", err)
	}
}

func (c *Client) handleProgress(client mqtt.Client, msg mqtt.Message) {
	log.Printf("Progress Update on %s: %s", msg.Topic(), string(msg.Payload()))
	var payload struct {
		DeviceID string `json:"device_id"`
		Progress int32  `json:"progress"`
		Status   string `json:"status"`
	}
	if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
		log.Printf("error parsing progress: %v", err)
		return
	}

	ctx := context.Background()
	activeDD, err := c.queries.GetActiveDeploymentDeviceByDevice(ctx, payload.DeviceID)
	if err != nil {
		return
	}

	// If this unit already reached terminal state, do not overwrite or duplicate count
	if activeDD.Status == "success" || activeDD.Status == "failed" {
		return
	}

	_, _ = c.queries.UpdateDeploymentDeviceStatus(ctx, db.UpdateDeploymentDeviceStatusParams{
		DeploymentID: activeDD.DeploymentID,
		DeviceID:     payload.DeviceID,
		Status:       payload.Status,
		Progress:     payload.Progress,
		ErrorMessage: pgtype.Text{Valid: false},
	})

	if payload.Status == "success" && payload.Progress == 100 {
		_ = c.queries.IncrementDeploymentSuccess(ctx, activeDD.DeploymentID)
		dep, err := c.queries.GetDeployment(ctx, activeDD.DeploymentID)
		if err == nil {
			fw, err := c.queries.GetFirmwareVersion(ctx, dep.FirmwareVersionID)
			if err == nil {
				_, _ = c.queries.UpdateDeviceVersion(ctx, db.UpdateDeviceVersionParams{
					ID:             payload.DeviceID,
					CurrentVersion: fw.Version,
				})
			}
			if dep.SuccessCount+dep.FailureCount >= dep.TotalDevices {
				_, _ = c.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
					ID:     activeDD.DeploymentID,
					Status: "completed",
				})
			}
		}
	}
}

func (c *Client) handleError(client mqtt.Client, msg mqtt.Message) {
	log.Printf("Error Update on %s: %s", msg.Topic(), string(msg.Payload()))
	var payload struct {
		DeviceID string `json:"device_id"`
		Error    string `json:"error"`
	}
	if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
		log.Printf("error parsing error message: %v", err)
		return
	}

	ctx := context.Background()
	activeDD, err := c.queries.GetActiveDeploymentDeviceByDevice(ctx, payload.DeviceID)
	if err != nil {
		return
	}

	if activeDD.Status == "success" || activeDD.Status == "failed" {
		return
	}

	_, _ = c.queries.UpdateDeploymentDeviceStatus(ctx, db.UpdateDeploymentDeviceStatusParams{
		DeploymentID: activeDD.DeploymentID,
		DeviceID:     payload.DeviceID,
		Status:       "failed",
		Progress:     activeDD.Progress,
		ErrorMessage: pgtype.Text{String: payload.Error, Valid: true},
	})
	_ = c.queries.IncrementDeploymentFailure(ctx, activeDD.DeploymentID)

	dep, err := c.queries.GetDeployment(ctx, activeDD.DeploymentID)
	if err == nil {
		failureRate := float64(dep.FailureCount) / float64(dep.TotalDevices)
		if dep.Status == "running" && failureRate >= dep.RollbackThreshold {
			log.Printf("[AUTO-ROLLBACK TRIGGERED] Deployment %v failure rate %.2f breached threshold %.2f", dep.ID, failureRate, dep.RollbackThreshold)
			_, _ = c.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
				ID:     dep.ID,
				Status: "rolled_back",
			})
			devs, err := c.queries.ListDeploymentDevices(ctx, dep.ID)
			if err == nil {
				for _, d := range devs {
					prevVer := "1.0.0"
					if d.PreviousVersion.Valid && d.PreviousVersion.String != "" {
						prevVer = d.PreviousVersion.String
					}
					rollbackCmd := map[string]string{
						"action":  "rollback",
						"version": prevVer,
					}
					_ = c.PublishCommand(d.DeviceID, rollbackCmd)
				}
			}
			return
		}

		if dep.SuccessCount+dep.FailureCount >= dep.TotalDevices {
			_, _ = c.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
				ID:     activeDD.DeploymentID,
				Status: "completed",
			})
		}
	}
}

func (c *Client) PublishCommand(deviceID string, cmd interface{}) error {
	payload, err := json.Marshal(cmd)
	if err != nil {
		return err
	}
	topic := fmt.Sprintf("ota/device/%s/command", deviceID)
	token := c.mqttClient.Publish(topic, 1, false, payload)
	token.Wait()
	return token.Error()
}
