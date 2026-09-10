# แผนการทำการทดลองและระเบียบวิธีวิจัย (Unbiased Multi-Scenario Experimental Plan)

**โครงการ:** ระบบจัดการและอัปเดตเฟิร์มแวร์แบบ OTA บนคลาวด์สำหรับฝูงหุ่นยนต์อุตสาหกรรม (Cloud-Based OTA Firmware Management System for Robot Fleet)  
**เป้าหมายทางวิชาการ:** การทดสอบเพื่อพิสูจน์สมมติฐานทางวิศวกรรม โดยขจัดอคติ (Data Bias Elimination) ด้วยการจำลองหลายสถานการณ์ (Multi-Scenario Testing) และการทดสอบซ้ำ (Repeated Trials)

---

## 1. บทนำและวัตถุประสงค์ (Introduction & Objectives)

ในการประเมินประสิทธิภาพของระบบอัปเดตเฟิร์มแวร์ทางอากาศ (Over-The-Air: OTA) การทดสอบเฉพาะในสภาวะปกติสมบูรณ์ (Best Case / Nominal Flow) เพียงอย่างเดียวไม่สามารถพิสูจน์ความทนทาน (Resilience) และความปลอดภัย (Security) ของระบบในสภาพแวดล้อมอุตสาหกรรมจริงได้

แผนการทดลองนี้ถูกออกแบบขึ้นเพื่อ:
1. กำจัดอคติของข้อมูล (Data Bias) โดยเพิ่มสถานการณ์การทดลองที่ครอบคลุมทั้งสภาวะเครือข่ายที่มีปัญหา (Adverse Network), การคุกคามทางไซเบอร์และการปลอมแปลงข้อมูล (Cyber Threats), และการเกิดข้อผิดพลาดของเฟิร์มแวร์ (Fault Injections)
2. สร้างกลุ่มควบคุมเพื่อเปรียบเทียบ (Comparative Baseline: A/B Testing) ระหว่างการอัปเดตแบบดั้งเดิมที่ปล่อยพร้อมกันทั้งหมด (Direct Deployment) และการทยอยอัปเดตแบบเป็นระยะ (Canary Phased Rollout)
3. บันทึกข้อมูลการจำลองรายเรคคอร์ด (Simulation-Generated Dataset) ในระดับมิลลิวินาที เพื่อนำไปวิเคราะห์ทางสถิติและประมวลผลข้อมูลสำหรับประกอบเล่มวิทยานิพนธ์

---

## 2. การตั้งสมมติฐานการวิจัย (Research Hypotheses)

- **สมมติฐานที่ 1 (ด้านความมั่นคงปลอดภัย):** กลไกการลงลายเซ็นดิจิทัล ECDSA NIST P-256 ร่วมกับการตรวจสอบแฮช SHA-256 สามารถตรวจจับและปฏิเสธไบนารีเฟิร์มแวร์ที่ถูกดัดแปลงหรือไม่ได้รับอนุญาตได้อย่างสมบูรณ์ โดยมีค่าใช้จ่ายเวลาประมวลผล (Computational Overhead) อยู่ในเกณฑ์ต่ำที่ไม่กระทบต่อวงรอบการควบคุมหุ่นยนต์
- **สมมติฐานที่ 2 (ด้านความเชื่อถือได้และการกู้คืน):** กลยุทธ์การทยอยอัปเกรดแบบ Canary Phased Rollout (20% → 60% → 100%) ร่วมกับกลไก Auto-Rollback อัตโนมัติ สามารถจำกัดขอบเขตความเสียหาย (Blast Radius) และลดจำนวนหุ่นยนต์ที่ล้มเหลวได้อย่างมีนัยสำคัญทางสถิติ เมื่อเทียบกับการปล่อยอัปเดตพร้อมกันทั้งฝูง (Direct Deployment)
- **สมมติฐานที่ 3 (ด้านความทนทานต่อสภาวะเครือข่าย):** การกระจายไฟล์เฟิร์มแวร์ผ่าน S3-compatible Presigned URL ร่วมกับโพรโทคอล MQTT 5.0 (QoS 1) สามารถรักษาเสถียรภาพและอัตราความสำเร็จในการส่งมอบเฟิร์มแวร์ภายใต้สภาวะเครือข่ายโรงงานที่มีความหน่วง (Latency) และการสูญหายของแพ็กเก็ต (Packet Loss)

