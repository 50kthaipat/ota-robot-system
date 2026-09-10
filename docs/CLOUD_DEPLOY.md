# ☁️ Cloud Deployment Guide
## OTA Robot System — Free Tier Production Stack

คู่มือนี้อธิบาย step-by-step การย้ายระบบจาก Local Docker ขึ้น Cloud
ใช้เวลาทั้งหมดประมาณ **50-60 นาที** โดยไม่ต้องแก้โค้ดเพิ่มเติม

> **หมายเหตุสำคัญ:** Data ในโฟลเดอร์ `data/experiments/*.csv` ไม่ได้รับผลกระทบ
> Cloud Deploy ใช้สำหรับ Demo เท่านั้น ไม่ต้องรัน experiment ใหม่

---

## Stack ที่ใช้ (ฟรีทั้งหมด)

| Service | Provider | URL |
|---|---|---|
| PostgreSQL Database | **Supabase** | supabase.com |
| Object Storage (Firmware) | **Cloudflare R2** | cloudflare.com |
| MQTT Broker | **HiveMQ Cloud** | hivemq.com |
| Backend API (Go Fiber) | **Render.com** | render.com |
| Frontend (Next.js) | **Vercel** | vercel.com |

---

## ขั้นตอนที่ 1 — Supabase (PostgreSQL) 🗄️

**เวลาที่ใช้: ~10 นาที**

