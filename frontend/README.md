# OTA Fleet Web Dashboard

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://reactjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Theme](https://img.shields.io/badge/Theme-Cyber%20Dark-8B5CF6)](#uiux-design-system)

The **OTA Fleet Web Dashboard** is an industrial-grade web application designed for robotics operators, automation engineers, and factory supervisors. Built with **Next.js 14 (App Router)** and styled with an industrial **Cyber-Dark** design system, it provides real-time fleet health tracking, firmware management, and canary deployment controls.

---

## 1. Architecture & Directory Layout

```
frontend/
├── Dockerfile                  # Production multi-stage Node.js container build
├── next.config.mjs             # Next.js configuration & API reverse proxy rewrites
├── package.json                # Dependencies and build scripts
├── postcss.config.mjs          # PostCSS / Tailwind preprocessor configuration
├── tailwind.config.ts          # Custom cyber-dark color palette & animations
├── tsconfig.json               # TypeScript strict compilation settings
├── public/                     # Static assets & favicons
└── src/
    ├── app/                    # Next.js 14 App Router (Pages & Layouts)
    │   ├── layout.tsx          # Global Cyber-Dark root layout & navigation bar
    │   ├── globals.css         # Custom industrial CSS utilities & scrollbars
    │   ├── page.tsx            # Fleet Overview (KPI summary cards, robot grid, filter matrix)
    │   ├── deploy/             # New Deployment Wizard
    │   │   └── page.tsx        # Target firmware selection & rollout strategy config
    │   ├── deployments/        # Deployment History & Live Monitor
    │   │   ├── page.tsx        # Active deployments list & status indicators
    │   │   └── [id]/           # Canary Deployment Inspector
    │   │       └── page.tsx    # Live canary phase tracker (20% -> 60% -> 100%) & Emergency Rollback
    │   └── firmware/           # Firmware Repository & Vault
    │       └── page.tsx        # Firmware upload form, ECDSA signature display & version catalog
    ├── components/             # Reusable UI component library
    │   ├── Navbar.tsx          # Top navigation bar with active links & system clock
    │   ├── StatCard.tsx        # Metric summary card
    │   ├── DeviceCard.tsx      # Interactive robot status card with factory badge
    │   ├── ProgressBar.tsx     # Animated deployment progress bar
    │   └── StatusBadge.tsx     # Status badges (online, offline, updating, rolled_back)
    └── lib/                    # Shared utilities & API client
        ├── api.ts              # Fetch client communicating with Go Backend API
        └── types.ts            # TypeScript interfaces for Robot, Firmware, Deployment
```

---

## 2. UI/UX Design System

The dashboard utilizes an **Industrial Cyber-Dark** design language:
- **Backgrounds:** Ultra-dark slate (`#0B0F17`, `#111827`)
- **Accents:** Electric cyan (`#06B6D4`) for fleet status, neon emerald (`#10B981`) for successful updates, vivid amber (`#F59E0B`) for canary stages, and crimson red (`#EF4444`) for emergency rollbacks
- **Typography:** Clean sans-serif (`Inter`) paired with monospace numeric displays for versions and latencies
- **Feedback:** Real-time visual progress bars, live status badges, and single-click emergency rollback actions

---

## 3. Running Locally (Standalone)

### Prerequisites
- Node.js 20+ installed
- Backend API running on `http://localhost:8000`

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 3: Production Build & Test
```bash
npm run build
npm run start
```

---

## 4. API Integration & Reverse Proxy

In production and local environments, Next.js acts as a reverse proxy via [`next.config.mjs`](./next.config.mjs):
- Calls to `/api/v1/*` are automatically proxied to `${API_INTERNAL_URL}/api/v1/*`
- Calls to `/health` are forwarded to the Go backend healthcheck

Detailed UI/UX component specifications and design tokens are documented in:  
[`docs/design/UI_UX_SPEC.md`](../docs/design/UI_UX_SPEC.md)
