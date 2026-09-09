package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	keysDir := "./keys"
	if len(os.Args) > 1 {
		keysDir = os.Args[1]
	}
	_ = os.MkdirAll(keysDir, 0755)

	privKeyPath := filepath.Join(keysDir, "private.pem")
	pubKeyPath := filepath.Join(keysDir, "public.pem")

	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		fmt.Printf("Error generating ECDSA key: %v\n", err)
		os.Exit(1)
	}

	privDER, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		fmt.Printf("Error marshaling private key: %v\n", err)
		os.Exit(1)
	}
	privBlock := &pem.Block{Type: "EC PRIVATE KEY", Bytes: privDER}
	if err := os.WriteFile(privKeyPath, pem.EncodeToMemory(privBlock), 0600); err != nil {
		fmt.Printf("Error writing private key: %v\n", err)
		os.Exit(1)
	}

	pubDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		fmt.Printf("Error marshaling public key: %v\n", err)
		os.Exit(1)
	}
	pubBlock := &pem.Block{Type: "PUBLIC KEY", Bytes: pubDER}
	if err := os.WriteFile(pubKeyPath, pem.EncodeToMemory(pubBlock), 0644); err != nil {
		fmt.Printf("Error writing public key: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("ECDSA P-256 keys generated successfully:\n  Private: %s\n  Public:  %s\n", privKeyPath, pubKeyPath)
}
