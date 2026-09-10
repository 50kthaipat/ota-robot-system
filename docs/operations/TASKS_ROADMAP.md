# Project Task Checklist & Execution Roadmap

**Project:** Cloud-Based OTA Firmware Management System for Robot Fleet  
**Duration:** 6-Week Engineering Implementation & Research Evaluation  
**Tech Stack:** Go (Fiber v3, sqlc, pgx/v5), TypeScript (Next.js 14, Tailwind, shadcn/ui), MQTT 5.0 (EMQX), PostgreSQL 16, MinIO / S3 Storage, Prometheus + Grafana

---

## 1. Phase 1: Core System Engineering (Weeks 1 – 6)

### Week 1: Infrastructure, Architecture & Simulator Setup
- [x] ออกแบบ System Architecture & Research Scope ของโครงงาน
- [x] สร้างโครงสร้างโฟลเดอร์โปรเจกต์แบบ Monorepo
- [x] สร้างไฟล์คอนฟิกพื้นฐาน (`.env.example`, `docker-compose.yml`)
- [x] ดาวน์โหลด Core Docker Images (`postgres:16`, `minio/minio`, `emqx:5`)
- [x] ออกแบบ Database Schema (`000001_init.up.sql`)
- [x] สร้าง SQL Queries และคอนฟิก `sqlc.yaml`
- [x] สร้าง Go API Skeleton (`backend/`) ด้วย Fiber v3 + pgx
- [x] สร้าง Go Robot Simulator Agent (`simulator/`) เชื่อมต่อ MQTT
- [x] รัน Core Infrastructure (`docker compose up -d postgres minio emqx`)
- [x] รัน Database Migration เพื่อสร้างตารางใน PostgreSQL
- [x] ทดสอบส่งข้อความ Heartbeat จาก Robot Sim เข้าสู่ EMQX และบันทึกสถานะลง Database

---

### Week 2: End-to-End OTA Flow & Cryptographic Verification
- [x] **Firmware Upload Handler:**
  - [x] ตรวจสอบประเภทไฟล์และขนาดไฟล์ `.bin`
  - [x] คำนวณ SHA256 Checksum อัตโนมัติขณะ Upload
  - [x] ส่งไฟล์เข้า Object Storage (MinIO / Cloudflare R2)
  - [x] บันทึก Version และ Metadata ลง PostgreSQL
- [x] **Presigned Download URL:**
  - [x] สร้าง Endpoint ขอ Presigned URL ที่มีอายุจำกัดเพื่อความปลอดภัย
- [x] **MQTT Topic Protocol & Orchestration:**
  - [x] กำหนด Message Payload (`command`, `status`, `progress`, `error`)
  - [x] ให้ API ส่งสัญญาณ `ota/device/{id}/command` เพื่อสั่งอัปเกรด
- [x] **Robot Agent Execution Flow:**
  - [x] Robot รับคำสั่ง `update`
  - [x] Robot ส่ง Status `downloading` พร้อมรายงาน Progress 0-100%
  - [x] Robot ตรวจสอบ SHA256 Hash ตรงกับที่ Server ระบุ
  - [x] Robot จำลองการ Reboot และส่ง Heartbeat พร้อมเวอร์ชันใหม่กลับมายัง Server

---

### Week 3: Web Dashboard (Next.js 14 + TypeScript)
- [x] ตั้งค่า Next.js 14 App Router พร้อม Tailwind CSS และ shadcn/ui
- [x] **Page 1: Fleet Overview (`/`):**
  - [x] ตารางแสดงรายชื่อ Robot ทั้งหมดในระบบ
  - [x] แสดงสถานะ Online/Offline/Updating, Firmware Version, Factory ID, Last Seen แบบ Realtime
- [x] **Page 2: Firmware Management (`/firmware`):**
  - [x] ฟอร์มอัปโหลด Firmware `.bin`
  - [x] แสดงประวัติ Firmware Version, File Size, SHA256, วันที่สร้าง
- [x] **Page 3: Deployment Launcher (`/deploy`):**
  - [x] เลือก Firmware Version เป้าหมาย
  - [x] เลือกกลุ่ม Robot (All Fleet / เลือกรายตัว / เลือกตาม Factory)
  - [x] เลือก Strategy (Direct Deployment / Canary Rollout)
- [x] **Page 4: Live Deployment Progress (`/deployments/[id]`):**
  - [x] แสดงความคืบหน้าการอัปเดตของหุ่นยนต์แต่ละเครื่องแบบ Realtime ผ่าน WebSocket

---

### Week 4: Canary Rollout, Auto-Rollback & Code Signing
- [x] **Canary Deployment Engine:**
  - [x] แบ่งการ Deploy เป็น 3 ระยะ: Phase 1 (20%) → Phase 2 (60%) → Phase 3 (100%)
  - [x] กำหนดช่วงเวลาสังเกตการณ์ในแต่ละ Phase (Wait Interval)
- [x] **Automated Rollback Mechanism:**
  - [x] สร้าง Background Monitoring ตรวจสอบอัตราความล้มเหลว (Failure Rate)
  - [x] สั่ง Trigger Auto-Rollback เมื่อเกิดข้อผิดพลาดเกินเกณฑ์ที่กำหนด
  - [x] ส่งคำสั่ง `rollback` กลับไปยัง Robot เพื่อคืนค่าเป็น Firmware Version ก่อนหน้า
- [x] **Security & Code Signing:**
  - [x] สร้างคู่คีย์ ECDSA (Private Key บน Server, Public Key ใน Robot Agent)
  - [x] Server เซ็นลายเซ็นดิจิทัลของ Firmware Hash ตอน Upload
  - [x] Robot ตรวจสอบทั้ง SHA256 Checksum และลายเซ็น ECDSA ก่อนเริ่ม Apply

