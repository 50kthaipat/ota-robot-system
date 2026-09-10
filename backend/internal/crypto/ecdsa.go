package crypto

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// GenerateKeypair generates a new ECDSA P-256 key pair.
func GenerateKeypair() (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	return priv, &priv.PublicKey, nil
}

// SavePrivateKeyPEM writes an ECDSA private key to a PEM file.
func SavePrivateKeyPEM(key *ecdsa.PrivateKey, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	der, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return err
	}
	block := &pem.Block{
		Type:  "EC PRIVATE KEY",
		Bytes: der,
	}
	return os.WriteFile(path, pem.EncodeToMemory(block), 0600)
}

// SavePublicKeyPEM writes an ECDSA public key to a PEM file.
func SavePublicKeyPEM(key *ecdsa.PublicKey, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	der, err := x509.MarshalPKIXPublicKey(key)
	if err != nil {
		return err
	}
	block := &pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: der,
	}
	return os.WriteFile(path, pem.EncodeToMemory(block), 0644)
}

const (
	// DefaultPrivateKeyPEM is the master ECDSA P-256 private key matching the fleet public key.
	DefaultPrivateKeyPEM = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIH1mDDDuUx1T2mZXetVDVu4ivtfN51Ey3WflJAaMs528oAoGCCqGSM49
AwEHoUQDQgAElEKlesPvGKyGFI2RwpJsfqXxqKBAhkeZCoqleIU8Ix6uE5NVhG7K
AtIVTcO3ylWXNO4qxiTJvhyMEA73jEgheg==
-----END EC PRIVATE KEY-----`

	// DefaultPublicKeyPEM is the master ECDSA P-256 public key embedded in all robot simulators.
	DefaultPublicKeyPEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElEKlesPvGKyGFI2RwpJsfqXxqKBA
hkeZCoqleIU8Ix6uE5NVhG7KAtIVTcO3ylWXNO4qxiTJvhyMEA73jEgheg==
-----END PUBLIC KEY-----`
)

// ParsePrivateKeyFromPEM parses an EC private key from raw PEM bytes.
func ParsePrivateKeyFromPEM(data []byte) (*ecdsa.PrivateKey, error) {
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("failed to parse PEM block containing the private key")
	}
	return x509.ParseECPrivateKey(block.Bytes)
}

// ParsePublicKeyFromPEM parses an ECDSA PKIX public key from raw PEM bytes.
func ParsePublicKeyFromPEM(data []byte) (*ecdsa.PublicKey, error) {
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("failed to parse PEM block containing the public key")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	ecdsaPub, ok := pub.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("not an ECDSA public key")
	}
	return ecdsaPub, nil
}

// LoadPrivateKeyPEM loads an ECDSA private key from a PEM file.
func LoadPrivateKeyPEM(path string) (*ecdsa.PrivateKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParsePrivateKeyFromPEM(data)
}

// LoadPublicKeyPEM loads an ECDSA public key from a PEM file.
func LoadPublicKeyPEM(path string) (*ecdsa.PublicKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParsePublicKeyFromPEM(data)
}

// EnsureKeypair ensures that private and public keys are available.
// It checks environment variables (B64/PEM), file paths, and falls back to the embedded master keypair.
func EnsureKeypair(privPath, pubPath string) (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	// 1. Check ECDSA_PRIVATE_KEY_B64 environment variable (Base64 encoded PEM)
	if b64 := os.Getenv("ECDSA_PRIVATE_KEY_B64"); b64 != "" {
		if raw, err := base64.StdEncoding.DecodeString(b64); err == nil {
			if priv, err := ParsePrivateKeyFromPEM(raw); err == nil {
				return priv, &priv.PublicKey, nil
			}
		}
	}

	// 2. Check ECDSA_PRIVATE_KEY_PEM environment variable (Raw PEM text)
	if rawPEM := os.Getenv("ECDSA_PRIVATE_KEY_PEM"); rawPEM != "" {
		if priv, err := ParsePrivateKeyFromPEM([]byte(rawPEM)); err == nil {
			return priv, &priv.PublicKey, nil
		}
	}

	// 3. Try loading from file path
	if privPath != "" {
		if priv, err := LoadPrivateKeyPEM(privPath); err == nil {
			if pub, err := LoadPublicKeyPEM(pubPath); err == nil {
				return priv, pub, nil
			}
			return priv, &priv.PublicKey, nil
		}
	}

	// 4. Fall back to embedded master keypair (guarantees fleet compatibility)
	priv, err := ParsePrivateKeyFromPEM([]byte(DefaultPrivateKeyPEM))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse default embedded private key: %w", err)
	}
	pub, err := ParsePublicKeyFromPEM([]byte(DefaultPublicKeyPEM))
	if err != nil {
		pub = &priv.PublicKey
	}

	// Try saving to disk for local cache if path is provided
	if privPath != "" {
		_ = SavePrivateKeyPEM(priv, privPath)
	}
	if pubPath != "" {
		_ = SavePublicKeyPEM(pub, pubPath)
	}

	return priv, pub, nil
}

// SignSHA256 signs a hex-encoded SHA256 hash using the private key and returns a base64 ASN.1 signature.
func SignSHA256(priv *ecdsa.PrivateKey, sha256Hex string) (string, error) {
	hashBytes, err := hex.DecodeString(sha256Hex)
	if err != nil {
		return "", fmt.Errorf("invalid sha256 hex string: %w", err)
	}
	sig, err := ecdsa.SignASN1(rand.Reader, priv, hashBytes)
	if err != nil {
		return "", fmt.Errorf("failed to sign hash: %w", err)
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

// VerifySignature verifies a base64-encoded ASN.1 signature against a hex-encoded SHA256 hash.
func VerifySignature(pub *ecdsa.PublicKey, sha256Hex, signatureB64 string) bool {
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
