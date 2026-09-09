# แผนการทำการทดลองและระเบียบวิธีวิจัย (Unbiased Multi-Scenario Experimental Plan)

**โครงการ:** ระบบจัดการและอัปเดตเฟิร์มแวร์แบบ OTA บนคลาวด์สำหรับฝูงหุ่นยนต์อุตสาหกรรม (Cloud-Based OTA Firmware Management System for Robot Fleet)  
**เป้าหมายทางวิชาการ:** การทดสอบเพื่อพิสูจน์สมมติฐานทางวิศวกรรม โดยขจัดอคติ (Data Bias Elimination) ด้วยการจำลองหลายสถานการณ์ (Multi-Scenario Testing) และการทดสอบซ้ำ (Repeated Trials)

---

## 1. บทนำและวัตถุประสงค์ (Introduction & Objectives)

ในการประเมินประสิทธิภาพของระบบอัปเดตเฟิร์มแวร์ทางอากาศ (Over-The-Air: OTA) การทดสอบเฉพาะในสภาวะปกติสมบูรณ์ (Best Case / Nominal Flow) เพียงอย่างเดียวไม่สามารถพิสูจน์ความทนทาน (Resilience) และความปลอดภัย (Security) ของระบบในสภาพแวดล้อมอุตสาหกรรมจริงได้

แผนการทดลองนี้ถูกออกแบบขึ้นเพื่อ:
1. กำจัดอคติของข้อมูล (Data Bias) โดยเพิ่มสถานการณ์การทดลองที่ครอบคลุมทั้งสภาวะเครือข่ายที่มีปัญหา (Adverse Network), การโจมตีทางไซเบอร์ (Cyber Threats), และเฟิร์มแวร์ที่มีข้อผิดพลาด (Fault Injections)
2. สร้างกลุ่มควบคุมเพื่อเปรียบเทียบ (Comparative Baseline: A/B Testing) ระหว่างการอัปเดตแบบดั้งเดิม (Direct Deployment) และการทยอยอัปเดตแบบ Canary (Canary Phased Rollout)
3. บันทึกข้อมูลดิบรายเรคคอร์ด (Raw Empirical Dataset) ในระดับมิลลิวินาที เพื่อนำไปวิเคราะห์ทางสถิติและสร้างแผนภาพในเล่มวิทยานิพนธ์บทที่ 4 และ 5

---

## 2. การตั้งสมมติฐานการวิจัย (Research Hypotheses)

- **สมมติฐานที่ 1 (ความปลอดภัย):** กลไกการลงลายเซ็นดิจิทัล ECDSA NIST P-256 ร่วมกับ SHA-256 สามารถสกัดกั้นการติดตั้งเฟิร์มแวร์ที่ถูกดัดแปลงหรือไม่ได้รับอนุญาตได้ 100% โดยมีค่าใช้จ่ายเวลาประมวลผล (Computational Overhead) เพิ่มขึ้นไม่เกิน 10 มิลลิวินาที
- **สมมติฐานที่ 2 (ความเชื่อถือได้และการกู้คืน):** กลยุทธ์ Canary Rollout (20% -> 60% -> 100%) ร่วมกับระบบ Auto-Rollback อัตโนมัติ สามารถตรวจจับข้อผิดพลาดและระงับการกระจายตัวได้ภายใน 5 วินาที ทำให้ฝูงหุ่นยนต์รอดพ้นความเสียหาย (Fleet Survival Rate) ได้ไม่น้อยกว่า 80% เทียบกับแบบ Direct Deployment ที่เสียหาย 100%
- **สมมติฐานที่ 3 (ประสิทธิภาพเครือข่าย):** การดาวน์โหลดผ่าน MinIO/S3 Presigned URL ร่วมกับการส่งคำสั่งผ่าน MQTT 5.0 QoS 1 สามารถทำงานสำเร็จภายใต้สภาวะเครือข่ายโรงงานที่มีความหน่วง (Latency) สูงถึง 300ms และ Packet Loss 10% ได้อย่างต่อเนื่อง

