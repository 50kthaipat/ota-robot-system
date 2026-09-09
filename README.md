# Cloud-Based OTA Firmware Management System for Robot Fleet

## Overview
A scalable platform for managing Over-The-Air (OTA) firmware updates for a fleet of robots.

## Quick Start
1. Copy `.env.example` to `.env`
2. Run `docker compose up -d`
3. The API will be available at http://localhost:8000
4. Prometheus at http://localhost:9090
5. Grafana at http://localhost:3001

## Architecture
```
[Robots (MQTT)] <--> [EMQX Broker] <--> [API Service (Go/Fiber)]
                                            |
                                            +--> [PostgreSQL] (State)
                                            +--> [Redis] (Cache)
                                            +--> [MinIO] (Firmware Storage)
```

## Scaling Robots
```bash
docker compose up --scale robot-sim=20 -d
```

## Tech Stack
| Component | Tech |
|---|---|
| Backend | Go + Fiber v3 |
| Database | PostgreSQL + pgx/v5 + sqlc |
| MQTT | EMQX + paho.mqtt.golang |
| Storage | MinIO |
| Monitor | Prometheus + Grafana |

## API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Healthcheck |
| GET | `/api/v1/devices` | List devices |
| GET | `/api/v1/devices/:id` | Get device |
| POST | `/api/v1/firmware/upload` | Upload firmware |
| GET | `/api/v1/firmware` | List firmwares |
| GET | `/api/v1/firmware/:id/url` | Get download URL |

## KPIs
- OTA Success Rate > 99%
- Concurrent Robot Connections: 10k+
- Firmware deploy time < 5 mins per fleet
