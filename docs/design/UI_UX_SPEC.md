# Frontend UI/UX Design System & Pages Specification

[![Next.js](https://img.shields.io/badge/Framework-Next.js%2014-black?style=flat&logo=next.js)](https://nextjs.org)
[![Tailwind](https://img.shields.io/badge/CSS-Tailwind%203.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![Lucide](https://img.shields.io/badge/Icons-Lucide%20React-orange)](https://lucide.dev)

This document describes the design tokens, visual hierarchy, user journey, and component architecture implemented in the Next.js 14 Fleet Web Dashboard.

---

## 1. Visual Theme: Industrial Cyber-Dark

The dashboard uses an industrial mission-control visual theme designed for low eye strain in control rooms and high contrast for urgent telemetry states.

### 1.1 Color Palette
| Token | Hex Value | Semantic Usage |
|---|---|---|
| `bg-primary` | `#0B0F17` | Canvas background, ultra-dark obsidian |
| `bg-surface` | `#111827` | Card surfaces, modals, table headers |
| `border-subtle` | `#1F2937` | Card borders, dividers, subtle grid lines |
| `accent-cyan` | `#06B6D4` | Primary brand, robot online status, active links |
| `accent-emerald` | `#10B981` | Successful updates, verified signatures, 100% health |
| `accent-amber` | `#F59E0B` | In-progress canary phases, downloading states |
| `accent-rose` | `#EF4444` | Offline robots, failed downloads, rollback triggers |

---

## 2. Information Architecture & Page Matrix

```
/ (Fleet Overview)
├── Top Stat Cards (Total Fleet, Online Rate, Latest Firmware, Active Deployments)
├── Factory Filter Tabs (All, Bangkok, Rayong, Chonburi, Ayutthaya)
└── Robot Grid Matrix (Live cards with model, IP, version badge & pulse dot)

/deploy (Rollout Wizard)
├── Step 1: Select Target Firmware (from signed vault)
├── Step 2: Target Scope (All Fleet or Filter by Factory / Model)
└── Step 3: Strategy Selection (Canary Rollout vs Direct Broadcast)

/deployments (Deployment History & Live Rollouts)
└── Table of deployments with progress bars, status tags, and inspect links

/deployments/[id] (Live Canary Inspector)
├── Phase Stepper Visualizer (Phase 1: 20% → Phase 2: 60% → Phase 3: 100%)
├── Live Device Upgrade Progress Table
└── Emergency Manual Rollback Button (Instant reversion to golden image)

/firmware (Firmware Vault)
├── Drag-and-Drop / Upload Form (Version, Model, Binary file)
└── Firmware Registry Cards (Displays SHA-256 digest, ECDSA signature status)
```

---

## 3. Reusable Component Specifications ([`frontend/src/components/`](../../frontend/src/components/))

1. **`Navbar.tsx`:** Sticky glassmorphism header featuring the Phoenix logo, navigation tabs, active route highlight, and live UTC system clock.
2. **`StatCard.tsx`:** Metric cards featuring icon accents, glowing backdrop blurs, and animated numeric counters.
3. **`DeviceCard.tsx`:** Grid item showing individual robot hardware model, factory location badge, current firmware tag, and pulsing online/offline beacon.
4. **`ProgressBar.tsx`:** Dynamic gradient progress bar displaying percentage completion with smooth CSS transitions.
5. **`StatusBadge.tsx`:** Standardized status tags with colored borders and glowing indicator dots (`online`, `offline`, `updating`, `completed`, `rolled_back`).