---

## 3. ตารางเมทริกซ์ตัวแปรการทดลอง (Experimental Variables Matrix)

| ตัวแปร | รายละเอียด |
|---|---|
| **ตัวแปรต้น (Independent Variables)** | - รูปแบบสถานการณ์ทดสอบ (5 สถานการณ์)<br>- กลยุทธ์การกระจายเฟิร์มแวร์ (Direct Deployment เทียบกับ Canary Phased Rollout)<br>- ความสมบูรณ์ของไบนารีและลายเซ็นดิจิทัล (Valid, Unsigned, Tampered, Forged)<br>- สภาวะเครือข่ายจำลอง (ระดับ Latency และ Packet Loss) |
| **ตัวแปรตาม (Dependent Variables)** | - ระยะเวลาดาวน์โหลดไฟล์ (Download Duration, ms)<br>- ระยะเวลาตรวจสอบความถูกต้องของแฮช (SHA-256 Verification Time, ms)<br>- ระยะเวลาตรวจสอบลายเซ็นดิจิทัล (ECDSA Verification Overhead, ms)<br>- ระยะเวลาตรวจพบข้อผิดพลาดและส่งคำสั่งกู้คืน (Rollback Reaction Time, ms)<br>- อัตราการสกัดกั้นไฟล์ผิดกฎเกณฑ์ (Rejection Rate, %)<br>- สัดส่วนหุ่นยนต์ที่รอดพ้นความเสียหาย (Fleet Survival Rate, %) |
| **ตัวแปรควบคุม (Controlled Variables)** | - จำนวนโหนดหุ่นยนต์ทดสอบ (5 โหนด: SCARA, Delta, Articulated, Cartesian, AGV)<br>- ขนาดของไฟล์ไบนารีทดสอบ (10.0 MB กำหนดเป็นมาตรฐานเท่ากันทุกรอบ)<br>- สถาปัตยกรรมบริการหลัก (Go Fiber v3, PostgreSQL 16, EMQX 5 MQTT Broker, MinIO Storage Engine) |

---

## 4. รายละเอียด 5 สถานการณ์การทดลอง (5 Scenarios Detailed)

### สถานการณ์ที่ 1: สภาวะปกติสมบูรณ์ (Nominal Baseline Scenario)
- **สภาวะ:** เครือข่ายปกติ, ลายเซ็น ECDSA ถูกต้อง, เฟิร์มแวร์ทดสอบรุ่น v2.0.0
- **จำนวนรอบ:** 30 รอบ (N=30)
- **ขั้นตอน:** ผู้ควบคุมสั่ง Deploy ผ่าน API → ขอรับ Presigned URL → หุ่นยนต์ดาวน์โหลดไบนารี → ตรวจสอบ SHA-256 Checksum → ตรวจสอบ ECDSA Signature → จำลองการ Reboot และส่ง Heartbeat ยืนยันเวอร์ชันใหม่
- **ตัวแปรที่บันทึก:** `download_ms`, `verify_sha256_ms`, `verify_ecdsa_ms`, `reboot_ms`, `total_ms`

### สถานการณ์ที่ 2: การสกัดกั้นการโจมตีและการปลอมแปลง (Security & Code Signing Rejection)
- **สภาวะ:** ทดสอบ 3 เงื่อนไขย่อย (เงื่อนไขละ 10 รอบ รวม 30 รอบ):
  1. *Unsigned Payload:* เฟิร์มแวร์ไม่มีการแนบลายเซ็นดิจิทัลมากับคำสั่ง
  2. *Bit-Flip Tampering:* ดัดแปลงเนื้อหาไบนารี 1 ไบต์ระหว่างทาง ส่งผลให้ SHA-256 Digest ไม่ตรงกัน
  3. *Key Forgery:* เซ็นลายเซ็นด้วย Private Key ปลอมที่ไม่ตรงกับ Public Key ประจำตัวหุ่นยนต์
