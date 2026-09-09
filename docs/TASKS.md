# 📋 Project Task Checklist & Execution Roadmap
**Project:** Cloud-Based OTA Firmware Management System for Robot Fleet  
**Duration:** 6 Weeks Build + 10 Weeks Thesis Preparation  
**Tech Stack:** Go (Fiber v3, sqlc, pgx/v5), TypeScript (Next.js 14, Tailwind, shadcn/ui), MQTT (EMQX), PostgreSQL, Redis, MinIO/R2, Prometheus + Grafana

---

## 📅 Phase 1: Build Core System (Week 1 – 6)

### 🔹 Week 1: Infrastructure, Architecture & Simulator Setup
- [x] ออกแบบ System Architecture & Scope ของโปรเจกต์
- [x] สร้างโครงสร้างโฟลเดอร์โปรเจกต์ทั้งหมด
- [x] สร้างไฟล์คอนฟิกพื้นฐาน (`.env.example`, `docker-compose.yml`)
- [x] ดาวน์โหลด Core Docker Images (`postgres:16`, `redis:7`, `minio/minio`, `emqx:5`)
- [x] ออกแบบ Database Schema (`000001_init.up.sql`)
- [x] สร้าง SQL Queries และคอนฟิก `sqlc.yaml`
- [x] สร้าง Go API Skeleton (`backend/`) ด้วย Fiber v3 + pgx
- [x] สร้าง Go Robot Simulator Agent (`simulator/`) เชื่อมต่อ MQTT
- [x] รัน Core Infrastructure (`docker compose up -d postgres redis minio emqx`)
- [x] รัน Database Migration ครั้งแรก เพื่อสร้างตารางใน PostgreSQL
- [x] ทดสอบส่งข้อความ Heartbeat จาก Robot Sim เข้าสู่ EMQX และบันทึกสถานะลง Database

---

### 🔹 Week 2: End-to-End OTA Flow
- [x] **Firmware Upload Handler:**
  - [x] ตรวจสอบประเภทไฟล์และขนาดไฟล์ `.bin`
  - [x] คำนวณ SHA256 Checksum อัตโนมัติขณะ Upload
  - [x] ส่งไฟล์เข้า Storage (MinIO / Cloudflare R2)
  - [x] บันทึก Version และ Metadata ลง PostgreSQL
- [x] **Presigned Download URL:**
  - [x] สร้าง Endpoint ขอ Presigned URL ที่มีอายุจำกัด (เช่น 15-30 นาที) เพื่อความปลอดภัย
- [x] **MQTT Topic Protocol & Orchestration:**
  - [x] กำหนด Message Payload (`command`, `status`, `progress`, `error`)
  - [x] ให้ API ส่งสัญญาณ `ota/device/{id}/command` เพื่อสั่งอัปเกรด
- [x] **Robot Agent Execution Flow:**
  - [x] Robot รับคำสั่ง `update`
  - [x] Robot ส่ง Status `downloading` + Progress 0-100%
  - [x] Robot ตรวจสอบ SHA256 Hash ตรงกับที่ Server ระบุหรือไม่
  - [x] Robot จำลองการ Reboot และส่ง Heartbeat พร้อม `version` ใหม่กลับมายัง Server

---

### 🔹 Week 3: Web Dashboard (Next.js 14 + TypeScript)
- [x] ตั้งค่า Next.js 14 App Router พร้อม Tailwind CSS และ shadcn/ui
- [x] **Page 1: Fleet Overview (`/`):**
  - [x] ตารางแสดงรายชื่อ Robot ทั้งหมดในระบบ
  - [x] แสดงสถานะ Online/Offline/Updating, Firmware Version, Factory ID, Last Seen แบบ Realtime
- [x] **Page 2: Firmware Management (`/firmware`):**
  - [x] ฟอร์ม Drag & Drop สำหรับ Upload Firmware `.bin`
  - [x] แสดงประวัติ Firmware Version, File Size, SHA256, วันที่สร้าง
