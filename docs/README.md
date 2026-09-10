# OTA Platform Technical & Academic Documentation

Welcome to the technical and academic documentation suite for the **Cloud-Based OTA Firmware Management Platform for Robot Fleet**.

This repository is organized into distinct domain areas separating System Architecture, Research & Experimental Plan, Backend, Frontend, Cloud Deployment, and Operations:

---

## 1. Documentation Directory Structure

```
docs/
├── README.md                     # Master Documentation Index (This document)
├── ARCHITECTURE.md               # Global System Architecture & Sequence Flows
├── EXPERIMENTAL_PLAN.md          # 5-Scenario Research Experimental Plan & Measurement Methodology
├── PROJECT_PROPOSAL.md           # Academic Project Proposal Specification (KKU Robotics Engineering)
├── SETUP_GUIDE.md                # Full Installation, Docker Orchestration, & Verification Guide
├── CLOUD_DEPLOY.md               # Cloud Production Deployment Guide (Free Tier Stack)
├── TASKS.md                      # Engineering Checklist & Research Execution Roadmap
│
├── backend/                      # Backend Control Plane & Data Plane
│   ├── API_SPEC.md               # RESTful API & MQTT 5.0 Topic Specifications
│   ├── CRYPTO_AND_SECURITY.md    # NIST P-256 ECDSA Digital Signatures & Anti-Tamper Pipeline
│   └── DATABASE_SCHEMA.md        # PostgreSQL Relational Tables & ER-Diagram
│
└── frontend/                     # Web Dashboard & Operator UI
    └── UI_UX_SPEC.md             # UI/UX Specifications, Navigation Hierarchy & Components
```

---

## 2. Master Navigation Matrix

| เอกสาร | Path | วัตถุประสงค์และบทบาทในโครงงาน |
|---|---|---|
| **System Architecture** | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | โครงสร้างระบบภาพรวม ลำดับการสื่อสาร (Sequence Flow) และกลไก Canary FSM |
| **Experimental Plan** | [`docs/EXPERIMENTAL_PLAN.md`](./EXPERIMENTAL_PLAN.md) | ระเบียบวิธีวิจัย 5 สถานการณ์ การเก็บข้อมูลดิบ ($N=290$), วิธีวัดค่าในโค้ด, สถิติ และ Auxiliary ML |
| **Project Proposal** | [`docs/PROJECT_PROPOSAL.md`](./PROJECT_PROPOSAL.md) | แบบเสนอโครงงานวิศวกรรม (วัตถุประสงค์, ขอบเขต, วิชาที่เกี่ยวข้อง, เทคโนโลยีหลัก) |
| **Setup & Operations** | [`docs/SETUP_GUIDE.md`](./SETUP_GUIDE.md) | ขั้นตอนติดตั้ง Docker Compose ทั้งหมด, Health Check, และขั้นตอนทดสอบการทำงาน |
| **Cloud Deployment** | [`docs/CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) | คู่มือย้ายระบบขึ้น Cloud (Supabase, Cloudflare R2, HiveMQ Cloud, Render, Vercel) |
| **Tasks & Roadmap** | [`docs/TASKS.md`](./TASKS.md) | รายการงานวิศวกรรมสัปดาห์ที่ 1–6 และโครงร่างบทวิทยานิพนธ์ |
| **Backend API Spec** | [`docs/backend/API_SPEC.md`](./backend/API_SPEC.md) | รายละเอียด HTTP REST Endpoints, Payloads, Error Codes และหัวข้อ MQTT 5.0 |
| **Crypto & Security** | [`docs/backend/CRYPTO_AND_SECURITY.md`](./backend/CRYPTO_AND_SECURITY.md) | สถาปัตยกรรมการลงและตรวจสอบลายเซ็นดิจิทัล ECDSA NIST P-256 และ SHA-256 |
| **Database Schema** | [`docs/backend/DATABASE_SCHEMA.md`](./backend/DATABASE_SCHEMA.md) | แผนผังฐานข้อมูลเชิงสัมพันธ์ PostgreSQL, คีย์หลัก, ดัชนี และความสัมพันธ์ของตาราง |
| **Frontend UI/UX** | [`docs/frontend/UI_UX_SPEC.md`](./frontend/UI_UX_SPEC.md) | ดีไซน์ซิสเต็ม Next.js 14, โทเค็นสี Cyber-Dark, ผังหน้าเว็บ และคอมโพเนนต์ |

---

## 3. สถานะเอกสาร (Document Status & Deprecation Record)

| เอกสาร | สถานะ | หมายเหตุ |
|---|---|---|
| `docs/API_SPEC.md` | **ลบออกแล้ว (Deleted)** | เอกสารซ้ำซ้อน ถูกควบรวมและย้ายไปอยู่ที่ [`docs/backend/API_SPEC.md`](./backend/API_SPEC.md) |
| `docs/KPIS_AND_EVALUATION.md` | **ลบออกแล้ว (Deleted)** | ถูกแทนที่ด้วย [`docs/EXPERIMENTAL_PLAN.md`](./EXPERIMENTAL_PLAN.md) ซึ่งเป็นกรอบการทดลอง 5 สถานการณ์ที่ขจัดอคติและระบุจุดวัดค่าทางวิศวกรรมครบถ้วน |
| `docs/EXPERIMENTAL_PLAN.md` | **เอกสารหลัก (Active - Single Source of Truth)** | กรอบการทดลองเชิงประจักษ์ 5 สถานการณ์, จุดวัดค่าเวลา, สถิติ และ Auxiliary Machine Learning |
| `docs/ARCHITECTURE.md` | **ปรับปรุงแล้ว (Active)** | ตัด Redis ออกจากสถาปัตยกรรม คงเหลือ PostgreSQL, MinIO S3 Presigned URL, EMQX และ Go Fiber |

---

## 4. คู่มือเฉพาะไดเรกทอรีส่วนประกอบ (Sub-system READMEs)

สำหรับขั้นตอนการพัฒนาและทดสอบเฉพาะส่วนประกอบ สามารถศึกษาเพิ่มเติมได้ที่:
- **Backend Service (Go Fiber v3):** [`backend/README.md`](../backend/README.md)
- **Fleet Dashboard (Next.js 14):** [`frontend/README.md`](../frontend/README.md)
- **Robot Edge Simulator (Go Client):** [`simulator/README.md`](../simulator/README.md)
