// Package crypto provides ECDSA P-256 signature verification utilities
// for the OTA Robot Agent. This is a thin wrapper around Go's standard
// crypto/ecdsa package that adds structured logging for thesis Section 4.2.
package crypto

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"log"
	"os"
	"time"
)

// DefaultPublicKeyPEM is the embedded fallback public key used when no
// external key file is available (e.g., during standalone testing).
const DefaultPublicKeyPEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElEKlesPvGKyGFI2RwpJsfqXxqKBA
hkeZCoqleIU8Ix6uE5NVhG7KAtIVTcO3ylWXNO4qxiTJvhyMEA73jEgheg==
-----END PUBLIC KEY-----`

// VerificationResult holds the outcome and timing of an ECDSA verification.
type VerificationResult struct {
	Valid         bool
	OverheadMs    int64
	DetectionStage string // "hash_mismatch" | "missing_signature" | "key_forgery" | "ok"
}

// LoadPublicKey attempts to load an ECDSA P-256 public key from well-known
// paths and falls back to the embedded default key.
func LoadPublicKey() *ecdsa.PublicKey {
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
			log.Printf("[crypto] Loaded ECDSA public key from %s", p)
			break
		}
	}

	if len(data) == 0 {
		data = []byte(DefaultPublicKeyPEM)
		log.Printf("[crypto] Using embedded default ECDSA public key")
	}

	block, _ := pem.Decode(data)
	if block == nil {
		log.Printf("[crypto] Warning: failed to decode PEM block for public key")
		return nil
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		log.Printf("[crypto] Warning: failed to parse PKIX public key: %v", err)
		return nil
	}
	ecdsaPub, ok := pub.(*ecdsa.PublicKey)
	if !ok {
		log.Printf("[crypto] Warning: parsed key is not ECDSA public key")
		return nil
	}
	return ecdsaPub
}

// VerifySignature checks the ECDSA P-256 signature of a firmware binary.
// It returns a VerificationResult containing the validity flag and the
// measured overhead in milliseconds, which is published to the MQTT topic
// for data collection (thesis Section 4.2).
func VerifySignature(pub *ecdsa.PublicKey, data []byte, signatureB64 string) VerificationResult {
	if pub == nil {
		return VerificationResult{Valid: false, OverheadMs: 0, DetectionStage: "missing_public_key"}
	}

	if signatureB64 == "" {
		return VerificationResult{Valid: false, OverheadMs: 0, DetectionStage: "missing_signature"}
	}

	t0 := time.Now()

	// Compute SHA-256 of the firmware binary
	hash := sha256.Sum256(data)

	sigBytes, err := base64.StdEncoding.DecodeString(signatureB64)
	if err != nil {
		return VerificationResult{Valid: false, OverheadMs: time.Since(t0).Milliseconds(), DetectionStage: "invalid_signature_encoding"}
	}

	valid := ecdsa.VerifyASN1(pub, hash[:], sigBytes)
	overheadMs := time.Since(t0).Milliseconds()

	stage := "ok"
	if !valid {
		stage = "key_forgery"
	}
	return VerificationResult{Valid: valid, OverheadMs: overheadMs, DetectionStage: stage}
}

// VerifySignatureFromHex checks the ECDSA P-256 signature given a pre-computed
// SHA-256 hex string (used when the hash was computed separately, e.g., during
// the download pipeline to avoid re-reading the file).
func VerifySignatureFromHex(pub *ecdsa.PublicKey, sha256Hex, signatureB64 string) VerificationResult {
	if pub == nil {
		return VerificationResult{Valid: false, OverheadMs: 0, DetectionStage: "missing_public_key"}
	}
	if signatureB64 == "" {
		return VerificationResult{Valid: false, OverheadMs: 0, DetectionStage: "missing_signature"}
	}

	t0 := time.Now()

	hashBytes, err := hex.DecodeString(sha256Hex)
	if err != nil {
		return VerificationResult{Valid: false, OverheadMs: time.Since(t0).Milliseconds(), DetectionStage: "invalid_hash_hex"}
	}
	sigBytes, err := base64.StdEncoding.DecodeString(signatureB64)
	if err != nil {
		return VerificationResult{Valid: false, OverheadMs: time.Since(t0).Milliseconds(), DetectionStage: "invalid_signature_encoding"}
	}

	valid := ecdsa.VerifyASN1(pub, hashBytes, sigBytes)
	overheadMs := time.Since(t0).Milliseconds()

	stage := "ok"
	if !valid {
		stage = "key_forgery"
	}
	return VerificationResult{Valid: valid, OverheadMs: overheadMs, DetectionStage: stage}
}
