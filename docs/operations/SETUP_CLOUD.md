# Cloud Deployment Guide
## OTA Robot System — Free Tier Production Stack

คู่มือนี้อธิบายขั้นตอนการนำระบบจาก Local Docker ขึ้นสู่ระบบ Cloud
ใช้เวลาทั้งหมดประมาณ 50-60 นาที โดยไม่ต้องแก้ไขโค้ดเพิ่มเติม

> **หมายเหตุสำคัญ:** ข้อมูลในไดเรกทอรี `data/experiments/*.csv` ไม่ได้รับผลกระทบ
> การ Deploy บน Cloud ใช้สำหรับการสาธิตระบบ (Live Demonstration)

---

## สถาปัตยกรรมบริการบนคลาวด์ (Free Tier Stack)

| บริการ | ผู้ให้บริการ | URL |
|---|---|---|
| PostgreSQL Database | **Supabase** | supabase.com |
| Object Storage (Firmware) | **Cloudflare R2** | cloudflare.com |
| MQTT Broker | **HiveMQ Cloud** | hivemq.com |
| Backend API (Go Fiber) | **Render.com** | render.com |
| Frontend (Next.js) | **Vercel** | vercel.com |

---

## ขั้นตอนที่ 1 — Supabase (PostgreSQL Database)

เวลาที่ใช้: ประมาณ 10 นาที

### 1.1 สร้าง Project
1. ไปที่ https://supabase.com → เข้าสู่ระบบด้วย GitHub
2. กด New Project
3. ตั้งชื่อ: `ota-robot-system`
4. ตั้งรหัสผ่านฐานข้อมูล (Database Password)
5. เลือกภูมิภาค (Region): `Southeast Asia (Singapore)`
6. รอระบบจัดสรรทรัพยากรประมาณ 2 นาที

### 1.2 จัดเก็บ Connection String
1. ไปที่ Project Settings → Database
2. เลื่อนลงไปที่ Connection string → เลือกแท็บ URI
3. คัดลอกสตริงในรูปแบบ:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### 1.3 ดำเนินการ Database Migration
เปิด PowerShell แล้วรันคำสั่ง:
```powershell
# ติดตั้ง migrate tool (กรณีรันครั้งแรก)
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# ดำเนินการ Migration ไปยัง Supabase
migrate -path backend/internal/db/migrations `
        -database "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require" `
        up
```

---

## ขั้นตอนที่ 2 — Cloudflare R2 (S3-Compatible Object Storage)

เวลาที่ใช้: ประมาณ 10 นาที

### 2.1 สร้าง R2 Bucket
1. ไปที่ https://cloudflare.com → เข้าสู่ระบบ
2. เมนูด้านซ้าย: R2 Object Storage → Create bucket
3. ตั้งชื่อ Bucket: `firmware`
4. Location: ค่าเริ่มต้น (Auto)

### 2.2 สร้าง API Token
1. ไปที่ R2 → Manage R2 API tokens
2. เลือก Create API token
3. ตั้งชื่อ: `ota-robot-api`
4. สิทธิ์การใช้งาน (Permissions): Object Read & Write
5. กำหนด Bucket: เลือก `firmware`
6. กด Create API Token
7. บันทึกค่า Access Key ID และ Secret Access Key

### 2.3 ตรวจสอบ Endpoint URL
- รูปแบบ Endpoint: `[ACCOUNT_ID].r2.cloudflarestorage.com`

---

## ขั้นตอนที่ 3 — HiveMQ Cloud (MQTT Broker)

เวลาที่ใช้: ประมาณ 5 นาที

### 3.1 สร้าง Free Cluster
1. ไปที่ https://hivemq.com/mqtt-cloud-broker
2. เลือก Start Free และสมัครสมาชิก
3. สร้าง Free Cluster และเลือก Region ที่ใกล้ที่สุด

### 3.2 สร้าง Credentials
1. ไปที่ Access Management → Credentials
2. กด Add new credentials
3. กำหนด Username และ Password สำหรับ API Client
4. บันทึกข้อมูลการเข้าสู่ระบบ

### 3.3 จัดเก็บ Broker URL
- รูปแบบ Broker URL: `ssl://[cluster-id].s1.eu.hivemq.cloud:8883`

---

## ขั้นตอนที่ 4 — Render.com (Backend API Service)

เวลาที่ใช้: ประมาณ 15 นาที

### 4.1 จัดเตรียม ECDSA Private Key
```powershell
# รันสคริปต์แปลง Private Key เป็น Base64
.\scripts\encode_key.ps1
```

