# Backend API & MQTT Protocols Specification

[![REST API](https://img.shields.io/badge/API-RESTful-blue)](http://localhost:8000/api/v1)
[![MQTT](https://img.shields.io/badge/Broker-EMQX%20v5-orange)](http://localhost:18083)
[![Security](https://img.shields.io/badge/Auth-ECDSA%20P--256-green)](#security-signatures)

Documenting the Control Plane (HTTP REST API) and Data Plane (MQTT 5.0 Edge Broker) of the OTA Fleet Management System.

---

## 1. RESTful API Endpoints (Control Plane)
**Base URL:** `http://localhost:8000/api/v1`

### 1.1 Health & Metrics
- **`GET /health`**
  - **Description:** Basic liveness probe for load balancers & container orchestrators.
  - **Response:** `200 OK` (`"OK"`)
- **`GET /metrics`**
  - **Description:** Prometheus exposition endpoint collecting HTTP latencies, active deployments, robot fleet distribution, and error rates.
  - **Response:** `200 OK` (Prometheus text format)

### 1.2 Device & Fleet Management
- **`GET /api/v1/devices`**
  - **Query Params:** `factory_id` (optional), `hw_model` (optional), `status` (optional)
  - **Response Example:**
    ```json
    {
      "total": 5,
      "data": [
        {
          "id": "cartesian-3483abae",
          "hw_model": "cartesian-v1",
          "factory_id": "factory-ayutthaya-04",
          "current_version": "1.0.0",
          "status": "online",
          "last_heartbeat": "2026-09-09T14:24:00Z"
        }
      ]
    }
    ```
- **`GET /api/v1/devices/:id`**
  - **Path Param:** `id` (Device UUID / string ID)
  - **Response Example:**
    ```json
    {
      "id": "scara-b077f06c",
      "hw_model": "scara-v1",
      "factory_id": "factory-bkk-01",
      "current_version": "1.0.0",
      "status": "online",
      "ip_address": "172.20.0.12",
      "created_at": "2026-09-08T08:00:00Z"
    }
    ```

### 1.3 Firmware Repository & Security Vault
- **`POST /api/v1/firmware/upload`**
  - **Content-Type:** `multipart/form-data`
  - **Fields:**
    - `file`: Firmware binary payload (`.bin` / `.tar.gz`)
    - `version`: Semantic version string (e.g. `1.1.0`)
    - `hw_model`: Target robot model (e.g. `scara-v1` or `all`)
    - `release_notes`: Changelog description
  - **Response Example:**
    ```json
    {
      "id": "7b8e1f02-9a3d-4c8e-b5f6-1234567890ab",
      "version": "1.1.0",
      "hw_model": "scara-v1",
      "file_size": 1048576,
      "sha256": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      "signature": "MEQCIAxY1a8B8d...NIST-P256-Base64-Signature...",
      "created_at": "2026-09-09T10:00:00Z"
    }
    ```
- **`GET /api/v1/firmware`**
  - **Description:** List all registered firmware releases in descending order of version.
  - **Response:** `{"total": 2, "data": [...]}`
- **`GET /api/v1/firmware/:id/url`**
  - **Description:** Returns an authenticated, time-limited S3/MinIO presigned download URL.
  - **Response Example:**
    ```json
    {
      "download_url": "http://localhost:9000/firmware/scara-v1/1.1.0/firmware.bin?X-Amz-Signature=...",
      "sha256": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      "signature": "MEQCIAxY1a8B8d..."
    }
    ```

### 1.4 Deployment Orchestration (Canary & Rollback)
- **`POST /api/v1/deployments`**
  - **Request Body:**
    ```json
    {
      "firmware_id": "7b8e1f02-9a3d-4c8e-b5f6-1234567890ab",
      "strategy": "canary",
      "target_factory": "all",
      "target_hw_model": "all",
      "canary_phases": [10, 50, 100],
      "healthcheck_timeout_sec": 30
    }
    ```
  - **Response:** `{"id": "c1f2e3d4-...", "status": "running", "strategy": "canary"}`
- **`GET /api/v1/deployments/:id`**
  - **Response Example:**
    ```json
    {
      "id": "c1f2e3d4-...",
      "firmware_id": "7b8e1f02-...",
      "strategy": "canary",
      "status": "in_progress",
      "current_phase": 2,
      "total_devices": 5,
      "updated_devices": 3,
      "failed_devices": 0,
      "progress_percent": 60,
      "devices": [
        {
          "device_id": "scara-b077f06c",
          "status": "success",
          "applied_version": "1.1.0",
          "duration_sec": 1.2
        }
      ]
    }
    ```
- **`POST /api/v1/deployments/:id/rollback`**
  - **Description:** Operator-triggered emergency rollback reverting all fleet nodes to previous golden version.
  - **Response:** `{"status": "rolled_back", "message": "Emergency rollback broadcasted to all nodes"}`

---

## 2. MQTT 5.0 Protocol & Telemetry Topics (Data Plane)

### 2.1 Heartbeat Telemetry: `ota/device/{device_id}/status`
- **Direction:** Robot Node -> EMQX Broker -> API Engine
- **Interval:** 5.0 seconds
- **Payload:**
  ```json
  {
    "device_id": "cartesian-3483abae",
    "factory_id": "factory-ayutthaya-04",
    "hw_model": "cartesian-v1",
    "current_version": "1.0.0",
    "status": "online",
    "uptime_seconds": 86400,
    "timestamp": "2026-09-09T14:24:00Z"
  }
  ```

### 2.2 Command Dispatch: `ota/device/{device_id}/command`
- **Direction:** API Orchestrator -> Robot Node
- **QoS Level:** QoS 1 (At least once delivery)
- **Update Command Payload:**
  ```json
  {
    "action": "update",
    "version": "1.1.0",
    "download_url": "http://minio:9000/firmware/cartesian-v1/1.1.0/firmware.bin?token=...",
    "sha256_checksum": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
    "signature": "MEQCIAxY1a8B8d...NIST-P256-Base64..."
  }
  ```
- **Rollback Command Payload:**
  ```json
  {
    "action": "rollback",
    "target_version": "1.0.0",
    "reason": "watchdog_timeout_detected"
  }
  ```

### 2.3 Progress & Verification State: `ota/device/{device_id}/progress`
- **Direction:** Robot Node -> API Orchestrator
- **Payload:**
  ```json
  {
    "device_id": "cartesian-3483abae",
    "step": "verifying_signature",
    "percent": 85,
    "status": "installing"
  }
  ```
