# 🗄️ PostgreSQL Database Schema & State Store

[![Database](https://img.shields.io/badge/PostgreSQL-16--alpine-336791?style=flat&logo=postgresql)](https://postgresql.org)
[![Driver](https://img.shields.io/badge/Driver-pgx%2Fv5-blue)](https://github.com/jackc/pgx)
[![CodeGen](https://img.shields.io/badge/CodeGen-sqlc-teal)](https://sqlc.dev)

This document describes the relational database structure, indexing strategies, and entity relationships of the OTA platform.

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    DEVICES ||--o{ DEPLOYMENT_DEVICES : receives
    DEPLOYMENTS ||--|{ DEPLOYMENT_DEVICES : tracks
    FIRMWARES ||--o{ DEPLOYMENTS : deployed_by
    DEVICES ||--o{ AUDIT_LOGS : records

    DEVICES {
        string id PK "e.g. scara-b077f06c"
        string hw_model "e.g. scara-v1"
        string factory_id "e.g. factory-bkk-01"
        string current_version "1.0.0"
        string status "online / offline / updating"
        string ip_address "172.20.0.12"
        timestamp last_heartbeat
        timestamp created_at
        timestamp updated_at
    }

    FIRMWARES {
        uuid id PK
        string version "1.1.0"
        string hw_model "scara-v1 / all"
        bigint file_size "bytes"
        string storage_path "s3 key"
        string sha256_checksum "hex digest"
        text signature "ECDSA P-256 base64"
        text release_notes
        timestamp created_at
    }

    DEPLOYMENTS {
        uuid id PK
        uuid firmware_id FK
        string strategy "direct / canary"
        string target_factory "all / factory_id"
        string target_hw_model "all / model"
        string status "pending / in_progress / completed / rolled_back"
        int current_phase "1 (10%), 2 (50%), 3 (100%)"
        int total_devices
        int updated_devices
        int failed_devices
        timestamp started_at
        timestamp completed_at
    }

    DEPLOYMENT_DEVICES {
        uuid id PK
        uuid deployment_id FK
        string device_id FK
        string status "pending / in_progress / success / failed / rolled_back"
        string initial_version
        string applied_version
        int retry_count
        text error_message
        timestamp updated_at
    }

    AUDIT_LOGS {
        uuid id PK
        string event_type "FIRMWARE_UPLOAD, ROLLOUT_START, ROLLBACK"
        string actor "admin / system_watchdog"
        string target_id
        jsonb details
        timestamp created_at
    }
```

---

## 2. Table Specifications

### 2.1 `devices`
Tracks all physical or simulated edge robot controllers.
- `id` (VARCHAR 64, PK)
- `hw_model` (VARCHAR 32, INDEXED)
- `factory_id` (VARCHAR 64, INDEXED)
- `current_version` (VARCHAR 32)
- `status` (VARCHAR 16) - `online`, `offline`, `updating`
- `last_heartbeat` (TIMESTAMPTZ, INDEXED)

### 2.2 `firmwares`
Immutable ledger of signed firmware binary images stored in MinIO/S3.
- `id` (UUID, PK)
- `version` (VARCHAR 32, UNIQUE with hw_model)
- `sha256_checksum` (CHAR 64)
- `signature` (TEXT) - NIST P-256 DER encoded in Base64
- `storage_path` (VARCHAR 255)

### 2.3 `deployments` & `deployment_devices`
Tracks multi-phase rollout lifecycles and per-robot execution states:
- Handles canary progression (10% ➡️ 50% ➡️ 100%)
- Records precise update duration and automatic rollback trigger reasons.