- **ขั้นตอน:** หุ่นยนต์รับคำสั่งและดาวน์โหลดไฟล์ → ดำเนินกระบวนการ Integrity Verification → สกัดกั้นและยกเลิกก่อนการติดตั้ง
- **ตัวแปรที่บันทึก:** `attack_type`, `detection_stage`, `rejection_status`, `rejection_latency_ms`

### สถานการณ์ที่ 3: การฉีดข้อผิดพลาดและเปรียบเทียบการกู้คืน (Fault Injection & Rollback A/B Test)
- **สภาวะ:** ส่งเฟิร์มแวร์ทดสอบที่มีข้อผิดพลาดจำลอง ส่งผลให้ระบบ Crash Loop ภายหลังการบูต
- **กลุ่มทดลอง (A/B Testing):**
  - *กลุ่มควบคุม (Direct Rollout):* อัปเดตหุ่นยนต์ทั้ง 5 เครื่องพร้อมกันทั้งหมด เพื่อสังเกตผลกระทบแบบ All-at-once
  - *กลุ่มทดสอบ (Canary Phased Rollout):* ส่งคำสั่งระยะที่ 1 (20% หรือ 1 เครื่อง) → ตรวจจับ Error ผ่าน Health Watcher → สั่ง Trigger Auto-Rollback ทันที → ระงับการอัปเดตในระยะที่ 2 และ 3
- **ตัวแปรที่บันทึก:** `strategy`, `affected_nodes`, `protected_nodes`, `error_detect_latency_ms`, `rollback_finish_ms`

### สถานการณ์ที่ 4: สภาวะเครือข่ายโรงงานไม่เสถียร (Network Degradation & Jitter Stress)
- **สภาวะ:** จำลองสภาพเครือข่ายที่มีสัญญาณรบกวนและความหน่วง:
  - สภาวะ A: Latency 150ms, Packet Loss 0%
  - สภาวะ B: Latency 300ms, Packet Loss 5%
  - สภาวะ C: Latency 500ms, Packet Loss 10%
- **ขั้นตอน:** ทำการทดสอบการดาวน์โหลดไฟล์ขนาด 10MB และการแลกเปลี่ยนสถานะผ่าน MQTT QoS 1
- **ตัวแปรที่บันทึก:** `network_profile`, `mqtt_retry_count`, `download_throughput_kbps`, `download_duration_ms`

### สถานการณ์ที่ 5: การป้องกันการอัปเดตข้ามรุ่นฮาร์ดแวร์ (Heterogeneous Compatibility Rejection)
- **สภาวะ:** ส่งเฟิร์มแวร์ที่สร้างขึ้นเฉพาะสำหรับรุ่น `scara-v1` ไปยังหุ่นยนต์รุ่นอื่น (`delta-v2`, `agv-v1`, `articulated-v3`, `cartesian-v1`)
- **ขั้นตอน:** การตรวจสอบ Compatibility Header ที่ฝั่งเซิร์ฟเวอร์ และการตรวจสอบ Hardware Target Identifier ที่ Edge Agent
- **ตัวแปรที่บันทึก:** `target_hw_model`, `firmware_hw_model`, `rejection_code`, `prevention_success`

---

## 5. ระเบียบวิธีและตำแหน่งการวัดค่าทางวิศวกรรม (Measurement Methodology)

เพื่อให้ผลการทดลองสามารถทำซ้ำได้ (Reproducibility) และมีความโปร่งใสทางวิชาการ การเก็บค่าเวลาและตัวแปรประสิทธิภาพถูกกำหนดจุดวัดในโค้ดอย่างชัดเจน:

### 5.1 การวัดระยะเวลา (Timing Instrumentation)