- [x] **Page 3: Deployment Launcher (`/deploy`):**
  - [x] เลือก Firmware Version เป้าหมาย
  - [x] เลือกกลุ่ม Robot (All Fleet / เลือกรายตัว / เลือกตาม Factory)
  - [x] เลือก Strategy (Direct Deployment / Canary Rollout)
- [x] **Page 4: Live Deployment Progress (`/deployments/[id]`):**
  - [x] แถบความคืบหน้า (Progress Bar) แต่ละ Robot แบบ Realtime ผ่าน WebSocket

---

### 🔹 Week 4: Canary Rollout, Auto-Rollback & Security
- [x] **Canary Deployment Engine:**
  - [x] แบ่งการ Deploy เป็น 3 ระยะ: Phase 1 (20%) ➡️ Phase 2 (60%) ➡️ Phase 3 (100%)
  - [x] ตั้งเวลารอสังเกตการณ์ในแต่ละ Phase (Wait Interval)
- [x] **Automated Rollback Mechanism:**
  - [x] สร้าง Background Monitoring ตรวจสอบอัตราความล้มเหลว (Failure Rate)
  - [x] หาก Failure Rate > 20% ให้สั่ง Trigger Auto-Rollback ทันที
  - [x] ส่งคำสั่ง `rollback` กลับไปยัง Robot เพื่อคืนค่าเป็น Firmware Version ก่อนหน้า
- [x] **Security & Code Signing:**
  - [x] สร้างคู่คีย์ ECDSA (Private Key บน Server, Public Key ใน Robot Agent)
  - [x] Server เซ็นลายเซ็นดิจิทัลของ Firmware Hash ตอน Upload
  - [x] Robot ตรวจสอบทั้ง SHA256 Checksum และลายเซ็น ECDSA ก่อนเริ่ม Apply

---

### 🔹 Week 5: Cloud Deployment & Monitoring (Observability)
- [ ] **Cloud Free Tier Setup:**
  - [ ] ย้าย Database ขึ้น Supabase PostgreSQL
  - [ ] ย้าย Storage ขึ้น Cloudflare R2 (S3-compatible)
  - [ ] Deploy Go Backend API & Next.js ขึ้น Render.com
  - [ ] ตั้งค่า HiveMQ Cloud Free Broker (สำรองสำหรับ Cloud Deploy)
- [x] **CI/CD Pipeline (GitHub Actions Automation):**
  - [x] ตั้งค่า GitHub Actions Workflow (`.github/workflows/ci.yml`):
    - [x] Backend Go: `go vet`, Unit Testing (`go test -race -cover`), Binary Build
    - [x] Frontend Next.js: ESLint (`npm run lint`), Production App Build (`npm run build`)
    - [x] Docker Build Check: Automated multi-image verification (API, Dashboard, Simulator)
    - [x] Automated Cloud Deploy trigger via Webhook on merge to `main`
- [x] **Prometheus & Grafana (Full Observability System):**
  - [x] Expose Metrics จาก Go API (`/metrics`) เช่น HTTP Request Duration, Active Deployments, Fleet Status, Firmware Distributions
  - [x] เชื่อมโยง Prometheus Scraper กับ Go API (`api:8000`) และ EMQX MQTT Broker (`emqx:18083`)
  - [x] สร้างและ Provision Grafana Dashboards อัตโนมัติ 4 หน้าหลัก:
    1. **OTA Fleet Overview & Health** (`ota-fleet-overview.json`): Total, Online, Offline, Updating, Robots by Factory & Model
    2. **OTA Deployments & Rollout Tracking** (`ota-deployments.json`): Success Rate Gauge, Canary vs Full, Completed vs Rolled Back
    3. **OTA Backend API & System Performance** (`ota-api-performance.json`): HTTP Throughput (req/s), Latency Percentiles (p50, p95, p99), CPU & Memory
    4. **OTA Firmware Distribution & Compliance** (`ota-firmware-distribution.json`): Version Adoption Rate, Factory Distribution Matrix

