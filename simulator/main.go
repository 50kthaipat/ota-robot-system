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
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

const defaultPublicKeyPEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElEKlesPvGKyGFI2RwpJsfqXxqKBA
hkeZCoqleIU8Ix6uE5NVhG7KAtIVTcO3ylWXNO4qxiTJvhyMEA73jEgheg==
-----END PUBLIC KEY-----`

var (
	deviceID       string
	factoryID      string
	hwModel        string
	currentVersion = "1.0.0"
	status         = "online"
	ecdsaPubKey    *ecdsa.PublicKey
)

type StatusUpdate struct {
	DeviceID  string `json:"device_id"`
	FactoryID string `json:"factory_id"`
	HwModel   string `json:"hw_model"`
	Version   string `json:"version"`
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

type Command struct {
	Action         string `json:"action"`
	Version        string `json:"version"`
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
	deviceID = fmt.Sprintf("%s-%s", prefix, uuid.New().String()[:8])

	broker := os.Getenv("MQTT_BROKER")
	if broker == "" {
		broker = "tcp://emqx:1883"
	}

	opts := mqtt.NewClientOptions()
	opts.AddBroker(broker)
	opts.SetClientID(deviceID)
	opts.SetAutoReconnect(true)
	opts.SetMaxReconnectInterval(30 * time.Second)

	// TLS for cloud brokers (HiveMQ Cloud uses ssl://)
	if strings.HasPrefix(broker, "ssl://") || os.Getenv("MQTT_USE_TLS") == "true" {
		opts.SetTLSConfig(&tls.Config{MinVersion: tls.VersionTLS12})
		log.Printf("Robot %s: MQTT TLS enabled", deviceID)
	}

	// Credentials for cloud brokers
	if mqttUser := os.Getenv("MQTT_USERNAME"); mqttUser != "" {
		opts.SetUsername(mqttUser)
		opts.SetPassword(os.Getenv("MQTT_PASSWORD"))
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

	log.Printf("Robot %s started. Connected to %s", deviceID, broker)

	go func() {
		for {
			update := StatusUpdate{
				DeviceID:  deviceID,
				FactoryID: factoryID,
				HwModel:   hwModel,
				Version:   currentVersion,
				Status:    status,
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
	status = "updating"
	publishProgress(client, 0, "downloading")

	resp, err := http.Get(cmd.DownloadURL)
	if err != nil {
		publishError(client, "download failed")
		status = "online"
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		publishError(client, fmt.Sprintf("download failed: HTTP %d", resp.StatusCode))
		status = "online"
		return
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		publishError(client, "read failed")
		status = "online"
		return
	}

	hash := sha256.Sum256(data)
	hashStr := fmt.Sprintf("%x", hash)
	if hashStr != cmd.Sha256Checksum {
		publishError(client, "checksum mismatch")
		status = "online"
		return
	}

	// Verify ECDSA P-256 signature — timed for thesis Section 4.2
	if ecdsaPubKey != nil {
		if cmd.Signature == "" {
			log.Printf("Robot %s: Update rejected - Missing cryptographic signature", deviceID)
			publishError(client, "missing firmware signature")
			status = "online"
			return
		}
		t0Ecdsa := time.Now()
		valid := verifyECDSASignature(ecdsaPubKey, hashStr, cmd.Signature)
		ecdsaMs := time.Since(t0Ecdsa).Milliseconds()
		log.Printf("Robot %s: ECDSA verification took %d ms", deviceID, ecdsaMs)

		if !valid {
			log.Printf("Robot %s: Update rejected - Cryptographic signature mismatch! (verified in %d ms)", deviceID, ecdsaMs)
			publishError(client, fmt.Sprintf("ecdsa signature verification failed (overhead: %d ms)", ecdsaMs))
			status = "online"
			return
		}
		log.Printf("Robot %s: ECDSA signature verified successfully (%d ms).", deviceID, ecdsaMs)

		// Publish detailed progress with ECDSA timing metadata
		publishProgressWithMeta(client, 20, "verified", map[string]interface{}{
			"ecdsa_verify_ms":  ecdsaMs,
			"sha256_verify_ms": time.Since(t0Ecdsa).Milliseconds(), // approx from hash step
		})
	}

	for i := 25; i <= 75; i += 25 {
		time.Sleep(1 * time.Second)
		publishProgress(client, i, "installing")
	}

	failOnVer := os.Getenv("FAIL_ON_VERSION")
	if (failOnVer != "" && cmd.Version == failOnVer) || (os.Getenv("SIMULATE_FAILURE") == "true") {
		publishError(client, "hardware flashing fault (simulated)")
		status = "online"
		return
	}

	// Controlled random failure rate via ENV (default 0 = disabled for clean experiments)
	failRateStr := os.Getenv("RANDOM_FAILURE_RATE")
	if failRateStr != "" {
		var failRate float64
		if _, err := fmt.Sscanf(failRateStr, "%f", &failRate); err == nil && failRate > 0 {
			if rand.Float32() < float32(failRate) {
				publishError(client, fmt.Sprintf("installation failed randomly (rate=%.2f)", failRate))
				status = "online"
				return
			}
		}
	}

	publishProgress(client, 90, "installing")
	time.Sleep(1 * time.Second)

	currentVersion = cmd.Version
	status = "online"
	publishProgress(client, 100, "success")
}

func handleRollback(client mqtt.Client, cmd Command) {
	status = "updating"
	time.Sleep(2 * time.Second)
	currentVersion = cmd.Version
	status = "online"
	publishProgress(client, 100, "success")
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
		return true
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