| ตัวชี้วัด | จุดตรวจวัดในระบบ | เครื่องมือและวิธีวัด |
|---|---|---|
| `download_time_ms` | ก่อนและหลังฟังก์ชันดาวน์โหลดไฟล์ผ่าน HTTP GET ในตัวจำลองหุ่นยนต์ | ใช้การจับเวลาแบบ High-Resolution Timer (`System.Diagnostics.Stopwatch` / `time.Since()`) |
| `hash_verify_time_ms` | ช่วงเวลาคำนวณและเทียบ SHA-256 Digest | ฟังก์ชัน `sha256.Sum256()` ในตัวจำลองหุ่นยนต์ |
| `signature_verify_time_ms` | ช่วงเวลาถอดรหัสและตรวจสอบลายเซ็น ECDSA | ฟังก์ชัน `verifyECDSASignature()` ใน `simulator/main.go` วัดเฉพาะการประมวลผลอัลกอริทึม |
| `reboot_apply_time_ms` | เวลาตั้งแต่เริ่มกระบวนการสลับ Slot จนส่ง Heartbeat ยืนยัน | วงรอบการสลับสถานะใน State Machine ของหุ่นยนต์ |
| `rollback_time_ms` | เวลาตั้งแต่ตรวจพบ Error Event จนกระทั่งระบบยืนยันการคืนค่าสำเร็จ | เวลาที่บันทึกผ่าน MQTT Audit Log และตารางประวัติ Deployment |

**ข้อกำหนดการวัด:**
- หน่วยเวลา: มิลลิวินาที (ms)
- การตัด JIT Effect: ไม่นำข้อมูลรอบแรกสุด (Warmup Trial) มานับรวม เพื่อป้องกันความคลาดเคลื่อนจากการโหลดหน่วยความจำครั้งแรก

### 5.2 การจำลองสภาพเครือข่ายและสถาปัตยกรรมสื่อสาร (Network Simulation & Transport)
- **การจำลองสภาพเครือข่าย:** ในสภาพแวดล้อมการทดสอบบนระบบปฏิบัติการ Windows ได้ใช้วิธีการกำหนดพารามิเตอร์แบบ Parameterized Delay Injection ในสคริปต์ทดสอบ โดยควบคุมค่า Latency (150ms, 300ms, 500ms) และสุ่มค่าความล้มเหลวเพื่อสะท้อน Packet Loss ตามระดับที่กำหนด
- **ช่องทางสื่อสาร MQTT ในสภาพแวดล้อม Local เทียบกับ Production:**
  - *สภาพแวดล้อมการประเมินในเครื่อง (Local Evaluation / Docker Containers):* ใช้งานโปรโตคอล MQTT แบบ Plaintext (TCP พอร์ต 1883 แบบไม่เปิด TLS และ Anonymous) เพื่อลด Overhead การทดสอบบนเครื่องเดี่ยว
  - *สภาพแวดล้อมจริงบนคลาวด์ (Production Cloud):* กำหนดค่าใช้งาน TLS 1.2+ (พอร์ต 8883 / `ssl://`) ร่วมกับการยืนยันตัวตนด้วย Username/Password เพื่อความมั่นคงปลอดภัยตามมาตรฐาน Zero-Trust

---

## 6. การวิเคราะห์ข้อมูลทางสถิติและการประมวลผลข้อมูลเสริม (Data Analysis & Auxiliary Machine Learning)

### 6.1 การวิเคราะห์ทางสถิติเชิงพรรณนาและเชิงอนุมาน
- **สถิติพรรณนา:** คำนวณค่าเฉลี่ย (Mean), ค่าเบี่ยงเบนมาตรฐาน (Standard Deviation), ค่ามัธยฐาน (Median), และช่วงความเชื่อมั่น 95% (95% Confidence Interval)
- **การทดสอบความปกติของการแจกแจง (Normality Test):** ใช้ Shapiro-Wilk Test ในการตรวจสอบการแจกแจงของข้อมูลก่อนเลือกวิธีทดสอบสมมติฐาน
- **การทดสอบสมมติฐานแบบไม่พึ่งพารามิเตอร์ (Non-parametric Test):** ใช้ Mann-Whitney U Test ในการเปรียบเทียบผลระหว่าง Direct Deployment และ Canary Rollout เพื่อยืนยันความแตกต่างอย่างมีนัยสำคัญทางสถิติ ($p < 0.05$)

