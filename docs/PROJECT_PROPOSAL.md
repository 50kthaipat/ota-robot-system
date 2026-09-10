# PROJECT PROPOSAL FORM
*Faculty of Engineering | Robotics and Automation Engineering*

---

### 1. Project Title (Subject to Advisor Approval)
* **English Title:** Cloud-Based Over-The-Air (OTA) Firmware Management System for Industrial Robot Fleet
* **Thai Title (Translated):** ระบบจัดการและอัปเดตเฟิร์มแวร์แบบโอทีเอผ่านคลาวด์สำหรับฝูงหุ่นยนต์อุตสาหกรรม

---

### 2. Background and Rationale
In modern Industry 4.0 manufacturing environments, heterogeneous industrial robot fleets—including articulated arms, SCARA, Cartesian, and autonomous mobile robots (AGVs)—operate continuously within mission-critical production lines. Maintaining these robotic systems requires frequent firmware updates to calibrate motion-control kinematics, patch security vulnerabilities, and optimize operational routines. However, conventional industrial firmware deployment paradigms face two fundamental engineering bottlenecks:

* **The Blast Radius and Production Halt Risk:** Traditional global "all-at-once" deployments risk propagating unvetted firmware bugs to an entire fleet simultaneously, causing catastrophic plant shutdowns ("bricking" the fleet) and massive operational losses.
* **Cyber-Physical Security Vulnerabilities:** Remote over-the-air communication channels expose industrial controllers to malicious binary injection, bit-flip corruption, and untrusted execution if end-to-end cryptographic verification is absent at the edge.

To resolve these challenges, this research proposes a robust, fault-tolerant OTA firmware management architecture. The platform introduces a deterministic **Canary Phased Rollout Engine (20% -> 60% -> 100%)** designed to restrict failure exposure to a minor sentinel group with automated rollback capabilities. This is integrated with a lightweight **ECDSA NIST P-256 asymmetric cryptographic verification pipeline** executed directly on edge robot controllers prior to flashing. This approach transforms industrial firmware delivery from a high-risk manual intervention into an autonomous, fault-tolerant, and zero-trust engineering operation.

---

### 3. Objectives
* **3.1** To architect and develop a centralized, cloud-managed OTA orchestration framework designed for continuous, zero-downtime deployment across heterogeneous industrial robot fleets.
* **3.2** To engineer and evaluate an edge-level cryptographic code-verification pipeline using SHA-256 and ECDSA NIST P-256, assessing its efficacy in rejecting unauthorized or tampered binaries and measuring its computational verification overhead on industrial edge controllers.
* **3.3** To design and evaluate a Canary Phased Rollout engine governed by a deterministic Finite State Machine (FSM) with automated failure isolation and rollback mechanisms to preserve fleet operational continuity during firmware fault scenarios.

---

### 4. Scope of the Study
* **Kinematic Fleet Representation:** Five distinct industrial robotic classes: SCARA (`scara-v1`), Delta (`delta-v2`), 6-Axis Articulated (`articulated-v3`), Cartesian (`cartesian-v1`), and Automated Guided Vehicles - AGV (`agv-v1`) distributed across simulated factory nodes.
* **Edge Robot Architecture:** Formal Finite State Machine (FSM) managing transition cycles: `Idle` -> `Downloading` -> `Verifying` -> `Installing` -> `Rebooting` -> `Online` / `Rollback`.
* **Canary Orchestration Engine:** Algorithmic division of fleet populations into progressive tranches (20% -> 60% -> 100%) with automated circuit-breaking triggers upon exceeding predefined error thresholds.
* **Cloud & Storage Infrastructure:** Go Fiber v3 backend control plane, PostgreSQL 16 relational store for fleet metadata and deployment audit trails, MinIO / S3-compatible Object Storage for firmware binary delivery via time-limited Presigned URLs, and EMQX MQTT 5.0 (QoS 1) broker for low-latency command orchestration. (Redis is excluded from the system architecture).
* **Auxiliary Data Processing & Machine Learning:** Post-experiment exploratory analysis using Scikit-learn (Random Forest Regression for latency feature importance and Isolation Forest for outlier detection) evaluated on empirical dataset ($N = 290$ trials) as an analytical study tool rather than an active real-time runtime component.
* **Empirical Validation Matrix:** Systematic evaluation across 5 operational scenarios ($N = 290$ repeated trials) covering nominal baseline execution, cryptographic threat mitigation, fault resilience A/B benchmarking, network stress conditions (150–500 ms latency, 0–10% packet loss), and cross-hardware compatibility verification.

