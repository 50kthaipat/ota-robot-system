# OTA Robot Fleet Management System

A control plane and edge agent platform for managing over-the-air (OTA) firmware updates across industrial robot fleets. Features cryptographic signature verification (ECDSA P-256), staged canary rollouts (20% → 60% → 100%), automated rollback on failure, and real-time fleet telemetry.

This project is an experimental prototype and research testbed for fleet orchestration. It is not an IEC 61508 or ISO 10218 safety-certified industrial controller.

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