---

## 3. ตารางเมทริกซ์ตัวแปรการทดลอง (Experimental Variables Matrix)

| ตัวแปร | รายละเอียด |
|---|---|
| **ตัวแปรต้น (Independent Variables)** | - ประเภทสถานการณ์ทดสอบ (5 สถานการณ์)<br>- กลยุทธ์การกระจายเฟิร์มแวร์ (Direct vs Canary)<br>- ความถูกต้องของ Checksum & ECDSA Signature<br>- ความหน่วงเครือข่าย (0ms, 150ms, 300ms) และ Packet Loss (0%, 5%, 10%) |
| **ตัวแปรตาม (Dependent Variables)** | - เวลาดาวน์โหลดจริง (Download Duration, ms)<br>- เวลาในการตรวจสอบลายเซ็น (Signature Verification Duration, ms)<br>- เวลาตอบสนองในการ Rollback (Rollback Reaction Time, ms)<br>- อัตราการปฏิเสธไฟล์ปลอม (Rejection Rate, %)<br>- อัตราความอยู่รอดของฝูงหุ่นยนต์ (Fleet Survival Rate, %) |
| **ตัวแปรควบคุม (Controlled Variables)** | - จำนวนหุ่นยนต์ทดสอบ (5 โหนดจำลอง: SCARA, Delta, Articulated, Cartesian, AGV)<br>- ขนาดไฟล์เฟิร์มแวร์ทดสอบ (10.0 MB มาตรฐาน)<br>- สถาปัตยกรรมเซิร์ฟเวอร์ (Go Fiber v3, PostgreSQL 16, EMQX 5, MinIO) |

---

## 4. รายละเอียด 5 สถานการณ์การทดลอง (5 Scenarios Detailed)

### สถานการณ์ที่ 1: สภาวะปกติสมบูรณ์ (Nominal Baseline Scenario)
- **สภาวะ:** เครือข่ายปกติ, ลายเซ็น ECDSA ถูกต้อง, เฟิร์มแวร์ v2.0.0
- **จำนวนรอบ:** 30 รอบ (N=30)
- **ขั้นตอน:** สั่ง Deploy -> ขอ Presigned URL -> ดาวน์โหลดไบนารี -> ตรวจสอบ SHA-256 -> ตรวจสอบลายเซ็น ECDSA -> จำลอง Reboot สำเร็จ
- **ข้อมูลดิบที่เก็บ:** `download_ms`, `verify_sha256_ms`, `verify_ecdsa_ms`, `reboot_ms`, `total_ms`

### สถานการณ์ที่ 2: การสกัดกั้นการโจมตีและการปลอมแปลง (Security & Code Signing Rejection)
- **สภาวะ:** ทดสอบ 3 เงื่อนไขย่อย (เงื่อนไขละ 10 รอบ รวม 30 รอบ):
  1. *Unsigned Payload:* เฟิร์มแวร์ไม่มีการแนบลายเซ็นดิจิทัล
  2. *Bit-Flip Tampering:* ดัดแปลงเนื้อหาไบนารี 1 ไบต์ระหว่างทาง (SHA-256 Mismatch)
  3. *Key Forgery:* เซ็นด้วย Private Key ปลอมที่ไม่ตรงกับ Public Key ประจำตัวหุ่นยนต์
- **ขั้นตอน:** หุ่นยนต์ดาวน์โหลดไบนารี -> ดำเนินการขั้นตอน Integrity Check -> สกัดกั้นและยกเลิกก่อนการ Flash
- **ข้อมูลดิบที่เก็บ:** `attack_type`, `detection_stage`, `rejection_status` (PASS/FAIL), `rejection_latency_ms`