### 4.2 สร้าง Web Service บน Render
1. ไปที่ https://render.com → เข้าสู่ระบบด้วย GitHub
2. เลือก New → Web Service
3. เลือกเชื่อมต่อกับ Repository `ota-robot-system`
4. ตั้งค่าบริการ:
   - **Name:** `ota-api`
   - **Region:** Singapore
   - **Branch:** `main`
   - **Runtime:** Docker
   - **Dockerfile Path:** `./backend/Dockerfile`
   - **Docker Context:** `./backend`
   - **Instance Type:** Free

### 4.3 กำหนด Environment Variables
ระบุค่าในส่วน Environment Variables:

```
DATABASE_URL          = [Supabase connection string + ?sslmode=require]
MINIO_ENDPOINT        = [Cloudflare R2 endpoint]
MINIO_ACCESS_KEY      = [R2 Access Key ID]
MINIO_SECRET_KEY      = [R2 Secret Access Key]
MINIO_BUCKET          = firmware
MINIO_USE_SSL         = true
MQTT_BROKER           = ssl://[hivemq cluster].hivemq.cloud:8883
MQTT_USE_TLS          = true
MQTT_USERNAME         = ota-api
MQTT_PASSWORD         = [hivemq password]
MQTT_CLIENT_ID        = ota-api-render
JWT_SECRET            = [คีย์สุ่มความยาว 64 ตัวอักษร]
ECDSA_PRIVATE_KEY_B64 = [ผลลัพธ์จาก encode_key.ps1]
API_PORT              = 8000
ENV                   = production
```

### 4.4 Deploy และตรวจสอบสถานะ
- กด Create Web Service
- รอระบบดำเนินการ Build และ Deploy ประมาณ 3-5 นาที
- ทดสอบการทำงาน: `https://ota-api.onrender.com/health` จะต้องได้ผลลัพธ์ `OK`

---

## ขั้นตอนที่ 5 — Vercel (Frontend Web Dashboard)

เวลาที่ใช้: ประมาณ 5 นาที

### 5.1 ตรวจสอบการตั้งค่า vercel.json
ระบุ URL ของ Render ในไฟล์ `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://ota-api.onrender.com/api/$1" }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://ota-api.onrender.com"
  }
}
```

### 5.2 ดำเนินการ Deploy บน Vercel
1. ไปที่ https://vercel.com → เข้าสู่ระบบด้วย GitHub
2. เลือก Add New Project → Import `ota-robot-system`
3. ตั้งค่า Framework Preset: Next.js
4. ตั้งค่า Root Directory: `frontend`
5. กำหนด Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://ota-api.onrender.com`
   - `API_INTERNAL_URL` = `https://ota-api.onrender.com`
6. กด Deploy และรอประมาณ 2 นาที จะได้รับ Domain เช่น `https://ota-robot-system.vercel.app`

---

## ขั้นตอนที่ 6 — การทดสอบและยืนยันผล (Verification)

```powershell
# 1. ตรวจสอบสถานะ API
Invoke-RestMethod "https://ota-api.onrender.com/health"

# 2. ตรวจสอบรายการอุปกรณ์หุ่นยนต์
Invoke-RestMethod "https://ota-api.onrender.com/api/v1/devices" | ConvertTo-Json

# 3. เปิดหน้าแดชบอร์ดผ่านเบราว์เซอร์
Start-Process "https://ota-robot-system.vercel.app"
```

---

## สรุป URLs ระบบบนคลาวด์

| บริการ | URL |
|---|---|
| **Web Dashboard** | `https://ota-robot-system.vercel.app` |
| **Backend API** | `https://ota-api.onrender.com` |
| **API Health Check** | `https://ota-api.onrender.com/health` |
| **API Metrics (Prometheus)** | `https://ota-api.onrender.com/metrics` |

---

## สำหรับเนื้อหาประกอบเล่มวิทยานิพนธ์

> "ระบบได้รับการทดสอบความพร้อมในการทำงานบนสถาปัตยกรรมคลาวด์แบบกระจายศูนย์ โดยใช้ Supabase PostgreSQL
> เป็นฐานข้อมูลหลัก, Cloudflare R2 เป็น Object Storage ตามมาตรฐาน S3 Protocol,
> HiveMQ Cloud เป็นตัวกลางแลกเปลี่ยนข้อความตามโพรโทคอล MQTT 5.0, Render.com เป็นเซิร์ฟเวอร์รัน
> Go Fiber v3 Backend API และ Vercel เป็น Edge Network สำหรับ Next.js 14 Web Dashboard
> เพื่อยืนยันความสามารถในการทำงานร่วมกับโครงสร้างพื้นฐานบนคลาวด์จริงในเชิงอุตสาหกรรม"
