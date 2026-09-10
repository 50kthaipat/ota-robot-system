# Documentation Suite & Architecture Navigation

Welcome to the technical and academic documentation suite for the **Cloud-Based OTA Firmware Management Platform for Robot Fleet**.

เอกสารทั้งหมดในไดเรกทอรีนี้ถูกจัดหมวดหมู่ออกเป็น **3 กลุ่มหลัก** เพื่อความชัดเจนในการใช้งานทั้งด้านการวิจัยทางวิศวกรรมและการพัฒนาเชิงเทคนิค:

---

## 1. โครงสร้างหมวดหมู่เอกสาร (Documentation Directory Structure)

```
docs/
├── README.md                           # สารบัญและแผนผังเอกสารทั้งหมด (เอกสารนี้)
│
├── academic/                           # หมวดที่ 1: งานวิจัยและเอกสารประกอบเล่มวิทยานิพนธ์
│   ├── PROJECT_PROPOSAL.md             # แบบเสนอหัวข้อโครงงานวิศวกรรม (Markdown)
│   ├── PROJECT_PROPOSAL.docx           # แบบเสนอหัวข้อโครงงาน (Microsoft Word ส่งอาจารย์)
│   └── EXPERIMENTAL_PLAN.md            # ระเบียบวิธีวิจัย 5 สถานการณ์ จุดวัดเวลา และสถิติ (บทที่ 4-5)
│
├── design/                             # หมวดที่ 2: สถาปัตยกรรมและข้อกำหนดทางเทคนิค (บทที่ 3)
│   ├── ARCHITECTURE.md                 # สถาปัตยกรรมภาพรวม, Sequence Flow และ Canary FSM
│   ├── API_AND_MQTT_SPEC.md            # ข้อกำหนด REST API และ MQTT Topics
│   ├── DATABASE_SCHEMA.md              # แผนผังฐานข้อมูล PostgreSQL 16 และคำอธิบาย Schema
│   ├── CRYPTO_SECURITY.md              # สถาปัตยกรรมการลงและตรวจสอบลายเซ็น ECDSA NIST P-256
│   └── UI_UX_SPEC.md                   # ดีไซน์ซิสเต็มและผังหน้าจอ Next.js 14 Dashboard
│
└── operations/                         # หมวดที่ 3: คู่มือการติดตั้งและสาธิตระบบ
    ├── SETUP_LOCAL.md                  # คู่มือการติดตั้งและรัน Full Stack ผ่าน Docker ในเครื่อง
    ├── SETUP_CLOUD.md                  # คู่มือเชื่อมต่อ Cloud Free Tier สำหรับการสาธิตระบบ
    └── TASKS_ROADMAP.md                # แผนงานความก้าวหน้า 6 สัปดาห์และโครงร่างวิทยานิพนธ์
```

---

## 2. ตารางนำทางเอกสารหลัก (Master Navigation Matrix)

### หมวดที่ 1: วิชาการและวิทยานิพนธ์ (Academic & Thesis)
| เอกสาร | Path | วัตถุประสงค์และบทบาทในโครงงาน |
|---|---|---|
| **Project Proposal (MD)** | [`academic/PROJECT_PROPOSAL.md`](./academic/PROJECT_PROPOSAL.md) | แบบเสนอโครงงานวิศวกรรม ฉบับภาษาอังกฤษ พร้อมระบุวัตถุประสงค์ ขอบเขต และเทคโนโลยีหลัก |
| **Project Proposal (DOCX)**| [`academic/PROJECT_PROPOSAL.docx`](./academic/PROJECT_PROPOSAL.docx) | แบบฟอร์มเสนอโครงงานในรูปแบบ Microsoft Word สำหรับส่งอาจารย์ที่ปรึกษา |
| **Experimental Plan** | [`academic/EXPERIMENTAL_PLAN.md`](./academic/EXPERIMENTAL_PLAN.md) | กรอบการทดลอง 5 สถานการณ์, การวัดเวลาในโค้ด, การวิเคราะห์สถิติ, และ Auxiliary ML |

### หมวดที่ 2: การออกแบบและสถาปัตยกรรม (System Design & Specs)
| เอกสาร | Path | วัตถุประสงค์และบทบาทในโครงงาน |
|---|---|---|
| **System Architecture** | [`design/ARCHITECTURE.md`](./design/ARCHITECTURE.md) | ผังสถาปัตยกรรมรวมของระบบ, ลำดับการสื่อสาร, และ Canary State Machine |
| **API & MQTT Spec** | [`design/API_AND_MQTT_SPEC.md`](./design/API_AND_MQTT_SPEC.md) | รายละเอียด REST API Endpoints, Payloads, Error Codes และหัวข้อ MQTT 5.0 QoS 1 |
| **Database Schema** | [`design/DATABASE_SCHEMA.md`](./design/DATABASE_SCHEMA.md) | แผนผังความสัมพันธ์ตาราง (ER-Diagram), Data Types, และ Indexing ใน PostgreSQL 16 |
| **Crypto & Security** | [`design/CRYPTO_SECURITY.md`](./design/CRYPTO_SECURITY.md) | การเข้ารหัสอสมมาตร ECDSA NIST P-256 และการตรวจสอบความสมบูรณ์ด้วย SHA-256 |
| **Frontend UI/UX** | [`design/UI_UX_SPEC.md`](./design/UI_UX_SPEC.md) | โทเค็นสี Cyber-Dark, Navigation Hierarchy, และคอมโพเนนต์ Next.js 14 |

### หมวดที่ 3: ปฏิบัติการและคู่มือการติดตั้ง (Operations & Guides)
| เอกสาร | Path | วัตถุประสงค์และบทบาทในโครงงาน |
|---|---|---|
| **Local Setup Guide** | [`operations/SETUP_LOCAL.md`](./operations/SETUP_LOCAL.md) | คำแนะนำการ Build และรันคอนเทนเนอร์ 13 Services ด้วย Docker Compose บนเครื่องคอมพิวเตอร์ |
| **Cloud Deploy Guide** | [`operations/SETUP_CLOUD.md`](./operations/SETUP_CLOUD.md) | ขั้นตอนย้ายระบบขึ้น Cloud Free Tier (Supabase, Cloudflare R2, HiveMQ, Render, Vercel) |
| **Roadmap & Tasks** | [`operations/TASKS_ROADMAP.md`](./operations/TASKS_ROADMAP.md) | แผนงานวิศวกรรมสัปดาห์ที่ 1–6 พร้อมโครงร่างเนื้อหาวิทยานิพนธ์ทั้ง 6 บท |

---

## 3. คู่มือเฉพาะไดเรกทอรีส่วนประกอบ (Sub-system READMEs)

สำหรับคำแนะนำการพัฒนาและทดสอบเฉพาะส่วนประกอบ สามารถศึกษาเพิ่มเติมได้ที่:
- **Backend Service (Go Fiber v3):** [`../backend/README.md`](../backend/README.md)
- **Fleet Dashboard (Next.js 14):** [`../frontend/README.md`](../frontend/README.md)
- **Robot Edge Simulator (Go Client):** [`../simulator/README.md`](../simulator/README.md)