### 1.1 สร้าง Project
1. ไปที่ [https://supabase.com](https://supabase.com) → **Start your project**
2. Login ด้วย GitHub
3. กด **New Project**
4. ตั้งชื่อ: `ota-robot-system`
5. ตั้ง Database Password (จดไว้)
6. Region: `Southeast Asia (Singapore)`
7. รอ ~2 นาที

### 1.2 เก็บ Connection String
1. ไปที่ **Project Settings → Database**
2. เลื่อนลงไปที่ **Connection string** → Tab **URI**
3. Copy string รูปแบบ:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### 1.3 Run Database Migration
เปิด PowerShell แล้วรัน:
```powershell
# ติดตั้ง migrate tool (ครั้งเดียว)
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# รัน migrations ขึ้น Supabase (เปลี่ยน [CONNECTION_STRING] เป็นของจริง)
migrate -path backend/internal/db/migrations `
        -database "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require" `
        up
```

✅ **เสร็จแล้ว** — จด `DATABASE_URL` ไว้ (ใส่ `?sslmode=require` ต่อท้ายด้วย)

---

## ขั้นตอนที่ 2 — Cloudflare R2 (Storage) 📦

**เวลาที่ใช้: ~10 นาที**

### 2.1 สร้าง R2 Bucket
1. ไปที่ [https://cloudflare.com](https://cloudflare.com) → Login
2. เมนูซ้าย: **R2 Object Storage** → **Create bucket**
3. ชื่อ bucket: `firmware`
4. Location: ปล่อย auto

### 2.2 สร้าง API Token
1. ไปที่ **R2 → Manage R2 API tokens**
2. **Create API token**
3. ตั้งชื่อ: `ota-robot-api`
4. Permissions: **Object Read & Write**
5. Bucket: เลือก `firmware`
6. กด **Create API Token**
7. **Copy ทั้ง Access Key ID และ Secret Access Key** (โชว์ครั้งเดียว!)

### 2.3 หา Endpoint URL
- รูปแบบ: `[ACCOUNT_ID].r2.cloudflarestorage.com`
- Account ID อยู่ที่ URL ของหน้า Cloudflare dashboard

✅ **จดไว้:**
```
MINIO_ENDPOINT=[account-id].r2.cloudflarestorage.com
MINIO_ACCESS_KEY=[Access Key ID]
MINIO_SECRET_KEY=[Secret Access Key]
```

---

## ขั้นตอนที่ 3 — HiveMQ Cloud (MQTT) 📡

**เวลาที่ใช้: ~5 นาที**

### 3.1 สร้าง Free Cluster
1. ไปที่ [https://hivemq.com/mqtt-cloud-broker](https://hivemq.com/mqtt-cloud-broker)
2. **Start Free** → สร้าง account
3. **Create Free Cluster**
4. เลือก Region ใกล้ที่สุด

### 3.2 สร้าง Credentials
1. ไปที่ **Access Management → Credentials**
2. กด **Add new credentials**
3. Username: `ota-api`
4. Password: (ตั้งเอง — จดไว้)
5. กด **Save**

### 3.3 เก็บ Broker URL
- Cluster URL อยู่ที่หน้า Overview รูปแบบ:
  ```
  [cluster-id].s1.eu.hivemq.cloud
  ```
- Broker URL ที่ใช้: `ssl://[cluster-id].s1.eu.hivemq.cloud:8883`

✅ **จดไว้:**
```
MQTT_BROKER=ssl://[cluster-id].s1.eu.hivemq.cloud:8883
MQTT_USERNAME=ota-api
MQTT_PASSWORD=[password ที่ตั้ง]
```

---

## ขั้นตอนที่ 4 — Render.com (Backend API) 🖥️

**เวลาที่ใช้: ~15 นาที**

### 4.1 เตรียม ECDSA Private Key
```powershell
# รันสคริปต์เพื่อ encode private key เป็น base64
.\scripts\encode_key.ps1

# จะได้ string ยาว → copy ไว้
```

### 4.2 สร้าง Web Service บน Render
1. ไปที่ [https://render.com](https://render.com) → Login ด้วย GitHub
2. **New → Web Service**
3. **Connect a repository** → เลือก `ota-robot-system`
4. ตั้งค่า:
   - **Name:** `ota-api`
   - **Region:** Singapore
   - **Branch:** `main`
   - **Runtime:** Docker
   - **Dockerfile Path:** `./backend/Dockerfile`
   - **Docker Context:** `./backend`
   - **Instance Type:** Free

### 4.3 ใส่ Environment Variables
กด **Advanced → Add Environment Variable** ใส่ทีละตัว:

```
DATABASE_URL        = [Supabase connection string + ?sslmode=require]
MINIO_ENDPOINT      = [Cloudflare R2 endpoint]
MINIO_ACCESS_KEY    = [R2 Access Key ID]
MINIO_SECRET_KEY    = [R2 Secret Access Key]
MINIO_BUCKET        = firmware
MINIO_USE_SSL       = true
MQTT_BROKER         = ssl://[hivemq cluster].hivemq.cloud:8883
MQTT_USE_TLS        = true
MQTT_USERNAME       = ota-api
MQTT_PASSWORD       = [hivemq password]
MQTT_CLIENT_ID      = ota-api-render
JWT_SECRET          = [กด Generate ใน Render หรือ random 64 chars]
ECDSA_PRIVATE_KEY_B64 = [output จาก encode_key.ps1]
API_PORT            = 8000
ENV                 = production
REDIS_URL           =        ← ปล่อยว่าง (ไม่ใช้ Redis บน cloud)
```

### 4.4 Deploy
- กด **Create Web Service**
- รอ ~3-5 นาที (Build Docker image + Deploy)
- ตรวจสอบ: `https://ota-api.onrender.com/health` → ต้องได้ `OK`

> [!WARNING]
> **Render Free Tier จะ Sleep หลังไม่มีการใช้งาน 15 นาที**
> Request แรกหลัง sleep จะช้า ~30 วินาที (cold start)
> สำหรับ demo ให้เข้าหน้า `/health` ก่อนเพื่อ wake up ระบบ

### 4.5 เพิ่ม Deploy Webhook ใน GitHub Secrets
1. Render → Service → **Settings → Deploy Hook** → Copy URL
2. GitHub repo → **Settings → Secrets → Actions**
3. เพิ่ม secret: `RENDER_DEPLOY_HOOK` = URL ที่ copy มา
4. ทุกครั้ง push to `main` จะ auto-deploy ✅

---

## ขั้นตอนที่ 5 — Vercel (Frontend) 🌐

**เวลาที่ใช้: ~5 นาที**

### 5.1 อัปเดต vercel.json
แก้ URL ใน [`vercel.json`](../vercel.json) ให้ตรงกับ Render URL จริง:
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

### 5.2 Deploy บน Vercel
1. ไปที่ [https://vercel.com](https://vercel.com) → Login ด้วย GitHub
2. **Add New Project** → Import `ota-robot-system`
3. **Framework Preset:** Next.js
4. **Root Directory:** `frontend`
5. **Environment Variables** เพิ่ม:
   ```
   NEXT_PUBLIC_API_URL = https://ota-api.onrender.com
   API_INTERNAL_URL    = https://ota-api.onrender.com
   ```
6. กด **Deploy** → รอ ~2 นาที
7. ได้ URL: `https://ota-robot-system.vercel.app`

---

## ขั้นตอนที่ 6 — Verification ✅

```powershell
# 1. ตรวจสอบ API
Invoke-RestMethod "https://ota-api.onrender.com/health"
# ผลที่ต้องได้: OK

# 2. ตรวจสอบ Devices (ต้องมี robots จาก local ที่ register ไว้)
Invoke-RestMethod "https://ota-api.onrender.com/api/v1/devices" | ConvertTo-Json

# 3. เปิด Frontend
Start-Process "https://ota-robot-system.vercel.app"
```

---

## สรุป URLs หลังจาก Deploy เสร็จ

| Service | URL |
|---|---|
| **Web Dashboard** | `https://ota-robot-system.vercel.app` |
| **Backend API** | `https://ota-api.onrender.com` |
| **API Health** | `https://ota-api.onrender.com/health` |
| **API Metrics** | `https://ota-api.onrender.com/metrics` |

---

## Troubleshooting

### API ตอบ 500 หลัง deploy
```powershell
# ดู logs บน Render dashboard → Logs tab
# หรือ check ว่า DATABASE_URL ถูกต้อง
Invoke-RestMethod "https://ota-api.onrender.com/health"
```

### MQTT ไม่เชื่อมต่อ
- ตรวจสอบ `MQTT_BROKER` ว่าขึ้นต้นด้วย `ssl://` ไม่ใช่ `tcp://`
- ตรวจสอบ username/password ใน HiveMQ dashboard

### Frontend เรียก API ไม่ได้
- ตรวจสอบว่า `NEXT_PUBLIC_API_URL` ใน Vercel ตรงกับ Render URL
- ตรวจสอบ CORS ใน Render logs

### Supabase Migration ล้มเหลว
```powershell
# ตรวจสอบ migration status
migrate -path backend/internal/db/migrations `
        -database "[CONNECTION_STRING]" version
```

---

## สำหรับ Thesis — ระบุในเล่มได้ว่า

> _"ระบบได้รับการ Deploy บน Cloud Infrastructure แบบ Free Tier โดยใช้ Supabase PostgreSQL
> เป็นฐานข้อมูล, Cloudflare R2 เป็น Object Storage ที่ Compatible กับ S3 Protocol,
> HiveMQ Cloud เป็น MQTT 5.0 Broker, Render.com เป็น Container Hosting สำหรับ
> Go Fiber v3 Backend API และ Vercel เป็น Edge Network สำหรับ Next.js 14 Dashboard
> โดยระบบสามารถเข้าถึงได้ที่ https://ota-robot-system.vercel.app"_
