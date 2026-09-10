# Development Setup & Operations Guide

คู่มือการติดตั้ง ใช้งาน และทดสอบระบบ **Cloud-Based OTA Firmware Management Platform for Robot Fleet**

---

## 1. ข้อกำหนดก่อนเริ่มใช้งาน (Prerequisites)

- **ระบบปฏิบัติการ:** Windows 10/11 (แนะนำเปิดใช้งาน WSL2), macOS หรือ Linux
- **เครื่องมือที่จำเป็น:**
  - [Docker Desktop](https://www.docker.com/) (เวอร์ชัน 24+ รองรับ Docker Compose v2)
  - [Go 1.22+](https://go.dev/dl/) (กรณีต้องการรัน Go Backend บน Host)
  - [Node.js 20+](https://nodejs.org/) & `npm` (กรณีต้องการรัน Next.js บน Host)

---

## 2. การจัดเตรียม Security Keys (ECDSA P-256)

ระบบใช้กุญแจเข้ารหัสลับมาตรฐาน **NIST P-256 (secp256r1)** เพื่อเซ็นลายเซ็นดิจิทัลของ Firmware:
- `keys/private.pem` (ใช้บน API Server เพื่อเซ็น Hash Firmware ตอน Upload)
- `keys/public.pem` (ใช้บน Robot Nodes เพื่อ Verify Signature ก่อน Flashing)

หากยังไม่มีไฟล์คีย์ในโฟลเดอร์ `keys/` สามารถสร้างได้ด้วยคำสั่ง:
```powershell
go run scripts/gen_keys.go
```
*(ระบบ API Server จะมีฟังก์ชัน Auto-generate ให้ทันทีหากไม่พบคีย์ตอนเริ่มต้นระบบ)*

---

## 3. ขั้นตอนการรันระบบ Full Stack ผ่าน Docker Compose

### ขั้นตอนที่ 1: เตรียมไฟล์ Environment Variables
คัดลอกไฟล์เทมเพลตไปยัง `.env`:
```powershell
copy .env.example .env
```

### ขั้นตอนที่ 2: Build Images แบบ Sequential (ป้องกัน Windows Docker Snapshotter Bug)
เนื่องจาก Docker Desktop บน Windows อาจเกิดข้อผิดพลาด `lease does not exist` หาก build หลาย service พร้อมกัน ให้สั่ง build ตามลำดับดังนี้:

```powershell
# 1. Build API Server
docker build -t ota-robot-system-api ./backend

# 2. Build Robot Simulator & Tag ให้ครบทั้ง 5 ประเภทหุ่นยนต์
docker build --provenance=false -t ota-robot-system-robot-sim ./simulator
docker tag ota-robot-system-robot-sim:latest ota-robot-system-robot-scara:latest
docker tag ota-robot-system-robot-sim:latest ota-robot-system-robot-delta:latest
docker tag ota-robot-system-robot-sim:latest ota-robot-system-robot-articulated:latest
docker tag ota-robot-system-robot-sim:latest ota-robot-system-robot-cartesian:latest
docker tag ota-robot-system-robot-sim:latest ota-robot-system-robot-agv:latest

# 3. Build Next.js Dashboard
docker build --provenance=false -t ota-robot-system-dashboard ./frontend
```

### ขั้นตอนที่ 3: เริ่มการทำงานของทุก Services
```powershell
docker compose up -d
```

ตรวจสอบสถานะ Containers ทั้งหมด:
```powershell
docker compose ps
```

---

## 4. วิธีเริ่มรันและเข้าใช้งานระบบ (How to Start & Operate the System)

เมื่อผ่านขั้นตอนการเตรียมไฟล์และการ Build ในครั้งแรกเสร็จสิ้นแล้ว ในการใช้งานประจำวันหรือการสาธิตระบบ สามารถเริ่มต้นทำงานตามขั้นตอนดังนี้:

### 4.1 คำสั่งเริ่มรันระบบ (Quick Start)
เปิด PowerShell ในโฟลเดอร์โปรเจกต์ แล้วสั่งรัน Container ทั้งหมดในโหมด Background:
```powershell
docker compose up -d
```

### 4.2 ตรวจสอบความพร้อมของระบบ (System Health Check)
1. **ตรวจสอบความพร้อมของ API Server:**
   ทดสอบเรียกผ่านเบราว์เซอร์หรือ PowerShell:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:8000/health"
   # ผลลัพธ์ที่ได้: OK
   ```
2. **ตรวจสอบสถานะหุ่นยนต์ทั้ง 5 เครื่อง:**
   หุ่นยนต์แต่ละตัวจะเชื่อมต่อ EMQX MQTT Broker และส่ง Heartbeat รายงานสถานะ:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:8000/api/v1/devices" | Select-Object -ExpandProperty data | Format-Table id, hw_model, factory_id, current_version, status
   ```
   *(หุ่นยนต์ครบทั้ง 5 โรงงาน และมีสถานะเป็น online)*

### 4.3 เข้าสู่ Web Management Portal
เปิด Web Browser แล้วเข้าไปที่:
**[http://localhost:3000](http://localhost:3000)**

- **หน้า Fleet Overview (`/`):** แสดงรายชื่อหุ่นยนต์ 5 ตัว สถานะ Online, Firmware Version ปัจจุบัน และโรงงานประจำการ
- **หน้า Firmware Catalog (`/firmware`):** ตรวจสอบ Firmware ที่มีในระบบ พร้อมสถานะยืนยันความปลอดภัย ECDSA Signed หรืออัปโหลด Firmware ใหม่
- **หน้า Deployment Launcher (`/deploy`):** เลือกเวอร์ชัน Firmware ที่ต้องการอัปเกรด, เลือกกลุ่มหุ่นยนต์เป้าหมาย และเลือกกลยุทธ์การอัปเดต (Direct Rollout หรือ Canary Rollout)
- **หน้า Live Monitor (`/deployments/[id]`):** ติดตามความคืบหน้าการดาวน์โหลดและติดตั้ง (Progress 0-100%) ของหุ่นยนต์แต่ละตัวแบบ Realtime

### 4.4 การปิดการทำงานของระบบ (How to Stop)
- **เมื่อต้องการหยุดทำงานชั่วคราว:**
  ```powershell
  docker compose stop
  ```
- **เมื่อต้องการปิดระบบและคืนทรัพยากร:**
  ```powershell
  docker compose down
  ```

---

## 5. แผนผัง Web Consoles และ Port การใช้งาน

| บริการ | URL / Port | หน้าที่ / ข้อมูลประจำตัว |
|---|---|---|
| **Web Dashboard** | [http://localhost:3000](http://localhost:3000) | Next.js Management Portal (Fleet, Firmware, Deployments) |
| **Go Backend API** | [http://localhost:8000](http://localhost:8000) | REST API & Telemetry Ingestion (Health: `/health`) |
| **EMQX MQTT Broker** | [http://localhost:18083](http://localhost:18083) | User: `admin` / Password: `public` (MQTT Port: `1883`) |
| **MinIO Storage** | [http://localhost:9001](http://localhost:9001) | User: `minioadmin` / Password: `minioadmin` (S3 API: `9000`) |
| **Grafana** | [http://localhost:3001](http://localhost:3001) | Metrics Dashboard (User: `admin` / Password: `admin`) |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | Time-series Metrics Engine Scraper (`/metrics`) |
| **PostgreSQL** | `localhost:5432` | DB: `otadb`, User: `ota`, Pass: `ota_password` |

---

## 6. โครงสร้าง Robot Fleet ประจำโรงงานต่าง ๆ

ระบบถูกตั้งค่าให้มีหุ่นยนต์ 5 รูปแบบ กระจายตัวอยู่ใน 5 โรงงานอุตสาหกรรม:

| Container Service | Device Prefix | โมเดลฮาร์ดแวร์ | โรงงานประจำการ (Factory ID) |
|---|---|---|---|
| `robot-scara` | `scara-xxxx` | `scara-v1` | `factory-bkk-01` (กรุงเทพฯ) |
| `robot-delta` | `delta-xxxx` | `delta-v2` | `factory-rayong-02` (ระยอง) |
| `robot-articulated`| `articulated-xxxx`| `articulated-v3` | `factory-chonburi-03` (ชลบุรี) |
| `robot-cartesian` | `cartesian-xxxx` | `cartesian-v1` | `factory-ayutthaya-04` (อยุธยา) |
| `robot-agv` | `agv-xxxx` | `agv-v1` | `factory-samutprakan-05` (สมุทรปราการ) |

---

## 7. ขั้นตอนการทดสอบฟังก์ชันสำคัญ (Testing Procedures)

### 7.1 การอัปโหลด Firmware พร้อมเซ็นลายเซ็นดิจิทัล (ECDSA Signing)
1. เปิดหน้าเบราว์เซอร์ไปที่ [http://localhost:3000/firmware](http://localhost:3000/firmware)
2. อัปโหลดไฟล์ Binary `.bin` พร้อมระบุ Version เช่น `1.2.0`
3. ระบบจะคำนวณ SHA256 และเซ็นลายเซ็น ECDSA P-256 อัตโนมัติ โดยจะแสดงสถานะ ECDSA Signed ในตาราง

### 7.2 การปล่อยอัปเดตแบบ Canary Phased Rollout (3 Phases)
1. ไปที่หน้า [http://localhost:3000/deploy](http://localhost:3000/deploy)
2. เลือก Firmware Version เป้าหมาย
3. เลือก Strategy เป็น **Canary Rollout** และตั้งค่า Rollback Threshold (เช่น 20%)
4. กดยืนยันการ Deploy และระบบจะแสดงผลในหน้า Live Monitor:
   - **Phase 1 (20%):** หุ่นยนต์ตัวแรกจะเริ่มดาวน์โหลด ตรวจสอบลายเซ็น และติดตั้ง (สังเกตการณ์ 15 วินาที)
   - **Phase 2 (60%):** ขยายการติดตั้งไปยังหุ่นยนต์ตัวถัดไป (สังเกตการณ์ 15 วินาที)
   - **Phase 3 (100%):** ปล่อยอัปเดตให้กับหุ่นยนต์ที่เหลือทั้งหมดจนเสร็จสมบูรณ์

### 7.3 การทดสอบระบบความปลอดภัย & Automated Rollback
- หากมีหุ่นยนต์ส่ง Error กลับมาจนอัตราความล้มเหลวแตะหรือเกิน `rollback_threshold` (เช่น 20%):
  - ระบบจะยุติการ Rollout ระยะถัดไปทันที
  - เปลี่ยนสถานะ Deployment เป็น `rolled_back`
  - ส่งคำสั่ง MQTT `action: "rollback"` สั่งให้ทุกตัวถอยกลับไปใช้ Firmware Version ก่อนหน้า (`previous_version`) โดยอัตโนมัติ

---

## 8. คำสั่งที่เป็นประโยชน์ในการดูแลระบบ (Useful Commands)

```powershell
# ดู Logs สดของ API Server
docker logs -f ota-robot-system-api-1

# ดู Logs สดของ Robot SCARA
docker logs -f ota-robot-system-robot-scara-1

# ตรวจสอบสถานะหุ่นยนต์ผ่าน REST API
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/devices" | ConvertTo-Json -Depth 3

# ตรวจสอบรายการ Firmware และลายเซ็น ECDSA
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/firmware" | ConvertTo-Json -Depth 3

# รีสตาร์ทเฉพาะ Robot ทั้งหมด
docker compose restart robot-scara robot-delta robot-articulated robot-cartesian robot-agv

# ปิดระบบทั้งหมด
docker compose down
```
