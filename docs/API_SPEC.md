# 📡 API Specification & Communication Protocols

## 1. RESTful API Endpoints (Control Plane)
Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | คำอธิบาย | Request Body / Query | Response Example |
|---|---|---|---|---|
| `GET` | `/health` | ตรวจสอบความพร้อมของระบบ | None | `"OK"` |
| `GET` | `/devices` | แสดงรายการ Robot ทั้งหมด | None | `{"total": 5, "data": [...]}` |
| `GET` | `/devices/:id` | ดูข้อมูล Robot รายตัว | Path param: `id` | `{"id": "robot-01", "version": "1.0.0", "status": "online"}` |
| `POST` | `/firmware/upload` | อัปโหลดไฟล์ Firmware ใหม่ | `multipart/form-data`: `file`, `version`, `release_notes` | `{"id": "uuid", "version": "1.1.0", "sha256": "..."}` |
| `GET` | `/firmware` | รายการ Firmware ทุกเวอร์ชัน | None | `{"data": [...]}` |
| `GET` | `/firmware/:id/url` | ขอ Presigned URL สำหรับดาวน์โหลด | Path param: `id` | `{"url": "https://...", "checksum": "..."}` |
| `POST` | `/deployments` | สั่งเริ่มกระบวนการ OTA Rollout | JSON: `{"firmware_id": "uuid", "strategy": "canary"}` | `{"id": "uuid", "status": "running"}` |
| `GET` | `/deployments/:id` | ตรวจสอบสถานะการ Deploy | Path param: `id` | `{"id": "uuid", "progress": 80, "devices": [...]}` |
| `POST` | `/deployments/:id/rollback` | สั่ง Emergency Rollback ทันที | Path param: `id` | `{"status": "rolled_back"}` |
| `GET` | `/metrics` | Prometheus Metrics Endpoint | Scraped by Prometheus | Raw Prometheus metrics |

---

## 2. MQTT Protocol & Message Schemas (Edge Plane)
Broker Port: `1883` (TCP) / `8083` (WebSocket) / `18083` (Dashboard Console)

### 2.1 Topic: `ota/device/{device_id}/status`
- **ทิศทาง:** Robot ➡️ Server
- **ความถี่:** ทุก 5 วินาที (Heartbeat)
- **Payload:**
```json
{
  "device_id": "robot-a1b2c3d4",
  "factory_id": "factory-bangkok",
  "version": "1.0.0",
  "status": "online",
  "timestamp": "2026-09-07T16:00:00Z"
}
```

### 2.2 Topic: `ota/device/{device_id}/command`
- **ทิศทาง:** Server ➡️ Robot
- **ทริกเกอร์:** เมื่อ Operator สั่ง Deploy บน Web Dashboard
- **Payload (Update):**
```json
{
  "action": "update",
  "version": "1.1.0",
  "download_url": "http://minio:9000/firmware/1.1.0/firmware.bin?token=...",
  "sha256_checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
- **Payload (Rollback):**
```json
{
  "action": "rollback",
  "version": "1.0.0"
}
```

### 2.3 Topic: `ota/device/{device_id}/progress`
- **ทิศทาง:** Robot ➡️ Server
- **ความถี่:** ระหว่างดาวน์โหลดและติดตั้ง
- **Payload:**
```json
{
  "device_id": "robot-a1b2c3d4",
  "progress": 75,
  "status": "installing"
}
```

### 2.4 Topic: `ota/device/{device_id}/error`
- **ทิศทาง:** Robot ➡️ Server
- **ทริกเกอร์:** เมื่อเกิดปัญหา เช่น Checksum ไม่ตรง หรือติดตั้งล้มเหลว
- **Payload:**
```json
{
  "device_id": "robot-a1b2c3d4",
  "error": "checksum mismatch: expected e3b0... got d41d..."
}
```
