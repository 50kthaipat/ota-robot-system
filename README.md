# OTA Robot Fleet Management System

ระบบทดลองสำหรับจัดการการอัปเดตเฟิร์มแวร์หุ่นยนต์ผ่านเครือข่าย: อัปโหลดและเซ็นเฟิร์มแวร์, เลือกกลุ่มเป้าหมาย, ติดตาม rollout/rollback และดู telemetry ผ่าน dashboard. โครงการนี้เป็นต้นแบบเพื่อการศึกษาและการทดลอง **ไม่ใช่ระบบควบคุมโรงงานที่ผ่านการรับรองสำหรับ production**.

## โครงสร้าง

| ส่วน | หน้าที่ |
| --- | --- |
| `backend/` | Go/Fiber API, PostgreSQL, MQTT, การเซ็น ECDSA และ rollout |
| `frontend/` | Next.js 15 dashboard พร้อมหน้า login, fleet, firmware, deployments |
| `simulator/` | ตัวจำลองหุ่นยนต์ที่รับคำสั่ง MQTT และตรวจลายเซ็น |
| `infra/` | Prometheus และ Grafana configuration/dashboards |
| `scripts/`, `ml/` | เครื่องมือทดลอง วิเคราะห์ผล และฝึกโมเดล (บางส่วนเป็นงานวิจัยที่กำลังพัฒนา) |
| `docs/` | เอกสารสถาปัตยกรรม การติดตั้ง และแผนการทดลอง |
| `.github/` | CI และ Dependabot configuration |

## เริ่มใช้งานในเครื่อง

ต้องมี Docker พร้อม Compose v2. คำสั่งตัวอย่างสำหรับ PowerShell:

```powershell
Copy-Item .env.example .env
# เฉพาะเมื่อยังไม่มี keys/private.pem: go run scripts/gen_keys.go
docker compose up -d --build
docker compose ps
```

เปิด dashboard ที่ <http://localhost:3000> และตรวจ API ที่ <http://localhost:8000/health>. การเรียก `/api/v1/*` ที่จัดการ fleet ต้องเข้าสู่ระบบ; ตั้งค่า `ADMIN_USERNAME` และ `ADMIN_PASSWORD` ใน `.env` ก่อนเริ่มระบบ และเปลี่ยนค่าตัวอย่างทุกครั้ง. ถ้าไม่มี `keys/private.pem` ให้สร้างคู่คีย์ก่อนเริ่มระบบ; การเปลี่ยนคีย์จะทำให้เฟิร์มแวร์ที่เซ็นด้วยคีย์เดิมตรวจสอบไม่ผ่าน. ดู [คู่มือการติดตั้ง](docs/operations/SETUP_LOCAL.md) หากต้องการรายละเอียดเพิ่มเติม (บางตัวอย่างคำสั่ง API ในคู่มือเดิมยังไม่รวมขั้นตอน login).

| บริการสำหรับการทดลองในเครื่อง | URL |
| --- | --- |
| Dashboard | <http://localhost:3000> |
| API health | <http://localhost:8000/health> |
| Grafana | <http://localhost:3001> |
| Prometheus | <http://localhost:9090> |
| EMQX console | <http://localhost:18083> |
| MinIO console | <http://localhost:9001> |

> `docker-compose.yml` ใช้รหัสผ่านสาธิต, MQTT แบบไม่ยืนยันตัวตน และ Grafana anonymous admin. ใช้เฉพาะบนเครือข่ายที่เชื่อถือได้ ห้ามนำ configuration นี้ขึ้น production โดยตรง. เก็บ `.env` และ `keys/private.pem` ไว้นอก Git. ดู [นโยบายความปลอดภัย](SECURITY.md).

## ตรวจสอบโค้ด

```powershell
Push-Location backend; go test ./...; Pop-Location
Push-Location simulator; go test ./...; Pop-Location
Push-Location frontend; npm ci; npm run build; Pop-Location
```

CI ทดสอบ Go ทั้งสองโมดูล, build frontend และตรวจ Docker images เมื่อ push/เปิด PR ไปยัง `main`. การ deploy จาก `main` จะเรียก webhook เฉพาะเมื่อกำหนด GitHub Actions secret ชื่อ `RENDER_DEPLOY_HOOK`.

## เอกสาร

- [สารบัญเอกสาร](docs/README.md), [สถาปัตยกรรม](docs/design/ARCHITECTURE.md), [API และ MQTT](docs/design/API_AND_MQTT_SPEC.md)
- [ติดตั้งในเครื่อง](docs/operations/SETUP_LOCAL.md), [ติดตั้งบน Cloud](docs/operations/SETUP_CLOUD.md)
- [แผนการทดลอง](docs/academic/EXPERIMENTAL_PLAN.md), [รายงาน audit เดิม](security/audit_report.md)

รายงาน audit เดิมเป็น snapshot ณ 11 กันยายน 2026; ข้อค้นพบหลายรายการถูกแก้ในโค้ดหลังจากนั้นแล้ว และไม่ควรใช้แทนการตรวจ security/Dependabot alerts ปัจจุบันบน GitHub.