### 6.2 บทบาทของการเรียนรู้ของเครื่องและลักษณะชุดข้อมูล (Machine Learning & Synthetic Simulation Dataset)
> **หมายเหตุสำคัญ:** 
> 1. **ลักษณะของชุดข้อมูล (Synthetic Simulation Dataset):** ชุดข้อมูลการทดลอง ($N = 290$ แถว) เป็นชุดข้อมูลจำลองที่สร้างขึ้นผ่านระบบโมเดลสโตแคสติกและการฉีดข้อผิดพลาดในสคริปต์การทดลอง (`run_experiments.ps1`) เพื่อประเมินสถาปัตยกรรมระบบในระดับข้อเสนอโครงงาน โดยยังไม่ใช่การวัดเชิงประจักษ์จากฮาร์ดแวร์หุ่นยนต์จริงในโรงงานอุตสาหกรรม (ซึ่งเป็นเป้าหมายในงานวิจัยขั้นต่อไป)
> 2. **บทบาทของ Machine Learning:** ในโครงงานนี้ การเรียนรู้ของเครื่อง (Machine Learning) ไม่ใช่ส่วนประกอบของระบบหลักแบบ Real-time บนหุ่นยนต์ แต่ทำหน้าที่เป็น **เครื่องมือเสริมสำหรับการวิเคราะห์ข้อมูลเชิงสำรวจหลังการทดลอง (Auxiliary Exploratory Data Analysis)**
> - นำชุดข้อมูลจำลองมาประมวลผลด้วยโมเดล Scikit-learn:
>   - **Random Forest Regression:** วิเคราะห์ปัจจัยเชิงสหสัมพันธ์ (Feature Importance) ที่ส่งผลต่อระยะเวลาดาวน์โหลดและความหน่วงของระบบ
>   - **Isolation Forest:** ตรวจสอบความผิดปกติหรือค่าผิดปกติ (Anomaly / Outlier Detection) ของข้อมูลโทรมาตรในเครือข่าย
> - ผลลัพธ์จากการเรียนรู้ของเครื่องนำมาใช้ประกอบการอภิปรายผลในเล่มวิทยานิพนธ์ เพื่อให้เห็นภาพความสัมพันธ์ของตัวแปรในระบบได้อย่างรอบด้าน

---

## 7. แผนการจัดเก็บข้อมูลดิบและขั้นตอนการทำซ้ำ (Data Retention & Reproducibility)

### 7.1 การจัดเก็บข้อมูลดิบในเครื่อง
ข้อมูลการทดลองทั้งหมดถูกจัดเก็บเป็นไฟล์ CSV ภายในไดเรกทอรีท้องถิ่น:
```
data/experiments/
├── scenario_1_nominal_raw.csv
├── scenario_2_security_raw.csv
├── scenario_3_rollback_comparison_raw.csv
├── scenario_4_network_stress_raw.csv
├── scenario_5_compatibility_raw.csv
└── master_experiment_dataset.csv
```
ไดเรกทอรีนี้ถูกระบุไว้ใน `.gitignore` เพื่อรักษาความปลอดภัยของข้อมูลและป้องกันการอัปโหลดไฟล์ข้อมูลดิบขึ้นระบบ Git สาธารณะ

### 7.2 คำสั่งสำหรับทำซ้ำการทดลอง (Reproducibility Commands)
```powershell
# 1. เริ่มระบบโครงสร้างพื้นฐานและคอนเทนเนอร์หุ่นยนต์
docker compose up -d

# 2. รันชุดการทดลองครบทั้ง 5 สถานการณ์แบบอัตโนมัติ
.\scripts\run_experiments.ps1

# 3. รันการวิเคราะห์ทางสถิติและสร้างรายงานสรุป
python scripts/statistical_analysis.py

# 4. รันโมเดล Machine Learning สำหรับการวิเคราะห์เชิงสำรวจ
python ml/src/train_regression.py
python ml/src/train_anomaly.py
```