---

### Week 5: Cloud Deployment & Monitoring (Observability)
- [x] **Cloud Architecture Preparation:**
  - [x] กำหนดโครงแบบสำหรับเชื่อมต่อ Supabase PostgreSQL
  - [x] กำหนดโครงแบบสำหรับเชื่อมต่อ Cloudflare R2 (S3-compatible)
  - [x] กำหนดโครงแบบ Docker สำหรับ Render.com และการตั้งค่า Next.js บน Vercel
  - [x] เชื่อมต่อ HiveMQ Cloud MQTT Broker
- [x] **CI/CD Pipeline (GitHub Actions Automation):**
  - [x] ตั้งค่า GitHub Actions Workflow (`.github/workflows/ci.yml`):
    - [x] Backend Go: `go vet`, Unit Testing (`go test -race -cover`), Binary Build
    - [x] Frontend Next.js: ESLint (`npm run lint`), Production App Build (`npm run build`)
    - [x] Docker Build Check: Multi-image verification (API, Dashboard, Simulator)
- [x] **Prometheus & Grafana (Full Observability System):**
  - [x] Expose Metrics จาก Go API (`/metrics`) เช่น HTTP Request Duration, Active Deployments, Fleet Status
  - [x] เชื่อมโยง Prometheus Scraper กับ Go API (`api:8000`) และ EMQX MQTT Broker
  - [x] จัดทำ Grafana Dashboards อัตโนมัติ 4 หน้าหลัก:
    1. OTA Fleet Overview & Health
    2. OTA Deployments & Rollout Tracking
    3. OTA Backend API & System Performance
    4. OTA Firmware Distribution & Compliance

---

### Week 6: Load Testing, Multi-Scenario Experiments & Data Analysis
- [x] **k6 Performance & Load Test:**
  - [x] พัฒนา Script จำลองหุ่นยนต์ส่งสถานะและดาวน์โหลด Firmware พร้อมกัน (`scripts/k6/load_test_fleet.js`)
  - [x] บันทึกและวิเคราะห์ค่าความหน่วง (Latency p95, p99), Error Rate, และ Throughput ภายใต้สภาวะโหลดสูง
- [x] **การทดสอบจำลอง 5 สถานการณ์ (Simulation-Based Multi-Scenario Testing):**
  - [x] ออกแบบระเบียบวิธีวิจัย 5 สถานการณ์เพื่อขจัดอคติของข้อมูล (`docs/academic/EXPERIMENTAL_PLAN.md`)
  - [x] พัฒนาสคริปต์รันการทดลองอัตโนมัติ (`scripts/run_experiments.ps1`) สำหรับการทดสอบซ้ำ
  - [x] เก็บรวบรวมข้อมูลจำลองระดับมิลลิวินาทีลงไฟล์ CSV ท้องถิ่น (`data/experiments/*.csv`) รวม 290 แถว
  - [x] วัดผลครบทั้ง 5 มิติ: สภาวะปกติ, การสกัดกั้นภัยไซเบอร์, การฉีดข้อผิดพลาดและกู้คืนระบบ, สภาวะเครือข่ายหน่วง, และการป้องกันข้ามรุ่นฮาร์ดแวร์
- [x] **การวิเคราะห์ข้อมูลทางสถิติและการประมวลผลข้อมูลเสริม (Auxiliary ML):**
  - [x] พัฒนาสคริปต์วิเคราะห์สถิติ (`scripts/statistical_analysis.py`) คำนวณค่าเฉลี่ย, ส่วนเบี่ยงเบนมาตรฐาน, ช่วงความเชื่อมั่น 95%, และ Mann-Whitney U Test
  - [x] พัฒนาโมเดล Scikit-learn (`ml/src/train_regression.py`, `ml/src/train_anomaly.py`) สำหรับวิเคราะห์ปัจจัยความสัมพันธ์และตรวจจับความผิดปกติของข้อมูลโทรมาตร
- [x] **การจัดระเบียบ Repository และความปลอดภัย:**
  - [x] แยกโฟลเดอร์ `frontend/`, `backend/`, และ `simulator/` ชัดเจนที่ Root
  - [x] ปลด Private Key และ Runtime Cache ออกจากระบบควบคุมเวอร์ชัน Git
  - [x] จัดทำเอกสารข้อกำหนดทางวิศวกรรม (`docs/`) ให้เป็นมาตรฐานวิชาการ

---

## 2. Phase 2: Academic Documentation & Thesis Chapters

- [ ] **บทที่ 1:** บทนำ ความเป็นมา ความสำคัญ วัตถุประสงค์ และขอบเขตของโครงงาน
- [ ] **บทที่ 2:** ทฤษฎีและงานวิจัยที่เกี่ยวข้อง (OTA Architecture, MQTT 5.0, Cyber-Physical Security, Code Signing)
- [ ] **บทที่ 3:** การออกแบบระบบและสถาปัตยกรรม (System Topology, FSM State Transitions, Cryptographic Verification Flow, Database Schema)
- [ ] **บทที่ 4:** การพัฒนาระบบและการทดลอง (System Implementation, Multi-Scenario Experimental Setup, Instrumentation)
- [ ] **บทที่ 5:** ผลการทดลองและการวิเคราะห์ข้อมูล (สถิติพรรณนา, การทดสอบสมมติฐาน Mann-Whitney U, Box Plots, และผลการวิเคราะห์เชิงสำรวจด้วย Auxiliary Machine Learning)
- [ ] **บทที่ 6:** สรุปผลการวิจัย ข้อจำกัด และแนวทางการพัฒนาต่อยอด (Conclusion, Limitations & Future Work)