### สถานการณ์ที่ 3: การฉีดข้อผิดพลาดและเปรียบเทียบการกู้คืน (Fault Injection & Rollback A/B Test)
- **สภาวะ:** ส่งเฟิร์มแวร์ทดสอบ `v2.1.0-buggy` ที่จำลองการแฮงก์ (Crash Loop) หลังบูต
- **กลุ่มทดลอง (A/B Comparison):**
  - *กลุ่ม ก (Control Group - Direct Rollout):* อัปเดตหุ่นยนต์ทั้ง 5 ตัวพร้อมกัน -> หุ่นยนต์ทั้งหมดติด Crash Loop (Fleet Failure 100%)
  - *กลุ่ม ข (Treatment Group - Canary Phased Rollout):* ส่ง Phase 1 (20% = หุ่นยนต์ 1 ตัว) -> ตรวจพบ Error ภายใน 15 วินาที -> Trigger Auto-Rollback ทันที -> ระงับ Phase 2 และ 3
- **ข้อมูลดิบที่เก็บ:** `strategy`, `affected_nodes`, `protected_nodes`, `error_detect_latency_ms`, `rollback_finish_ms`

### สถานการณ์ที่ 4: สภาวะเครือข่ายโรงงานไม่เสถียร (Network Degradation & Jitter Stress)
- **สภาวะ:** จำลองเครือข่ายที่มีสัญญาณรบกวนในโรงงาน:
  - ระดับ 1: Latency 150ms, Packet Loss 0%
  - ระดับ 2: Latency 300ms, Packet Loss 5%
  - ระดับ 3: Latency 500ms, Packet Loss 10%
- **ขั้นตอน:** ทดสอบการดาวน์โหลดไฟล์ขนาด 10MB และการสื่อสารคำสั่งผ่าน MQTT QoS 1
- **ข้อมูลดิบที่เก็บ:** `network_profile`, `mqtt_retry_count`, `download_throughput_kbps`, `download_duration_ms`

### สถานการณ์ที่ 5: การป้องกันการอัปเดตข้ามรุ่นฮาร์ดแวร์ (Heterogeneous Compatibility Rejection)
- **สภาวะ:** ส่งเฟิร์มแวร์ที่คอมไพล์สำหรับ `scara-v1` ไปยังหุ่นยนต์ต่างรุ่น (`delta-v2`, `agv-v1`, `articulated-v3`, `cartesian-v1`)
- **ขั้นตอน:** การตรวจสอบ Compatibility Header ที่ Server-side และการตรวจสอบ Board Signature ที่ Edge Agent
- **ข้อมูลดิบที่เก็บ:** `target_hw_model`, `firmware_hw_model`, `rejection_code`, `prevention_success`

---

## 5. การจัดการข้อมูลดิบ (Local Data Retention Policy)

ตามมาตรฐานความปลอดภัยและความเป็นส่วนตัวของงานวิจัย:
- ข้อมูลดิบทั้งหมดจะถูกบันทึกเป็นไฟล์ `.csv` ลงในโฟลเดอร์:
  ```
  data/experiments/
  ├── scenario_1_nominal_raw.csv
  ├── scenario_2_security_raw.csv
  ├── scenario_3_rollback_comparison_raw.csv
  ├── scenario_4_network_stress_raw.csv
  ├── scenario_5_compatibility_raw.csv
  └── master_experiment_dataset.csv
  ```
- ไดเรกทอรี `data/experiments/` และไฟล์ `.csv` ทั้งหมดถูกกำหนดไว้ใน `.gitignore` เรียบร้อยแล้ว **จะไม่มีการนำขึ้น GitHub อย่างเด็ดขาด**
- ผู้จัดทำสามารถนำไฟล์ CSV ดังกล่าวไปเปิดในโปรแกรมประมวลผล เช่น Microsoft Excel, SPSS, หรือเขียนสคริปต์ Python (Jupyter Notebook) เพื่อพล็อตกราฟ Box Plot และ Histogram สำหรับประกอบเล่มวิทยานิพนธ์บทที่ 5 ได้โดยตรง
