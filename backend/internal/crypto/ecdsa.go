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
// It checks environment variables (B64/PEM) and file paths, generating a fresh pair only in development.
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
				if pub.X.Cmp(priv.PublicKey.X) != 0 || pub.Y.Cmp(priv.PublicKey.Y) != 0 {
					return nil, nil, errors.New("configured ECDSA public key does not match private key")
				}
				return priv, pub, nil
			}
			return priv, &priv.PublicKey, nil
		}
	}

	// Never substitute a publicly known signing key. Production must fail closed.
	if os.Getenv("ENV") == "production" || os.Getenv("APP_ENV") == "production" {
		return nil, nil, errors.New("production requires ECDSA_PRIVATE_KEY_B64, ECDSA_PRIVATE_KEY_PEM, or a valid private key file")
	}
	priv, pub, err := GenerateKeypair()
	if err != nil {
		return nil, nil, fmt.Errorf("generate development keypair: %w", err)
	}
	if privPath != "" {
		if err := SavePrivateKeyPEM(priv, privPath); err != nil {
			return nil, nil, fmt.Errorf("save development private key: %w", err)
		}
	}
	if pubPath != "" {
		if err := SavePublicKeyPEM(pub, pubPath); err != nil {
			return nil, nil, fmt.Errorf("save development public key: %w", err)
		}
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
