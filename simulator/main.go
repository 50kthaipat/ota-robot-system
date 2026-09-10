package main

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/ota-robot/robot-sim/internal/agent"
)

const defaultPublicKeyPEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElEKlesPvGKyGFI2RwpJsfqXxqKBA
hkeZCoqleIU8Ix6uE5NVhG7KAtIVTcO3ylWXNO4qxiTJvhyMEA73jEgheg==
-----END PUBLIC KEY-----`

var (
	deviceID          string
	factoryID         string
	hwModel           string
	currentVersion    = "1.0.0"
	status            = "online"
	ecdsaPubKey       *ecdsa.PublicKey
	agentStateMachine *agent.StateMachine
)

type StatusUpdate struct {
	DeviceID  string `json:"device_id"`
	FactoryID string `json:"factory_id"`
	HwModel   string `json:"hw_model"`
	Version   string `json:"version"`
	Status    string `json:"status"`
	FsmState  string `json:"fsm_state"`
	Timestamp string `json:"timestamp"`
}

type Command struct {
	Action         string `json:"action"`
	Version        string `json:"version"`
	HwModel        string `json:"hw_model"`
	DownloadURL    string `json:"download_url"`
	Sha256Checksum string `json:"sha256_checksum"`
	Signature      string `json:"signature"`
}

type ProgressUpdate struct {
	DeviceID string `json:"device_id"`
	Progress int    `json:"progress"`
	Status   string `json:"status"`
}

func main() {
	_ = godotenv.Load("../../.env")

	ecdsaPubKey = loadPublicKey()

	prefix := os.Getenv("DEVICE_ID_PREFIX")
	if prefix == "" {
		prefix = "robot"
	}
	factoryID = os.Getenv("FACTORY_ID")
	if factoryID == "" {
		factoryID = "factory-local"
	}
	hwModel = os.Getenv("HW_MODEL")
	if hwModel == "" {
		hwModel = "sim-v1"
	}
	deviceID = os.Getenv("DEVICE_ID")
	if deviceID == "" {
		deviceID = fmt.Sprintf("%s-%s", prefix, uuid.New().String()[:8])
	}

	agentStateMachine = agent.NewStateMachine(deviceID, func(from, to agent.State, event agent.Event) {
		log.Printf("Robot %s: FSM transition [%s] -> [%s] on event (%s)", deviceID, from, to, event)
	})
	if err := agentStateMachine.Trigger(agent.EventBootOK); err != nil {
		log.Printf("Robot %s: FSM boot trigger error: %v", deviceID, err)
	}

	broker := strings.TrimSpace(os.Getenv("MQTT_BROKER"))
	if broker == "" {
		broker = "tcp://emqx:1883"
	}
	if !strings.Contains(broker, "://") {
		if strings.Contains(broker, "8883") || strings.Contains(broker, "hivemq") {
			broker = "ssl://" + broker
		} else {
			broker = "tcp://" + broker
		}
	}

	opts := mqtt.NewClientOptions()
	opts.AddBroker(broker)
	opts.SetClientID(deviceID)
	opts.SetAutoReconnect(true)
	opts.SetMaxReconnectInterval(30 * time.Second)

	// TLS for cloud brokers (HiveMQ Cloud uses ssl://)
	if strings.HasPrefix(broker, "ssl://") || strings.HasPrefix(broker, "tls://") || os.Getenv("MQTT_USE_TLS") == "true" {
		serverHost := ""
		if u, err := url.Parse(broker); err == nil {
			serverHost = u.Hostname()
		}
		opts.SetTLSConfig(&tls.Config{
			MinVersion: tls.VersionTLS12,
			ServerName: serverHost,
		})
		log.Printf("Robot %s: MQTT TLS enabled (SNI: %s)", deviceID, serverHost)
	}

	// Credentials for cloud brokers
	if mqttUser := strings.TrimSpace(os.Getenv("MQTT_USERNAME")); mqttUser != "" {
		opts.SetUsername(mqttUser)
		opts.SetPassword(strings.TrimSpace(os.Getenv("MQTT_PASSWORD")))
		log.Printf("Robot %s: MQTT authenticating as user: %s", deviceID, mqttUser)
	}

	var messagePubHandler mqtt.MessageHandler = func(client mqtt.Client, msg mqtt.Message) {
		log.Printf("Received message: %s from topic: %s\n", msg.Payload(), msg.Topic())
		var cmd Command
		if err := json.Unmarshal(msg.Payload(), &cmd); err != nil {
			log.Printf("Failed to parse command: %v", err)
			return
		}

		if cmd.Action == "update" {
			go handleUpdate(client, cmd)
		} else if cmd.Action == "rollback" {
			go handleRollback(client, cmd)
		}
	}

	opts.SetDefaultPublishHandler(messagePubHandler)

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		log.Fatalf("Error connecting to MQTT: %v", token.Error())
	}

	topic := fmt.Sprintf("ota/device/%s/command", deviceID)
	if token := client.Subscribe(topic, 1, nil); token.Wait() && token.Error() != nil {
		log.Fatalf("Error subscribing: %v", token.Error())
	}

	log.Printf("Robot %s started. Connected to %s [FSM: %s]", deviceID, broker, agentStateMachine.GetState())

	go func() {
		for {
			update := StatusUpdate{
				DeviceID:  deviceID,
				FactoryID: factoryID,
				HwModel:   hwModel,
				Version:   currentVersion,
				Status:    status,
				FsmState:  string(agentStateMachine.GetState()),
				Timestamp: time.Now().Format(time.RFC3339),
			}
			payload, _ := json.Marshal(update)
			client.Publish(fmt.Sprintf("ota/device/%s/status", deviceID), 1, false, payload)
			time.Sleep(5 * time.Second)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down...")
	client.Disconnect(250)
}

func handleUpdate(client mqtt.Client, cmd Command) {
	if err := agentStateMachine.Trigger(agent.EventUpdateCommand); err != nil {
		log.Printf("Robot %s: FSM rejected update command in state %s: %v", deviceID, agentStateMachine.GetState(), err)
		publishError(client, fmt.Sprintf("invalid agent state for update: %s", agentStateMachine.GetState()))
		return
	}

	// 1. Hardware Model Compatibility Check
	if cmd.HwModel != "" && cmd.HwModel != "all" && cmd.HwModel != hwModel {
		log.Printf("Robot %s: Incompatible hardware model (device: %s, target: %s)", deviceID, hwModel, cmd.HwModel)
		_ = agentStateMachine.Trigger(agent.EventVerifyFail)
		publishError(client, fmt.Sprintf("incompatible hardware model: robot is %s, update requires %s", hwModel, cmd.HwModel))
		time.Sleep(200 * time.Millisecond)
		_ = agentStateMachine.Trigger(agent.EventReset)
		status = "online"
		return
	}

	// 2. Zero-Trust Cryptographic Key Check (Fail-closed)
	if ecdsaPubKey == nil {
		log.Printf("Robot %s: Update rejected - Root of Trust public key unavailable (fail-closed Zero-Trust policy)", deviceID)
		_ = agentStateMachine.Trigger(agent.EventVerifyFail)
		publishError(client, "cryptographic verification failed: root of trust public key unavailable (fail-closed)")
		time.Sleep(200 * time.Millisecond)
		_ = agentStateMachine.Trigger(agent.EventReset)
		status = "online"
		return
	}

	status = "updating"
	publishProgressWithMeta(client, 0, "downloading", map[string]interface{}{
		"fsm_state": string(agentStateMachine.GetState()),
	})

	resp, err := http.Get(cmd.DownloadURL)
	if err != nil {
		_ = agentStateMachine.Trigger(agent.EventDownloadFail)
		publishError(client, "download failed")
		time.Sleep(200 * time.Millisecond)
		_ = agentStateMachine.Trigger(agent.EventReset)
		status = "online"
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		_ = agentStateMachine.Trigger(agent.EventDownloadFail)
		publishError(client, fmt.Sprintf("download failed: HTTP %d", resp.StatusCode))
		time.Sleep(200 * time.Millisecond)
		_ = agentStateMachine.Trigger(agent.EventReset)
		status = "online"
		return
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		_ = agentStateMachine.Trigger(agent.EventDownloadFail)
		publishError(client, "read failed")
		time.Sleep(200 * time.Millisecond)
		_ = agentStateMachine.Trigger(agent.EventReset)
		status = "online"
		return
	}

	if err := agentStateMachine.Trigger(agent.EventDownloadOK); err != nil {
		log.Printf("Robot %s: FSM download OK error: %v", deviceID, err)
	}

	hash := sha256.Sum256(data)
	hashStr := fmt.Sprintf("%x", hash)
	if hashStr != cmd.Sha256Checksum {
		_ = agentStateMachine.Trigger(agent.EventVerifyFail)
		publishError(client, "checksum mismatch")
		time.Sleep(200 * time.Millisecond)
		_ = agentStateMachine.Trigger(agent.EventReset)
		status = "online"
		return
	}

	// Verify ECDSA P-256 signature — timed for thesis Section 4.2
	if cmd.Signature == "" {
		log.Printf("Robot %s: Update rejected - Missing cryptographic signature", deviceID)
		_ = agentStateMachine.Trigger(agent.EventVerifyFail)
		publishError(client, "missing firmware signature")
		time.Sleep(200 * time.Millisecond)
		_ = agentStateMachine.Trigger(agent.EventReset)
		status = "online"
		return
	}
	t0Ecdsa := time.Now()
	valid := verifyECDSASignature(ecdsaPubKey, hashStr, cmd.Signature)
	ecdsaMs := time.Since(t0Ecdsa).Milliseconds()
	log.Printf("Robot %s: ECDSA verification took %d ms", deviceID, ecdsaMs)

	if !valid {
		log.Printf("Robot %s: Update rejected - Cryptographic signature mismatch! (verified in %d ms)", deviceID, ecdsaMs)
		_ = agentStateMachine.Trigger(agent.EventVerifyFail)
		publishError(client, fmt.Sprintf("ecdsa signature verification failed (overhead: %d ms)", ecdsaMs))
		time.Sleep(200 * time.Millisecond)
		_ = agentStateMachine.Trigger(agent.EventReset)
		status = "online"
		return
	}
	log.Printf("Robot %s: ECDSA signature verified successfully (%d ms).", deviceID, ecdsaMs)

	if err := agentStateMachine.Trigger(agent.EventVerifyOK); err != nil {
		log.Printf("Robot %s: FSM verify OK error: %v", deviceID, err)
	}

	// Publish detailed progress with ECDSA timing metadata and FSM state
	publishProgressWithMeta(client, 20, "verified", map[string]interface{}{
		"ecdsa_verify_ms":  ecdsaMs,
		"sha256_verify_ms": time.Since(t0Ecdsa).Milliseconds(),
		"fsm_state":        string(agentStateMachine.GetState()),
	})

	for i := 25; i <= 75; i += 25 {
		time.Sleep(1 * time.Second)
		publishProgressWithMeta(client, i, "installing", map[string]interface{}{
			"fsm_state": string(agentStateMachine.GetState()),
		})
	}

	failOnVer := os.Getenv("FAIL_ON_VERSION")
	if (failOnVer != "" && cmd.Version == failOnVer) || (os.Getenv("SIMULATE_FAILURE") == "true") {
		_ = agentStateMachine.Trigger(agent.EventInstallFail)
		publishError(client, "hardware flashing fault (simulated)")
		status = "error"
		return
	}

	// Controlled random failure rate via ENV (default 0 = disabled for clean experiments)
	failRateStr := os.Getenv("RANDOM_FAILURE_RATE")
	if failRateStr != "" {
		var failRate float64
		if _, err := fmt.Sscanf(failRateStr, "%f", &failRate); err == nil && failRate > 0 {
			if rand.Float32() < float32(failRate) {
				_ = agentStateMachine.Trigger(agent.EventInstallFail)
				publishError(client, fmt.Sprintf("installation failed randomly (rate=%.2f)", failRate))
				status = "error"
				return
			}
		}
	}

	publishProgressWithMeta(client, 90, "installing", map[string]interface{}{
		"fsm_state": string(agentStateMachine.GetState()),
	})
	time.Sleep(1 * time.Second)

	if err := agentStateMachine.Trigger(agent.EventInstallOK); err != nil {
		log.Printf("Robot %s: FSM install OK error: %v", deviceID, err)
	}

	// Simulated reboot phase
	time.Sleep(500 * time.Millisecond)
	if err := agentStateMachine.Trigger(agent.EventRebootOK); err != nil {
		log.Printf("Robot %s: FSM reboot OK error: %v", deviceID, err)
	}

	currentVersion = cmd.Version
	status = "online"
	publishProgressWithMeta(client, 100, "success", map[string]interface{}{
		"fsm_state": string(agentStateMachine.GetState()),
	})
}

func handleRollback(client mqtt.Client, cmd Command) {
	status = "updating"
	if err := agentStateMachine.Trigger(agent.EventRollbackCommand); err != nil {
		log.Printf("Robot %s: FSM rollback command trigger warning: %v", deviceID, err)
	}
	publishProgressWithMeta(client, 50, "rolling_back", map[string]interface{}{
		"fsm_state": string(agentStateMachine.GetState()),
	})

	// Simulated dual-slot recovery reboot
	time.Sleep(2 * time.Second)

	if err := agentStateMachine.Trigger(agent.EventRollbackComplete); err != nil {
		log.Printf("Robot %s: FSM rollback complete trigger warning: %v", deviceID, err)
	}
	currentVersion = cmd.Version
	status = "online"
	publishProgressWithMeta(client, 100, "success", map[string]interface{}{
		"fsm_state": string(agentStateMachine.GetState()),
	})
}

func publishProgress(client mqtt.Client, progress int, state string) {
	update := ProgressUpdate{
		DeviceID: deviceID,
		Progress: progress,
		Status:   state,
	}
	payload, _ := json.Marshal(update)
	client.Publish(fmt.Sprintf("ota/device/%s/progress", deviceID), 1, false, payload)
}

// publishProgressWithMeta publishes a progress update with additional metadata
// fields merged into the JSON payload (e.g., ecdsa_verify_ms for Section 4.2).
func publishProgressWithMeta(client mqtt.Client, progress int, state string, meta map[string]interface{}) {
	payload := map[string]interface{}{
		"device_id": deviceID,
		"progress":  progress,
		"status":    state,
	}
	for k, v := range meta {
		payload[k] = v
	}
	data, _ := json.Marshal(payload)
	client.Publish(fmt.Sprintf("ota/device/%s/progress", deviceID), 1, false, data)
}

func publishError(client mqtt.Client, errMsg string) {
	payload := map[string]string{
		"device_id": deviceID,
		"error":     errMsg,
	}
	data, _ := json.Marshal(payload)
	client.Publish(fmt.Sprintf("ota/device/%s/error", deviceID), 1, false, data)
}

func loadPublicKey() *ecdsa.PublicKey {
	paths := []string{
		os.Getenv("ECDSA_PUBLIC_KEY_PATH"),
		"/app/keys/public.pem",
		"./keys/public.pem",
		"../../keys/public.pem",
	}

	var data []byte
	for _, p := range paths {
		if p == "" {
			continue
		}
		if b, err := os.ReadFile(p); err == nil && len(b) > 0 {
			data = b
			log.Printf("Loaded ECDSA public key from %s", p)
			break
		}
	}

	if len(data) == 0 {
		data = []byte(defaultPublicKeyPEM)
		log.Printf("Using embedded default ECDSA public key")
	}

	block, _ := pem.Decode(data)
	if block == nil {
		log.Printf("Warning: failed to decode PEM block for public key")
		return nil
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		log.Printf("Warning: failed to parse PKIX public key: %v", err)
		return nil
	}
	ecdsaPub, ok := pub.(*ecdsa.PublicKey)
	if !ok {
		log.Printf("Warning: parsed key is not ECDSA public key")
		return nil
	}
	return ecdsaPub
}

func verifyECDSASignature(pub *ecdsa.PublicKey, sha256Hex, signatureB64 string) bool {
	if pub == nil {
		return false
	}
	hashBytes, err := hex.DecodeString(sha256Hex)
	if err != nil {
		return false
	}
	sigBytes, err := base64.StdEncoding.DecodeString(signatureB64)
	if err != nil {
		return false
	}
	return ecdsa.VerifyASN1(pub, hashBytes, sigBytes)
}

