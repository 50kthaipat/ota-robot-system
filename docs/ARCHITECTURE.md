# System Architecture & Engineering Design Document

## 1. บทนำ (Executive Summary)
ระบบ **Cloud-Based OTA (Over-The-Air) Firmware Management Platform for Robot Fleet** ได้รับการออกแบบเพื่อรองรับการบริหารจัดการ อัปเกรด และกู้คืน (Rollback) เฟิร์มแวร์ของหุ่นยนต์อุตสาหกรรมข้ามโรงงาน ผ่านระบบคลาวด์แบบอัตโนมัติ โดยคำนึงถึงความปลอดภัย (Security), ความเสถียร (Reliability) และความสามารถในการวัดผลเชิงประสิทธิภาพ (Observability)

---

## 2. แผนผังภาพรวมระบบ (High-Level Architecture)

```
                       ┌─────────────────────────────────────────┐
                       │          OPERATOR / SUPERVISOR          │
                       │          Web Dashboard (Next.js 14)     │
                       └────────────────────┬────────────────────┘
                                            │ HTTP REST / WebSocket
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLOUD BACKEND API (Go + Fiber v3)                    │
│                                                                                        │
│   ┌────────────────────┐   ┌───────────────────────┐   ┌───────────────────────────┐   │
│   │  Device Registry   │   │  Firmware Repository  │   │  Deployment Orchestrator  │   │
│   │  (Device Tracking) │   │  (SHA256 / Signing)   │   │  (Canary / Auto-Rollback) │   │
│   └─────────┬──────────┘   └──────────┬────────────┘   └─────────────┬─────────────┘   │
│             │                         │                              │                 │
│             ▼                         ▼                              ▼                 │
│      [ PostgreSQL 16 ]         [ MinIO / R2 ]                 [ EMQX MQTT 5 ]          │
│       (Metadata Store)       (Binary S3 Storage)             (Message Broker)          │
└──────────────────────────────────────────────────────────────────────┬─────────────────┘
                                                                       │
                                                       MQTT over TLS   │ (Topic: ota/device/+/command)
                                                                       │
           ┌───────────────────────────────────────────────────────────┴────────────────┐
           │                                                                            │
           ▼                                                                            ▼
┌──────────────────────────────────────┐                     ┌──────────────────────────────────────┐
│        ROBOT FLEET - FACTORY A       │                     │        ROBOT FLEET - FACTORY B       │
│                                      │                     │                                      │
│  ┌────────────────────────────────┐  │                     │  ┌────────────────────────────────┐  │
│  │   Robot Controller Node 01     │  │                     │  │   Robot Controller Node 02     │  │
│  │  ┌──────────────────────────┐  │  │                     │  │  ┌──────────────────────────┐  │  │
│  │  │  OTA Agent (Go Engine)   │  │  │                     │  │  │  OTA Agent (Go Engine)   │  │  │
│  │  │  - MQTT State Publisher  │  │  │                     │  │  │  - MQTT State Publisher  │  │  │
│  │  │  - Resumable Downloader  │  │  │                     │  │  │  - Resumable Downloader  │  │  │
│  │  │  - Checksum & Sig Verify │  │  │                     │  │  │  - Checksum & Sig Verify │  │  │
│  │  └──────────────────────────┘  │  │                     │  │  └──────────────────────────┘  │  │
│  │   [Slot A (Active) | Slot B]   │  │                     │  │   [Slot A (Active) | Slot B]   │  │
│  └────────────────────────────────┘  │                     │  └────────────────────────────────┘  │
└──────────────────────────────────────┘                     └──────────────────────────────────────┘
```

---

## 3. รายละเอียดสถาปัตยกรรมแต่ละส่วน (System Components)

### 3.1 Web Dashboard (Operator Interface)
- **Tech:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **หน้าที่:**
  - ติดตามสถานะของ Robot Fleet แบบ Realtime ผ่าน WebSocket (Online, Offline, Version ปัจจุบัน)
  - อัปโหลดไฟล์ Firmware พร้อมใส่ Release Notes
  - ควบคุมและเลือกกลยุทธ์การ Deploy (Direct หรือ Canary Rollout)
  - มีปุ่มสั่งการ Manual Emergency Rollback ได้ในคลิกเดียว

### 3.2 Cloud Backend API (Control Plane)
- **Tech:** Go 1.22+, Fiber v3, sqlc, pgx/v5
- **หน้าที่:**
  - จัดการข้อมูล Device Registry และ Firmware Metadata
  - สร้าง Presigned URL แบบจำกัดเวลา สำหรับให้ Robot ดาวน์โหลดไฟล์จาก S3-compatible Storage (MinIO / Cloudflare R2)
  - รัน Background Deployment Orchestrator สำหรับทยอยส่งคำสั่งไปยัง Robot ตามเปอร์เซ็นต์ Canary (20% -> 60% -> 100%)
  - ตรวจจับอัตราความล้มเหลว (Failure Rate Watcher) และสั่ง Trigger Auto-Rollback ทันทีหากข้อผิดพลาดเกินเกณฑ์ที่กำหนด

### 3.3 Message Broker & Communication (Transport Layer)
- **Tech:** EMQX 5 (Local Docker) / HiveMQ Cloud (Production)
- **โปรโตคอล:** MQTT 5.0 with QoS 1 (At least once delivery)
- **โครงสร้าง Topics:**
  - `ota/device/{device_id}/status`: Robot รายงาน Version และ Health ทุก 5 วินาที
  - `ota/device/{device_id}/command`: Server ส่งคำสั่ง `update` หรือ `rollback`
  - `ota/device/{device_id}/progress`: Robot รายงานเปอร์เซ็นต์ความคืบหน้า (0-100%)
  - `ota/device/{device_id}/error`: Robot แจ้งข้อผิดพลาดที่เกิดขึ้น

### 3.4 Robot Controller (Edge Layer)
- **Tech:** Go Compiled Binary (รันบน Linux Container หรือบอร์ด Edge)
- **กลไกความปลอดภัย:**
  - คำนวณ SHA256 Hash ของไฟล์ที่โหลดมา เทียบกับ Checksum ที่ระบุในคำสั่ง
  - ตรวจสอบลายเซ็นดิจิทัล ECDSA ป้องกันการโจมตีแบบ Man-in-the-Middle (MITM)
  - รองรับการย้อนกลับเวอร์ชันเดิม (Rollback) ทันทีหากตรวจพบความผิดปกติ

### 3.5 Observability & Monitoring Layer
- **Tech:** Prometheus + Grafana
- **ตัวชี้วัดที่เก็บ:**
  - `ota_deployment_success_rate`: สัดส่วนความสำเร็จของการอัปเกรด
  - `ota_download_duration_seconds`: ความเร็วและเวลาที่ใช้ดาวน์โหลด
  - `ota_device_status_gauge`: จำนวนหุ่นยนต์ที่ Online/Offline แยกตามโรงงาน
  - `http_request_duration_seconds`: ค่าความหน่วงของ API (Latency p95, p99)