---

### 5. Relevant Courses (Multiple Selections)

| Selection | Course Title | Selection | Course Title |
|:---:|---|:---:|---|
| [  ] | Manufacturing Cost Analysis and Budgeting | **[X]** | **Introduction to Robotics and Automation** |
| **[X]** | **Introduction to Probability and Statistics** | [  ] | Robot Structure Design |
| [  ] | Computer-aided Design and Manufacturing | **[X]** | **Industrial Sensors and Actuators** |
| [  ] | Programmable Logic Controller & Automation | **[X]** | **Software Development for Robotics & Automation** |
| **[X]** | **Embedded System Design** | [  ] | Electronic Circuits |
| [  ] | Manufacturing Processes | [  ] | Principles of Digital Circuit |
| [  ] | Fundamentals of Mechatronics | **[X]** | **Basic Control Theory** |
| [  ] | Fundamentals of Machine Learning | **[X]** | **Industrial Robot** |
| [  ] | Hydraulics and Pneumatics | **[X]** | **Other: Distributed Systems, Cryptography & Cloud Computing** |

---

### 6. Prerequisite Knowledge and Core Technologies
* **Cyber-Physical Security & Cryptography:** Asymmetric elliptic-curve cryptography (ECDSA NIST P-256 over $\text{secp256r1}$), cryptographic hash functions (SHA-256), and Public-Key Infrastructure (PKI).
* **Distributed Systems & Industrial Communication:** Industrial IoT protocol standards (MQTT 5.0 with QoS 1 over TLS 1.2+), deterministic Finite State Machine (FSM) modeling, RESTful control plane architecture, and S3-compatible binary distribution via Presigned URLs.
* **Empirical Benchmarking & Statistical Evaluation:** Non-parametric hypothesis testing (Mann-Whitney U, Shapiro-Wilk normality tests), confidence interval estimation (95% CI), and A/B fault testing.
* **Core Engineering Stack:** 
  * **Go (Golang):** Selected for high-concurrency orchestrator routines, deterministic memory management, and lightweight edge execution.
  * **PostgreSQL 16 & MinIO:** Relational metadata management and S3 object storage.
  * **Next.js 14 / TypeScript:** Operator management portal and live fleet observability.

---

### 7. Work Plan

| Project Milestone | Key Activities and Deliverables |
|---|---|
| **Phase 1: System Architecture & Security Modeling** | Formalizing edge state machine transitions, designing Canary slicing algorithms, and implementing the ECDSA P-256 cryptographic verification engine. |
| **Phase 2: Orchestration & Edge Agent Engineering** | Developing the core deployment orchestrator, edge agent daemon, and resilient MQTT 5.0 telemetry communication channels. |
| **Phase 3: Automated Testing & Fault Injection Framework** | Developing the multi-scenario automated test runner and fault-injection scripts for controlled empirical benchmarking. |
| **Phase 4: Empirical Benchmarking & Statistical Evaluation** | Conducting multi-scenario experiments ($N = 290$ trials), running Mann-Whitney U hypothesis tests, and evaluating fleet survival rates. |
| **Phase 5: Performance Verification & Thesis Finalization** | Analyzing edge computational overhead, documenting architectural findings, compiling performance charts, and defending the thesis. |

---

### 8. Expected Benefits
* **8.1 Production Downtime Mitigation:** Mitigates manufacturing line disruptions caused by faulty software releases by restricting the failure blast radius to an initial canary group, significantly improving fleet survival rates and enabling automated rollback recovery compared to conventional deployments.
* **8.2 Zero-Trust Edge Cryptographic Integrity:** Delivers an empirically validated, zero-trust verification framework capable of executing on industrial edge controllers with minimal latency overhead, confirming real-time viability without disrupting motor motion-control loops.
* **8.3 Standardized Resilient Architecture:** Provides a robust, reproducible architectural blueprint for industrial automation engineers to deploy firmware updates safely across mission-critical, heterogeneous robot fleets.
