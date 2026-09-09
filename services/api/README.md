# ⚙️ OTA Backend API Service

[![Go Version](https://img.shields.io/badge/Go-1.22%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![Framework](https://img.shields.io/badge/Framework-Fiber%20v3-00ACD7?style=flat)](https://gofiber.io)
[![Architecture](https://img.shields.io/badge/Architecture-Clean%20Architecture-informational)](#architecture)
[![Unit Tests](https://img.shields.io/badge/Tests-Passing-success)](#testing)

The **OTA Backend API Service** is the central control plane of the Cloud-Based OTA Firmware Management Platform. Built with Go and Fiber v3, it orchestrates firmware uploads, cryptographic code signing (ECDSA P-256), multi-phase canary deployments, robot fleet telemetry, and real-time auto-rollback detection.

---

## 🏗️ Architecture & Directory Layout

The service adheres to Clean Architecture principles, isolating business logic from external protocols and infrastructure:

```
services/api/
├── Dockerfile                  # Production multi-stage Alpine container build
├── go.mod                      # Go module definitions
├── go.sum                      # Dependency checksums
├── main.go                     # Application entrypoint & HTTP server lifecycle
├── sqlc.yaml                   # SQL schema & query code generation config
└── internal/                   # Internal application modules (private)
    ├── api/                    # HTTP route definitions & middleware setup
    ├── crypto/                 # NIST P-256 ECDSA key generation, signing & verification
    │   ├── ecdsa.go            # Cryptographic operations
    │   └── ecdsa_test.go       # Unit test suite for crypto signing & tampered payload rejection
    ├── db/                     # PostgreSQL database access layer (pgx/v5 & sqlc)
    │   ├── db.go               # Connection pool & healthchecks
    │   ├── models.go           # Generated DB structs
    │   └── queries.sql.go      # Precompiled SQL queries
    ├── handlers/               # HTTP Controller handlers
    │   ├── devices.go          # Fleet registration & status endpoints
    │   ├── deployments.go      # Canary rollout & manual rollback endpoints
    │   └── firmware.go         # Firmware upload, checksum & signed URL endpoints
    ├── metrics/                # Prometheus metrics collector (HTTP & fleet gauges)
    ├── mqtt/                   # MQTT 5.0 client (EMQX broker integration)
    │   ├── client.go           # Broker connection & auto-reconnect
    │   ├── handlers.go         # Topic listeners (telemetry, heartbeat, progress)
    │   └── publisher.go        # Command dispatching (update, rollback)
    ├── orchestrator/           # Canary Rollout & Auto-Rollback Engine
    │   ├── canary.go           # 3-phase rollout scheduler (10% -> 50% -> 100%)
    │   └── watchdog.go         # Fleet heartbeat monitor & automatic rollback trigger
    └── storage/                # S3 / MinIO binary object storage integration
        └── s3.go               # Firmware blob upload & presigned download URLs
```

---

## 🚀 Running Locally (Standalone)

### Prerequisites
- Go 1.22+ installed
- Running PostgreSQL, Redis, MinIO, and EMQX (e.g. via `docker compose up -d postgres redis minio emqx`)

### 1. Configure Environment
Create `.env` or set environment variables:
```bash
DATABASE_URL=postgres://ota:ota_password@localhost:5432/otadb?sslmode=disable
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=firmware
MINIO_USE_SSL=false
MQTT_BROKER=tcp://localhost:1883
API_PORT=8000
ECDSA_PRIVATE_KEY_PATH=../../keys/private.pem
ECDSA_PUBLIC_KEY_PATH=../../keys/public.pem
```

### 2. Run the Service
```bash
go run main.go
```
The API server will listen on `http://localhost:8000`.

---

## 🧪 Unit & Integration Testing

Run unit tests with race detection and statement coverage:

```bash
# Run cryptographic test suite
go test -v -cover ./internal/crypto/...

# Run all internal packages
go test -v ./...
```

---

## 📡 REST API & MQTT Interfaces

Detailed endpoint documentation, request/response bodies, and MQTT topic specifications are documented in:
👉 [`docs/backend/API_SPEC.md`](../../docs/backend/API_SPEC.md)
