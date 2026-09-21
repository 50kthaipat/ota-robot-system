package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

func main() {
	fmt.Println("==================================================================")
	fmt.Println(" EXPERIMENT 1: Real Empirical Cryptographic Overhead Benchmark")
	fmt.Println(" Algorithm: SHA-256 Digest + ECDSA NIST P-256 Signature Verify")
	fmt.Println("==================================================================")

	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		fmt.Printf("Error generating ECDSA key: %v\n", err)
		os.Exit(1)
	}

	sizesMB := []int{1, 5, 10, 25, 50, 100}
	trialsPerSize := 50

	outputDir := filepath.Join("data", "experiments")
	_ = os.MkdirAll(outputDir, 0755)
	outputPath := filepath.Join(outputDir, "scenario_1_crypto_benchmark.csv")

	file, err := os.Create(outputPath)
	if err != nil {
		fmt.Printf("Error creating output file: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	_ = writer.Write([]string{
		"trial_id",
		"file_size_mb",
		"file_size_bytes",
		"hash_time_us",
		"sig_verify_time_us",
		"total_crypto_time_us",
		"throughput_mb_s",
		"is_valid",
	})

	trialCounter := 0

	for _, sizeMB := range sizesMB {
		sizeBytes := sizeMB * 1024 * 1024
		fmt.Printf(">> Benchmarking %d MB binary payload (%d trials)...\n", sizeMB, trialsPerSize)

		buffer := make([]byte, sizeBytes)
		_, _ = rand.Read(buffer[:1024])
		for i := 1024; i < sizeBytes; i += 1024 {
			copy(buffer[i:], buffer[:1024])
		}

		for t := 1; t <= trialsPerSize; t++ {
			trialCounter++

			// 1. Benchmark SHA-256
			t0 := time.Now()
			hash := sha256.Sum256(buffer)
			hashDuration := time.Since(t0)

			// Sign
			sig, err := ecdsa.SignASN1(rand.Reader, privKey, hash[:])
			if err != nil {
				fmt.Printf("Signing error: %v\n", err)
				continue
			}

			// 2. Benchmark ECDSA Verification
			t1 := time.Now()
			valid := ecdsa.VerifyASN1(&privKey.PublicKey, hash[:], sig)
			verifyDuration := time.Since(t1)

			hashTimeUs := hashDuration.Microseconds()
			sigVerifyTimeUs := verifyDuration.Microseconds()
			totalCryptoUs := hashTimeUs + sigVerifyTimeUs

			totalSec := float64(totalCryptoUs) / 1000000.0
			throughput := 0.0
			if totalSec > 0 {
				throughput = float64(sizeMB) / totalSec
			}

			_ = writer.Write([]string{
				fmt.Sprintf("%d", trialCounter),
				fmt.Sprintf("%d", sizeMB),
				fmt.Sprintf("%d", sizeBytes),
				fmt.Sprintf("%d", hashTimeUs),
				fmt.Sprintf("%d", sigVerifyTimeUs),
				fmt.Sprintf("%d", totalCryptoUs),
				fmt.Sprintf("%.2f", throughput),
				fmt.Sprintf("%t", valid),
			})
		}
	}

	fmt.Printf("[OK] Successfully generated %d empirical records in %s\n", trialCounter, outputPath)
}
