# 📚 OTA Platform Technical & Academic Documentation

Welcome to the comprehensive documentation suite for the **Cloud-Based OTA Firmware Management Platform for Robot Fleet**.

This repository is organized into distinct domain areas separating Frontend, Backend, Infrastructure, and Empirical Academic Evaluation:

---

## 📑 Documentation Directory Structure

```
docs/
├── README.md                     # 🧭 Master Documentation Index (You are here)
├── ARCHITECTURE.md               # 🏗️ Global System Architecture & Sequence Flows
├── EXPERIMENTAL_PLAN.md          # 🔬 Unbiased Multi-Scenario Research Experimental Plan
├── KPIS_AND_EVALUATION.md        # 📊 System Performance Metrics & k6 Benchmark Results
├── SETUP_GUIDE.md                # 🚀 Full Installation, Docker, & Troubleshooting Guide
├── TASKS.md                      # 📋 Engineering Roadmap & Progress (Weeks 1 – 16)
│
├── backend/                      # ⚙️ Backend Control Plane & Data Plane
│   ├── API_SPEC.md               # 📡 RESTful API & MQTT 5.0 Topic Specifications
│   ├── CRYPTO_AND_SECURITY.md    # 🔐 NIST P-256 ECDSA Digital Signatures & Anti-Tamper
│   └── DATABASE_SCHEMA.md        # 🗄️ PostgreSQL ER-Diagram & Relational Tables
│
└── frontend/                     # 💻 Web Dashboard & Operator UI
    └── UI_UX_SPEC.md             # 🎨 Cyber-Dark Design Tokens, Pages & Components
```

---

## 🧭 Navigation Matrix

| Topic | Document | Description |
|---|---|---|
| **System Architecture** | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | High-level topology, microservices interaction, and Canary state machines. |
| **Experimental Plan** | [`docs/EXPERIMENTAL_PLAN.md`](./EXPERIMENTAL_PLAN.md) | Unbiased 5-scenario methodology, variable matrix, and raw data collection. |
| **Backend Control Plane** | [`docs/backend/API_SPEC.md`](./backend/API_SPEC.md) | Full HTTP REST endpoints, payloads, query parameters, and MQTT schemas. |
| **Cryptographic Security** | [`docs/backend/CRYPTO_AND_SECURITY.md`](./backend/CRYPTO_AND_SECURITY.md) | Asymmetric code signing, SHA-256 integrity, and tamper prevention. |
| **Database & ERD** | [`docs/backend/DATABASE_SCHEMA.md`](./backend/DATABASE_SCHEMA.md) | PostgreSQL relational schema, indexes, and entity relationships. |
| **Frontend Web App** | [`docs/frontend/UI_UX_SPEC.md`](./frontend/UI_UX_SPEC.md) | Next.js 14 App Router, Cyber-Dark design tokens, and components. |
| **Performance Evaluation** | [`docs/KPIS_AND_EVALUATION.md`](./KPIS_AND_EVALUATION.md) | Quantitative benchmark evaluation and k6 stress test metrics. |
| **Deployment & Setup** | [`docs/SETUP_GUIDE.md`](./SETUP_GUIDE.md) | Step-by-step local environment setup, Grafana credentials, and clock sync. |
| **Roadmap & Progress** | [`docs/TASKS.md`](./TASKS.md) | Phase 1 implementation checklist and Phase 2 Thesis chapter milestones. |

---

## 📦 Core Domain READMEs
For component-specific development and testing instructions, refer to:
- ⚙️ **Backend Service (Go):** [`backend/README.md`](../backend/README.md)
- 💻 **Fleet Dashboard (Next.js):** [`frontend/README.md`](../frontend/README.md)
- 🤖 **Robot Edge Simulator (Go):** [`simulator/README.md`](../simulator/README.md)
