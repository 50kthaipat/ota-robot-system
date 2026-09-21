# OTA Robot Fleet Management System

A control plane and edge agent platform for managing over-the-air (OTA) firmware updates across industrial robot fleets. Features cryptographic signature verification (ECDSA P-256), staged canary rollouts (20% → 60% → 100%), automated rollback on failure, and real-time fleet telemetry.

This project is an experimental prototype and research testbed for fleet orchestration. It is not an IEC 61508 or ISO 10218 safety-certified industrial controller.

## System Architecture

The platform follows a decoupled control plane and edge agent architecture with an out-of-band artifact delivery pipeline:

```text
                     +---------------------------------------------------+
                     |              OPERATOR WORKSTATION                 |
                     |  Next.js 15 Dashboard (TypeScript, Tailwind CSS)  |
                     +-------------------------+-------------------------+
                                               |
                                HTTPS (REST)   | Single-Flight Auth
                                               v
+-----------------------------------------------------------------------------------------+
|                               CONTROL PLANE (Go / Fiber v3)                             |
|                                                                                         |
|  +-------------------+  +--------------------+  +------------------+  +--------------+  |
|  |  Session / Auth   |  |  Firmware Release  |  | Rollout Engine   |  | Fleet Gauges |  |
|  |  (Argon2id, JWT,  |  |  (Magic Bytes,     |  | (Canary FSM:     |  | & Metrics    |  |
|  |   Secure Cookies) |  |   SHA-256, ECDSA)  |  |  20%->60%->100%) |  | (/metrics)   |  |
|  +---------+---------+  +---------+----------+  +--------+---------+  +-------+------+  |
+------------|----------------------|----------------------|--------------------|---------+
             |                      |                      |                    |
             v                      v                      v                    v
      [PostgreSQL 16]         [MinIO / R2]          [EMQX MQTT 5]         [Prometheus]
     (Fleet Registry,       (Signed Binaries,     (Topics: commands,     (Telemetry &
      Deployments, Audit)    Presigned URLs)       telemetry, errors)      Health Scrape)
                                                           |
                                            MQTT 5.0 (QoS 1)
                                                           |
             +---------------------------------------------+-----------------------+
             |                                                                     |
             v                                                                     v
+------------------------------------------+         +------------------------------------------+
|          ROBOT FLEET - FACTORY A         |         |          ROBOT FLEET - FACTORY B         |
|                                          |         |                                          |
|  +------------------------------------+  |         |  +------------------------------------+  |
|  |       Autonomous Mobile Robot      |  |         |  |       Autonomous Mobile Robot      |  |
|  |  +------------------------------+  |  |         |  |  +------------------------------+  |  |
|  |  |   OTA Edge Agent (Go FSM)    |  |  |         |  |  |   OTA Edge Agent (Go FSM)    |  |  |
|  |  | - MQTT State & Telemetry     |  |  |         |  |  | - MQTT State & Telemetry     |  |  |
|  |  | - S3 Presigned Downloader    |  |  |         |  |  | - S3 Presigned Downloader    |  |  |
|  |  | - ECDSA P-256 Verify (Root)  |  |  |         |  |  | - ECDSA P-256 Verify (Root)  |  |  |
|  |  | - A/B Slot Flash Controller  |  |  |         |  |  | - A/B Slot Flash Controller  |  |  |
|  |  +------------------------------+  |  |         |  |  +------------------------------+  |  |
|  +------------------------------------+  |         |  +------------------------------------+  |
+------------------------------------------+         +------------------------------------------+
```

### Component Breakdown

1. **Web Dashboard (`frontend/`)**: Next.js 15 (App Router) interface for operator fleet tracking, binary release uploads, canary stage execution, and manual emergency rollback. Communicates with the control plane via single-flight authenticated REST (`activeRefreshPromise`).
2. **Control Plane (`backend/`)**: Modular Go API service powered by Fiber v3:
   - `internal/rollout`: Coordinates canary lifecycle progression (20% → 60% → 100%), failure threshold monitoring, and auto-rollback execution.
   - `internal/firmware`: Validates binary format (magic bytes, size bounds, script detection), signs payloads using ECDSA P-256, and atomically uploads binaries to object storage with compensating cleanup.
   - `internal/config`: Enforces fail-fast production invariants and blocks insecure default secrets.
   - `internal/middleware`: Enforces role-based permissions (`admin`, `operator`) and protects `/metrics` with `METRICS_TOKEN`.
   - `internal/mqtt`: Dispatches update commands and collects device telemetry via MQTT 5.0 QoS 1.
3. **Storage & Infrastructure Plane (`infra/`)**:
   - **PostgreSQL 16**: Relational storage for fleet device records, deployment histories, and audit logs.
   - **MinIO / Cloud Object Storage**: Segregated binary storage. Edge robots fetch binaries directly via short-lived (15-minute) presigned URLs rather than routing binary blobs through the API host.
   - **EMQX Broker**: Low-latency message broker maintaining MQTT persistent sessions and command delivery.
   - **Prometheus & Grafana**: Time-series telemetry scraping and fleet status visualization.
