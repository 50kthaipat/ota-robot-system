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
	"github.com/ota-robot/api/internal/rollout"
)

type Client struct {
	mqttClient mqtt.Client
	dbPool     *pgxpool.Pool
	queries    *db.Queries
	rolloutMgr *rollout.Manager
}

func NewClient(mqttClient mqtt.Client, pool *pgxpool.Pool) *Client {
	return &Client{
		mqttClient: mqttClient,
		dbPool:     pool,
		queries:    db.New(pool),
	}
}

func (c *Client) SetRolloutManager(mgr *rollout.Manager) {
	c.rolloutMgr = mgr
}

func (c *Client) Subscribe() {
	c.mqttClient.Subscribe("ota/device/+/status", 1, c.handleStatus)
	c.mqttClient.Subscribe("ota/device/+/progress", 1, c.handleProgress)
	c.mqttClient.Subscribe("ota/device/+/error", 1, c.handleError)
}

func (c *Client) handleStatus(client mqtt.Client, msg mqtt.Message) {
	var payload struct {
		DeviceID  string          `json:"device_id"`
		FactoryID string          `json:"factory_id"`
		HwModel   string          `json:"hw_model"`
		Version   string          `json:"version"`
		Status    string          `json:"status"`
		FsmState  string          `json:"fsm_state"`
		Telemetry json.RawMessage `json:"telemetry"`
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

	// Update metadata JSON with telemetry and FSM state
	var metaMap map[string]interface{}
	if len(payload.Telemetry) > 0 && string(payload.Telemetry) != "null" {
		_ = json.Unmarshal(payload.Telemetry, &metaMap)
	}
	if metaMap == nil {
		metaMap = make(map[string]interface{})
	}
	if payload.FsmState != "" {
		metaMap["fsm_state"] = payload.FsmState
	}

	if len(metaMap) > 0 {
		metaBytes, err := json.Marshal(metaMap)
		if err == nil {
			_, _ = c.dbPool.Exec(context.Background(), "UPDATE devices SET metadata = $1 WHERE id = $2", metaBytes, payload.DeviceID)
		}
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

	if c.rolloutMgr != nil {
		if err := c.rolloutMgr.HandleDeviceProgress(context.Background(), rollout.DeviceProgressEvent{
			DeviceID: payload.DeviceID,
			Status:   payload.Status,
			Progress: payload.Progress,
		}); err != nil {
			log.Printf("[mqtt] rollout HandleDeviceProgress notice: %v", err)
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

	if c.rolloutMgr != nil {
		if err := c.rolloutMgr.HandleDeviceError(context.Background(), rollout.DeviceErrorEvent{
			DeviceID: payload.DeviceID,
			Error:    payload.Error,
		}); err != nil {
			log.Printf("[mqtt] rollout HandleDeviceError notice: %v", err)
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
