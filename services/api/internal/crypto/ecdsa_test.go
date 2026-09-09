package crypto

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateAndSaveKeypair(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "ecdsa_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	privPath := filepath.Join(tempDir, "private.pem")
	pubPath := filepath.Join(tempDir, "public.pem")

	priv, pub, err := EnsureKeypair(privPath, pubPath)
	if err != nil {
		t.Fatalf("EnsureKeypair failed: %v", err)
	}
	if priv == nil || pub == nil {
		t.Fatalf("Keys must not be nil")
	}

	// Load back
	loadedPriv, err := LoadPrivateKeyPEM(privPath)
	if err != nil {
		t.Fatalf("LoadPrivateKeyPEM failed: %v", err)
	}
	loadedPub, err := LoadPublicKeyPEM(pubPath)
	if err != nil {
		t.Fatalf("LoadPublicKeyPEM failed: %v", err)
	}

	if loadedPriv.D.Cmp(priv.D) != 0 {
		t.Fatalf("Loaded private key scalar does not match generated key")
	}
	if loadedPub.X.Cmp(pub.X) != 0 || loadedPub.Y.Cmp(pub.Y) != 0 {
		t.Fatalf("Loaded public key points do not match generated key")
	}
}

func TestSignAndVerifyHash(t *testing.T) {
	priv, pub, err := GenerateKeypair()
	if err != nil {
		t.Fatalf("GenerateKeypair failed: %v", err)
	}

	// Hash some firmware content
	content := []byte("firmware_version_2.0.0_binary_data")
	digest := sha256.Sum256(content)
	hashHex := hex.EncodeToString(digest[:])

	// Sign
	signatureBase64, err := SignSHA256(priv, hashHex)
	if err != nil {
		t.Fatalf("SignSHA256 failed: %v", err)
	}
	if signatureBase64 == "" {
		t.Fatalf("Signature base64 should not be empty")
	}

	// Verify valid signature
	valid := VerifySignature(pub, hashHex, signatureBase64)
	if !valid {
		t.Fatalf("Valid signature was rejected")
	}

	// Test tampered hash
	tamperedDigest := sha256.Sum256([]byte("tampered_firmware_binary_data"))
	tamperedHex := hex.EncodeToString(tamperedDigest[:])
	validTampered := VerifySignature(pub, tamperedHex, signatureBase64)
	if validTampered {
		t.Fatalf("Verification should fail for tampered hash")
	}

	// Test invalid signature string
	validInvalidSig := VerifySignature(pub, hashHex, "invalid_base64_signature")
	if validInvalidSig {
		t.Fatalf("Verification should fail for invalid signature")
	}
}