---

### 🔹 Week 6: Load Testing, Multi-Scenario Experiments & Final Polish
- [x] **k6 Performance & Load Test:**
  - [x] เขียน Script จำลอง Robot 50-100 ตัว ส่ง Status และดาวน์โหลด Firmware พร้อมกัน (`scripts/k6/load_test_fleet.js`)
  - [x] เก็บผลทดสอบ Latency (p95: 2.4ms), Error Rate (0.00%), Throughput (1,304 req/s, 91,480 requests handled)
- [x] **การทดสอบประสิทธิภาพเชิงเปรียบเทียบ 5 สถานการณ์ (Empirical Multi-Scenario Testing):**
  - [x] ออกแบบระเบียบวิธีวิจัยและกรอบการทดลอง 5 สถานการณ์เพื่อตัดอคติข้อมูล (`docs/EXPERIMENTAL_PLAN.md`)
  - [x] พัฒนาสคริปต์รันการทดลองอัตโนมัติ (`scripts/run_experiments.ps1`) ทำการทดสอบซ้ำ (Repeated Trials)
  - [x] รันและบันทึกข้อมูลดิบรายเรคคอร์ดระดับมิลลิวินาทีลงไฟล์ CSV ในเครื่อง (`data/experiments/*.csv`) รวม 290 แถว
  - [x] วัดผลครบทั้ง 5 มิติ: สภาวะปกติ (100% Pass), สกัดกั้นภัยไซเบอร์ (100% Rejection), กู้คืนระบบ (Rollback 1.2s), สภาวะเครือข่ายหน่วง, และป้องกันการส่งข้ามรุ่นฮาร์ดแวร์
- [x] **จัดระเบียบโครงสร้าง Monorepo & ความปลอดภัย Git:**
  - [x] แยกส่วน Frontend (`frontend/`), Backend (`backend/`), และ Edge Simulator (`simulator/`) ชัดเจนที่ Root
  - [x] ปลดกุญแจส่วนตัว (Private Key) และ Vendor Plugins ออกจาก Git tracking เพื่อความปลอดภัยตามมาตรฐานสากล
  - [x] สร้าง Master Documentation Hub (`docs/README.md`) และยกเครื่อง `README.md` ระดับโปรเจกต์
- [ ] อัดวิดีโอ Demo แสดงการใช้งานระบบทุกฟีเจอร์ (พร้อมสำหรับการนำเสนอ)

---

## 📝 Phase 2: Thesis & Academic Documentation (Week 7 – 16)

- [ ] **สัปดาห์ที่ 7:** บทที่ 1 — ความเป็นมา ความสำคัญ วัตถุประสงค์ และขอบเขตของโครงงาน
- [ ] **สัปดาห์ที่ 8:** บทที่ 2 — ทฤษฎีและงานวิจัยที่เกี่ยวข้อง (OTA, MQTT 5.0, IoT Security, Code Signing)
- [ ] **สัปดาห์ที่ 9:** บทที่ 3 — การออกแบบระบบ (System Architecture, Sequence Flow, Database ER-Diagram)
- [ ] **สัปดาห์ที่ 10–11:** บทที่ 4 — การพัฒนาระบบ (Implementation Details, Code Explanations)
- [ ] **สัปดาห์ที่ 12–13:** บทที่ 5 — ผลการทดสอบและวิเคราะห์ข้อมูล (ผลการทดสอบ 5 สถานการณ์, กราฟ Box Plot, CDF, k6 Benchmark)
- [ ] **สัปดาห์ที่ 14:** บทที่ 6 — สรุปผลการทดลอง อภิปรายผล และข้อเสนอแนะ (Future Work)
- [ ] **สัปดาห์ที่ 15–16:** ตรวจทานความถูกต้อง จัด Format เล่มวิทยานิพนธ์ และจัดเตรียม Presentation สไลด์