4. **Edge Robot Agent (`simulator/`)**: Embedded Go daemon executing a deterministic finite state machine (FSM):
   - **States**: `IDLE` → `DOWNLOADING` → `VERIFYING` → `INSTALLING` → `REBOOTING` → `ONLINE`
   - **Fault Isolation**: Fails closed if the public key is missing or signature verification fails, automatically transitioning to `ROLLING_BACK` to preserve fleet uptime.

## Repository Structure

| Directory | Description |
| --- | --- |
| `backend/` | Go Fiber v3 API, PostgreSQL storage, MQTT coordinator, ECDSA signing service, rollout state machine |
| `frontend/` | Next.js 15 dashboard (App Router, Tailwind CSS, TypeScript) for fleet monitoring and deployment operations |
| `simulator/` | Autonomous mobile robot (AMR) agent simulator with local FSM, MQTT client, and signature verification |
| `infra/` | Docker configurations, Prometheus scraper configs, and Grafana dashboard templates |
| `scripts/` | Key generation utilities, empirical benchmark harnesses (scenarios 1–5), and dataset processors |
| `ml/` | Anomaly detection and linear regression pipelines for firmware failure prediction |
| `docs/` | System architecture, API and MQTT contracts, operational guides, and academic experimental protocols |
| `security/` | Vulnerability assessment records and historical audit documentation |

## Prerequisites

- Docker and Docker Compose v2
- Go 1.22+ (for running Go test suites or host services)
- Node.js 20+ and npm 10+ (for frontend dashboard development)

## Quickstart (Local Docker)

1. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`.

2. **Generate cryptographic signing keys:**
   If `keys/private.pem` does not already exist:
   ```bash
   go run scripts/gen_keys.go
   ```
   This generates an ECDSA P-256 keypair in the `keys/` directory. The private key must remain secret and is ignored by Git.

3. **Start the local stack:**
   ```bash
   docker compose up -d --build
   docker compose ps
   ```

4. **Access local services:**

| Service | Address | Credentials / Notes |
| --- | --- | --- |
| Dashboard | http://localhost:3000 | Configured `ADMIN_USERNAME` / `ADMIN_PASSWORD` |
| Backend API | http://localhost:8000 | Health check: `http://localhost:8000/health` |
| Metrics | http://localhost:8000/metrics | Protected in production (`METRICS_TOKEN`); loopback allowed in dev |
| Grafana | http://localhost:3001 | Anonymous admin enabled for local demo |
| Prometheus | http://localhost:9090 | Scrapes API and EMQX |
| EMQX Dashboard | http://localhost:18083 | Default: `admin` / `public` |
| MinIO Console | http://localhost:9001 | Default: `minioadmin` / `minioadmin` |

## Running Tests

Run the backend, simulator, and frontend test suites locally:

```bash
# Backend unit tests
cd backend && go test -count=1 ./...

# Robot simulator agent tests
cd ../simulator && go test -count=1 ./...

# Frontend linting and production build
cd ../frontend && npm ci && npm run lint && npm run build
```

## Security and Production Deployment

- **Fail-Closed Signing:** Production (`APP_ENV=production`) requires explicit signing keys passed via environment variables (`ECDSA_PRIVATE_KEY_B64`, `ECDSA_PRIVATE_KEY_PEM`) or secure key file paths. The system fails closed if signing keys are missing or invalid.
- **Key Compromise Notice:** Legacy development keys found in Git history are compromised and must not be used in any physical deployment. Generate a fresh keypair and distribute the public key to edge nodes out-of-band before deployment.
- **Session Security:** JWT access tokens expire after 15 minutes. Refresh tokens are stored in `HttpOnly; SameSite=Strict` cookies. Production mode strictly enforces `Secure: true`.
- **Metrics Protection:** The Prometheus `/metrics` route enforces bearer token authentication when `METRICS_TOKEN` is set, and requires configuration in production.
- **Local Demo Isolation:** The default `docker-compose.yml` includes demo credentials, anonymous MQTT, and an unauthenticated Grafana admin role. Never expose this demo configuration to untrusted networks. See [SECURITY.md](SECURITY.md).

## Empirical Research Suite

The `scripts/` directory contains an empirical benchmarking suite evaluating five operational scenarios:

1. `scripts/benchmark_crypto.go`: SHA-256 digest scaling vs. ECDSA P-256 signature verification overhead.
2. `scripts/benchmark_security.py`: Zero-trust rejection rates against tampered payloads and unauthorized releases.
3. `scripts/benchmark_resilience_ab.py`: A/B resilience testing comparing canary staged rollout against global all-at-once deployment (evaluated via Mann-Whitney U test in `scripts/statistical_analysis.py`).
4. `scripts/benchmark_network.py`: OTA download reliability and latency distribution under network degradation.
5. `scripts/benchmark_concurrency.py`: Control plane throughput and concurrency scaling across virtual robot fleets.

Run all benchmark scenarios via:
```powershell
.\scripts\run_new_experiments.ps1
```

## Documentation

- [System Architecture](docs/design/ARCHITECTURE.md)
- [API and MQTT Specifications](docs/design/API_AND_MQTT_SPEC.md)
- [Local Development Setup](docs/operations/SETUP_LOCAL.md)
- [Cloud Deployment Guide](docs/operations/SETUP_CLOUD.md)
- [Academic Experimental Plan](docs/academic/EXPERIMENTAL_PLAN.md)
- [Security Policy](SECURITY.md)
