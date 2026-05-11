# Napat Veterinary System — รายงานวิเคราะห์ระบบโดยละเอียด

> วิเคราะห์โดย Claude Code | วันที่: 2026-05-11 | เวอร์ชัน App: 3.2.0

---

## สารบัญ

1. [ภาพรวมโปรแกรม](#1-ภาพรวมโปรแกรม)
2. [สถาปัตยกรรมระบบ](#2-สถาปัตยกรรมระบบ)
3. [Module และหน้าต่างต่างๆ](#3-module-และหน้าต่างต่างๆ)
4. [การทำงานของ Server ภายใน](#4-การทำงานของ-server-ภายใน)
5. [การรับ-ส่ง-เก็บข้อมูล](#5-การรับ-ส่ง-เก็บข้อมูล)
6. [โครงสร้าง Database ทั้งหมด](#6-โครงสร้าง-database-ทั้งหมด)
7. [REST API ทั้งหมด](#7-rest-api-ทั้งหมด)
8. [ระบบพิเศษ](#8-ระบบพิเศษ)
9. [ระบบ License](#9-ระบบ-license)
10. [การ Backup และ Update](#10-การ-backup-และ-update)
11. [ไฟล์และโฟลเดอร์สำคัญ](#11-ไฟล์และโฟลเดอร์สำคัญ)

---

## 1. ภาพรวมโปรแกรม

| รายการ              | รายละเอียด                                               |
| ------------------- | -------------------------------------------------------- |
| **ชื่อ**            | Napat Veterinary System (DocuVet)                        |
| **เวอร์ชัน**        | 3.2.0                                                    |
| **Package name**    | naphat-vet-system                                        |
| **Framework**       | Electron (Desktop App)                                   |
| **Backend**         | Node.js + Express.js                                     |
| **Database**        | SQLite via better-sqlite3                                |
| **Frontend**        | Plain HTML + CSS + JavaScript (ไม่มี Frontend Framework) |
| **Platform**        | Windows (มี elevate.exe สำหรับ admin privileges)         |
| **GitHub (Update)** | github.com/greatjug/docuvet4.02T                         |

โปรแกรมนี้คือ **ระบบบริหารคลินิกรักษาสัตว์** แบบ **Offline-First Desktop Application** ที่รันทุกอย่างในเครื่องเดียว ไม่ต้องพึ่ง Cloud Server ในการทำงาน รองรับการใช้งานแบบหลายเครื่องในเครือข่าย LAN ได้

---

## 2. สถาปัตยกรรมระบบ

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Electron App (Windows)                        │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  MAIN PROCESS — main.js (Node.js)                            │  │
│   │                                                              │  │
│   │  ┌─────────────────────┐  ┌──────────────────────────────┐  │  │
│   │  │  Express HTTP Server │  │  SQLite Database             │  │  │
│   │  │  Port: 3000          │  │  vet_clinic.db               │  │  │
│   │  │  ├── REST API        │  │  (better-sqlite3)            │  │  │
│   │  │  ├── SSE Events      │  └──────────────────────────────┘  │  │
│   │  │  ├── Static Files    │                                     │  │
│   │  │  └── WebSocket       │  ┌──────────────────────────────┐  │  │
│   │  └─────────────────────┘  │  File System (userData/)     │  │  │
│   │                            │  ├── clinic-config.json      │  │  │
│   │  ┌─────────────────────┐  │  ├── images/                 │  │  │
│   │  │  Electron IPC        │  │  ├── receipts/              │  │  │
│   │  │  (ipcMain handlers)  │  │  ├── license.dat            │  │  │
│   │  └─────────────────────┘  │  └── assets/fonts/          │  │  │
│   └──────────────────────────  └──────────────────────────────┘  │  │
│                                                                      │
│   RENDERER PROCESSES (BrowserWindow)                                 │
│   ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────────┐  │
│   │ index.html  │ │ControlVet  │ │cashier.  │ │treatment-tab.html│  │
│   │ (DocuVet)   │ │ .html      │ │html      │ │surgery-log.html  │  │
│   └────────────┘ └────────────┘ └──────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │
          │  LAN Access (ถ้าเปิดใช้งาน)
          │  DOCUVET_ALLOW_REMOTE_NETWORK=1
          ▼
┌─────────────────────┐
│  Tablet/PC อื่นใน  │
│  เครือข่าย LAN     │
│  http://IP:3000     │
└─────────────────────┘
```

---

## 3. Module และหน้าต่างต่างๆ

| ไฟล์ HTML              | ชื่อ Module            | หน้าที่                                                        |
| ---------------------- | ---------------------- | -------------------------------------------------------------- |
| `index.html`           | **DocuVet**            | หน้าหลัก — เวชระเบียน, ตรวจรักษา, คิว, นัดหมาย, คลังยา, รายงาน |
| `ControlVet.html`      | **ControlVet**         | แดชบอร์ดควบคุมระบบ — เช็ค IP, Server status, Logs, Firewall    |
| `cashier.html`         | **Cashier**            | จ่ายเงิน, ออกใบเสร็จ, Pending payments                         |
| `treatment-tab.html`   | **Treatment Tab**      | หน้าตรวจรักษาแบบ Tab view                                      |
| `surgery-log.html`     | **Surgery Log**        | บันทึกการผ่าตัด                                                |
| `ocr-scanner.html`     | **OCR Scanner**        | สแกนเอกสาร/ใบยาด้วย Tesseract.js                               |
| `activation.html`      | **License Activation** | หน้าใส่ License Key                                            |
| `drug-label.html`      | **Drug Label**         | พิมพ์ฉลากยา                                                    |
| `consolelauncher.html` | **Console Launcher**   | Console log viewer                                             |
| LuxuVet (โฟลเดอร์แยก)  | **LuxuVet**            | ระบบโรงแรมสัตว์เลี้ยง + Grooming                               |

### โมดูล JavaScript แยก

| ไฟล์                          | หน้าที่                               |
| ----------------------------- | ------------------------------------- |
| `main.js`                     | Main process ทั้งหมด (~14,000 บรรทัด) |
| `license-manager.js`          | จัดการ License                        |
| `license-generator.js`        | สร้าง License Key                     |
| `ocr-engine.js`               | จัดการ Tesseract OCR                  |
| `receipt-engine.js`           | สร้าง PDF ใบเสร็จ                     |
| `referral-letter.js`          | สร้างจดหมายส่งตัว                     |
| `tax-document.js`             | เอกสารภาษี                            |
| `text-fixer.js`               | แก้ปัญหา Thai encoding (mojibake)     |
| `breed-autocomplete.js`       | Autocomplete พันธุ์สัตว์              |
| `cash-drawer.js`              | เปิด Cash drawer                      |
| `cashier-sync-integration.js` | Sync real-time สำหรับ Cashier         |
| `shared-sync.js`              | Shared sync utilities                 |
| `thai-id-reader.js`           | อ่านบัตรประชาชนไทย                    |
| `hr-module.js`                | โมดูล HR                              |
| `dashboard-charts.js`         | กราฟ Dashboard                        |
| `injectable-stock-bridge.js`  | Bridge ยาฉีด                          |
| `tablet-stock-bridge.js`      | Bridge ยาเม็ด                         |
| `unified-dispensing.js`       | ระบบจ่ายยา                            |
| `price-template.js`           | Template ราคา                         |
| `bsava-formulary.js`          | BSAVA Drug reference                  |
| `drug-label-integration.js`   | ฉลากยา                                |

---

## 4. การทำงานของ Server ภายใน

### การ Start-up ลำดับ

1. Electron เปิดขึ้น → `main.js` ทำงาน
2. โหลด `clinic-config.json` (ตั้งค่าคลินิก)
3. เปิด SQLite database (`vet_clinic.db`)
4. สร้างตารางทั้งหมดถ้าไม่มี + Migration ถ้าต้องการ
5. Start Express server ที่ port **3000**
6. Start WebSocket server (ใช้ server เดียวกับ Express)
7. ตรวจสอบ License → ถ้าหมดอายุ/ไม่ผ่าน แสดงหน้า Activation
8. เปิด BrowserWindow โหลด `index.html`

### Network Binding

```
Default (ปลอดภัย):   127.0.0.1:3000  — ใช้ได้เฉพาะเครื่องตัวเอง
LAN mode (เปิดแล้ว): 0.0.0.0:3000    — ทุกอุปกรณ์ในวง LAN เข้าได้
```

ควบคุมด้วย environment variable: `DOCUVET_ALLOW_REMOTE_NETWORK`  
(ค่า default ปัจจุบัน: **เปิด LAN อยู่** เพราะ default = `!== '0'`)

### Rate Limiting

- มี in-memory rate limiter บน `/api/*`
- ทำงานตาม IP address
- ล้างค่าทุก 5 นาที

---

## 5. การรับ-ส่ง-เก็บข้อมูล

### 5.1 การเก็บข้อมูล

| ประเภทข้อมูล         | ที่เก็บ                                             | รูปแบบ            |
| -------------------- | --------------------------------------------------- | ----------------- |
| ข้อมูลทั้งหมด (หลัก) | `%AppData%\naphat-vet-system\vet_clinic.db`         | SQLite            |
| ตั้งค่าคลินิก        | `%AppData%\naphat-vet-system\clinic-config.json`    | JSON              |
| รูปภาพผลแลป/X-ray    | `%AppData%\naphat-vet-system\images\`               | JPEG/PNG/ไฟล์จริง |
| ใบเสร็จ PDF          | `%AppData%\naphat-vet-system\receipts\`             | PDF               |
| License              | `%AppData%\naphat-vet-system\license.dat`           | Encrypted text    |
| License Backup       | `%AppData%\naphat-vet-system\.lic.bak`              | Encrypted text    |
| Fonts (Sarabun)      | `%AppData%\naphat-vet-system\assets\fonts\`         | TTF               |
| โลโก้คลินิก          | `%AppData%\naphat-vet-system\assets\clinic\`        | Image             |
| OCR Queue            | `%AppData%\naphat-vet-system\ocr-result-queue.json` | JSON              |

### 5.2 การรับ-ส่งข้อมูลภายใน (Internal)

**A. REST API (HTTP)**

- หน้า HTML ทุกหน้าคุยกับ backend ผ่าน `fetch()` ไปยัง `http://localhost:3000/api/*`
- Format: JSON

**B. WebSocket (Real-time)**

- URL: `ws://localhost:3000`
- ใช้สำหรับ broadcast การเปลี่ยนแปลงข้อมูลไปทุกหน้าต่างพร้อมกัน
- Event types ที่ broadcast: `records`, `queue`, `appointments`, `products`, `ipd`, `stock`
- Actions: `create`, `update`, `delete`, `refresh`

**C. Server-Sent Events / SSE**

- URL: `http://localhost:3000/api/events`
- ใช้โดย ControlVet และ ConsoleLauncher
- ส่ง: Log messages, Server status updates

**D. Electron IPC**

- ใช้สำหรับ operation ที่ต้องการ native access
- Handlers สำคัญ:
  - `get-config` — อ่าน config
  - `start-server` / `stop-server` — ควบคุม Express
  - `check-license` / `activate-license` — License
  - `export-database` — Export DB
  - `cloud-backup` — Backup ไปยัง URL ที่กำหนด
  - `check-firewall` / `add-firewall-rule` — จัดการ Windows Firewall
  - `get-ipd-logs` / `save-ipd-log` — IPD logs
  - `shortcut-treatment:get/add/remove` — Shortcut treatments
  - `copy-to-clipboard` — Copy ข้อความ

### 5.3 การรับ-ส่งข้อมูลภายนอก (External Internet)

| การกระทำ                | รายละเอียด                                            | เกิดเมื่อไหร่                     |
| ----------------------- | ----------------------------------------------------- | --------------------------------- |
| ดาวน์โหลด Fonts         | Sarabun font จาก CDN/GitHub                           | ครั้งแรกที่ติดตั้ง / ถ้าไม่มีไฟล์ |
| Auto Update             | ดาวน์โหลดอัพเดตจาก GitHub Releases                    | เมื่อ Electron autoUpdater ทำงาน  |
| Cloud Backup (Optional) | PUT request ส่งไฟล์ `.db` ไปยัง URL ที่ผู้ใช้กำหนดเอง | ถ้าเปิดใช้งาน                     |

> **หมายเหตุ:** ข้อมูลผู้ป่วย, ข้อมูลคลินิก **ไม่ได้ถูกส่งออกไป** โดยอัตโนมัติ  
> Cloud Backup เป็น optional และผู้ใช้ต้องกำหนด URL เอง

---

## 6. โครงสร้าง Database ทั้งหมด

ชื่อไฟล์: **`vet_clinic.db`** (SQLite)

---

### 6.1 กลุ่ม OPD / เวชระเบียนหลัก

#### `records` — เวชระเบียน (ตารางหลักสำคัญที่สุด)

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
dateString      TEXT                    -- วันที่ (string เช่น 2026-05-11)
timeString      TEXT                    -- เวลา
caseType        TEXT                    -- ประเภทเคส
ownerName       TEXT                    -- ชื่อเจ้าของ
phoneNumber     TEXT                    -- เบอร์โทร
petName         TEXT                    -- ชื่อสัตว์เลี้ยง
species         TEXT                    -- ชนิดสัตว์
gender          TEXT                    -- เพศ
neuterStatus    TEXT                    -- สถานะทำหมัน
breed           TEXT                    -- พันธุ์
hn              TEXT                    -- Hospital Number (auto-gen)
queueId         INTEGER  → queue(id)    -- FK ไปยังคิว
chiefComplaint  TEXT                    -- อาการหลัก
history         TEXT                    -- ประวัติ
physicalExam    TEXT                    -- ผลตรวจร่างกาย
dx              TEXT                    -- การวินิจฉัย
treatment       TEXT                    -- การรักษา
prescription    TEXT                    -- ใบสั่งยา
followUp        TEXT                    -- นัดติดตาม
notes           TEXT                    -- หมายเหตุ
dfRowsJSON      TEXT (JSON)             -- Doctor Fee rows (หลายแพทย์)
idCardNumber    TEXT                    -- เลขบัตรประชาชนเจ้าของ
idCardAddress   TEXT                    -- ที่อยู่จากบัตรประชาชน
itemsJSON       TEXT (JSON Array)       -- รายการค่ารักษาทั้งหมด
quantity        INTEGER                 -- จำนวน (legacy)
unitPrice       REAL                    -- ราคาต่อหน่วย (legacy)
price           REAL                    -- ราคารวม
cost            REAL                    -- ต้นทุน
billType        TEXT DEFAULT 'treatment' -- ประเภทบิล (treatment/cashier/shop)
discount        REAL DEFAULT 0          -- ส่วนลด (บาท)
discountPercent REAL DEFAULT 0          -- ส่วนลด (%)
includeVat      INTEGER DEFAULT 0       -- รวม VAT หรือไม่
vatScope        TEXT DEFAULT 'all'      -- ขอบเขต VAT
vatAmount       REAL DEFAULT 0          -- ยอด VAT
netTotal        REAL DEFAULT 0          -- ยอดสุทธิ
paymentMethod   TEXT                    -- วิธีชำระเงิน
receiptNumber   TEXT                    -- เลขใบเสร็จ
receiptRemark   TEXT                    -- หมายเหตุใบเสร็จ
invoiceNumber   TEXT                    -- เลข Invoice
cashReceived    REAL DEFAULT 0          -- เงินสดที่รับ
changeAmount    REAL DEFAULT 0          -- เงินทอน
imagesJSON      TEXT (JSON)             -- รูปภาพที่แนบ
weight          REAL                    -- น้ำหนัก (kg)
temperature     REAL                    -- อุณหภูมิ (°C)
heartRate       INTEGER                 -- ชีพจร (bpm)
respRate        INTEGER                 -- อัตราหายใจ
crt             TEXT                    -- Capillary Refill Time
ageYears        INTEGER                 -- อายุ (ปี)
ageMonths       INTEGER                 -- อายุ (เดือน)
birthDate       TEXT                    -- วันเกิด
paymentStatus   TEXT DEFAULT 'pending'  -- สถานะชำระ (pending/paid/cancelled)
paidAt          TEXT                    -- วันที่ชำระเงิน
admitId         INTEGER → ipd(id)       -- FK ไปยัง IPD (ถ้า admit)
lockedBy        TEXT                    -- ถูก lock โดยใคร (multi-user)
lockedAt        TEXT                    -- เวลาที่ lock
createdAt       TEXT
updatedAt       TEXT
```

#### `queue` — คิวผู้ป่วย

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
queueNumber     TEXT                    -- เลขคิว (เช่น Q001)
dateString      TEXT                    -- วันที่
timeString      TEXT                    -- เวลา
ownerName       TEXT
petName         TEXT
phoneNumber     TEXT
hn              TEXT                    -- HN ถ้ามี
serviceType     TEXT                    -- ประเภทบริการ
chiefComplaint  TEXT                    -- อาการ
weight          REAL
species         TEXT
gender          TEXT
neuterStatus    TEXT
breed           TEXT
ageYears        INTEGER
ageMonths       INTEGER
idCardNumber    TEXT
idCardAddress   TEXT
idCardJson      TEXT (JSON)             -- ข้อมูลบัตรประชาชนเต็ม
status          TEXT DEFAULT 'waiting'  -- waiting/called/in-progress/done
appointmentId   INTEGER → appointments(id)
createdAt       TEXT
updatedAt       TEXT
```

#### `counters` — ตัวนับ atomic

```sql
name        TEXT PRIMARY KEY            -- ชื่อ counter (เช่น daily_queue)
value       INTEGER DEFAULT 0
updatedAt   TEXT
```

#### `appointments` — การนัดหมาย

```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
appointDate   TEXT                      -- วันนัด
appointTime   TEXT                      -- เวลานัด
reason        TEXT                      -- เหตุผลนัด
ownerName     TEXT
phoneNumber   TEXT
petName       TEXT
hn            TEXT
status        TEXT DEFAULT 'pending'    -- pending/called/confirmed/arrived/completed/no-show/cancelled
calledAt      TEXT
confirmedAt   TEXT
arrivedAt     TEXT
completedAt   TEXT
noShowAt      TEXT
cancelledAt   TEXT
queueId       INTEGER → queue(id)
createdAt     TEXT
updatedAt     TEXT
```

---

### 6.2 กลุ่ม IPD (ผู้ป่วยใน)

#### `ipd` — บันทึก Admit (ตารางหลัก IPD เก่า)

```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
hn            TEXT
petName       TEXT
ownerName     TEXT
phoneNumber   TEXT
species       TEXT
breed         TEXT
gender        TEXT
neuterStatus  TEXT
cageNumber    TEXT                      -- หมายเลขกรง
admitDate     TEXT
admitTime     TEXT
diagnosis     TEXT
status        TEXT DEFAULT 'admitted'   -- admitted/discharged
dischargeDate TEXT
notes         TEXT
imagesJSON    TEXT (JSON)
createdAt     TEXT
updatedAt     TEXT
```

#### `ipd_admits` — บันทึก Admit (ระบบใหม่ พร้อม Ward/Cage)

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
hn              TEXT
petName         TEXT
ownerName       TEXT
phoneNumber     TEXT
species         TEXT
breed           TEXT
gender          TEXT
neuterStatus    TEXT
weight          REAL
ageYears        INTEGER
ageMonths       INTEGER
cageNumber      TEXT
ward            TEXT
admitDate       TEXT NOT NULL
admitTime       TEXT
dischargeDate   TEXT
dischargeTime   TEXT
totalDays       INTEGER DEFAULT 0
diagnosis       TEXT
chiefComplaint  TEXT
treatmentPlan   TEXT
dischargeSummary TEXT
dischargeNote   TEXT
status          TEXT DEFAULT 'admitted' -- admitted/discharged
admitStatus     TEXT DEFAULT 'normal'   -- normal/critical/icu
outcome         TEXT                    -- ผลลัพธ์การรักษา
attendingVet    TEXT                    -- สัตวแพทย์ที่ดูแล
ipdId           INTEGER → ipd(id)
recordId        INTEGER → records(id)
createdAt       TEXT
updatedAt       TEXT
```

#### `ipd_admit_daily` — บันทึกประจำวัน IPD

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
admitId     INTEGER NOT NULL → ipd_admits(id) CASCADE
dayNumber   INTEGER DEFAULT 1
entryDate   TEXT NOT NULL
entryTime   TEXT
category    TEXT DEFAULT 'progress'     -- progress/medication/vital/feeding/note
title       TEXT
content     TEXT
vitalSigns  TEXT (JSON)                 -- {temp, hr, rr, bp, weight}
medications TEXT (JSON)                 -- รายการยาที่ให้
treatments  TEXT (JSON)                 -- การรักษาที่ทำ
feeding     TEXT                        -- การกิน
output      TEXT                        -- ปัสสาวะ/อุจจาระ
staffName   TEXT
notes       TEXT
items       TEXT (JSON)                 -- รายการค่าใช้จ่ายรายวัน
createdAt   TEXT
```

#### `ipd_daily` — บันทึกรายวัน (ระบบเก่า)

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
ipdId       INTEGER → ipd(id) CASCADE
date        TEXT
time        TEXT
temperature REAL
weight      REAL
heartRate   INTEGER
respRate    INTEGER
notes       TEXT
treatment   TEXT
medication  TEXT
foodIntake  TEXT
urination   TEXT
defecation  TEXT
imagesJSON  TEXT (JSON)
createdAt   TEXT
```

#### `ipd_daily_logs` — Log โครงสร้างใหม่

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
ipdId       INTEGER NOT NULL → ipd(id)
admitId     INTEGER
logDate     TEXT
vitalSigns  TEXT (JSON)
symptoms    TEXT
treatment   TEXT
staffName   TEXT
timestamp   DATETIME
createdAt   TEXT
```

#### `ipd_vitals` — Vital Signs แยกตาราง

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
ipdId           INTEGER NOT NULL → ipd(id) CASCADE
recordedAt      TEXT NOT NULL
temperature     REAL
heartRate       INTEGER
respRate        INTEGER
bloodPressure   TEXT
weight          REAL
painScore       INTEGER                 -- 0-10
hydrationStatus TEXT
notes           TEXT
recordedBy      TEXT
createdAt       TEXT
```

#### `ipd_tasks` — Task list ผู้ป่วยใน

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
ipdId           INTEGER NOT NULL → ipd(id) CASCADE
taskType        TEXT NOT NULL           -- medication/check/procedure
taskName        TEXT NOT NULL
description     TEXT
scheduledTime   TEXT NOT NULL
dueTime         TEXT NOT NULL
completedTime   TEXT
status          TEXT DEFAULT 'pending'  -- pending/completed/skipped
priority        TEXT DEFAULT 'normal'   -- low/normal/high/urgent
repeatInterval  INTEGER                 -- ความถี่การทำซ้ำ
repeatUnit      TEXT                    -- minute/hour/day
assignedTo      TEXT
completedBy     TEXT
notes           TEXT
createdAt       TEXT
updatedAt       TEXT
```

#### `ipd_wards` — หอผู้ป่วย

```sql
id               INTEGER PRIMARY KEY AUTOINCREMENT
wardCode         TEXT UNIQUE NOT NULL    -- A, B, ICU, ISO
wardName         TEXT NOT NULL
wardType         TEXT DEFAULT 'general'  -- general/icu/isolation
capacity         INTEGER DEFAULT 10
currentOccupancy INTEGER DEFAULT 0
isActive         INTEGER DEFAULT 1
notes            TEXT
createdAt        TEXT
-- Default wards: Ward A, Ward B, ICU, Isolation
```

#### `ipd_cages` — กรงสัตว์

```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
wardId        INTEGER → ipd_wards(id)
cageNumber    TEXT NOT NULL
cageSize      TEXT DEFAULT 'medium'     -- small/medium/large/xlarge
status        TEXT DEFAULT 'available'  -- available/occupied/cleaning/maintenance
currentIpdId  INTEGER → ipd(id)
lastCleanedAt TEXT
notes         TEXT
createdAt     TEXT
```

#### `ipd_deposits` — เงินมัดจำ IPD

```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
admitId       INTEGER NOT NULL
amount        REAL NOT NULL DEFAULT 0
paymentMethod TEXT DEFAULT 'cash'
note          TEXT
receivedBy    TEXT
createdAt     TEXT
```

#### `ipd_payments` — การชำระเงิน IPD

```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
admitId       INTEGER NOT NULL
amount        REAL NOT NULL DEFAULT 0
paymentMethod TEXT DEFAULT 'cash'
note          TEXT
receivedBy    TEXT
paymentType   TEXT DEFAULT 'final'      -- deposit/partial/final
createdAt     TEXT
```

---

### 6.3 กลุ่ม Inventory / สินค้า

#### `products` — คลังสินค้าและยา

```sql
id                  INTEGER PRIMARY KEY AUTOINCREMENT
name                TEXT NOT NULL
category            TEXT
unit                TEXT DEFAULT 'ชิ้น'
price               REAL DEFAULT 0
cost                REAL DEFAULT 0
stock               INTEGER DEFAULT 0   -- จำนวนสต็อก (หน่วย)
minStock            INTEGER DEFAULT 5   -- สต็อกขั้นต่ำ (แจ้งเตือน)
barcode             TEXT
barcode_image       TEXT                -- base64 หรือ path
description         TEXT
image               TEXT
isActive            INTEGER DEFAULT 1
expiry_date         TEXT                -- วันหมดอายุ
batch_number        TEXT                -- เลขล็อตยา
discount            REAL DEFAULT 0
trade_name          TEXT DEFAULT ''     -- ชื่อการค้า
precautions         TEXT DEFAULT ''     -- ข้อควรระวัง
-- สำหรับยาฉีด
is_injectable       INTEGER DEFAULT 0
bottle_size_cc      REAL DEFAULT 0      -- ขนาดขวด (ml)
remaining_cc        REAL DEFAULT 0      -- เหลืออยู่ (ml)
cost_per_cc         REAL DEFAULT 0
price_per_cc        REAL DEFAULT 0
opened_at           TEXT                -- วันที่เปิดขวด
-- สำหรับยาเม็ด
tablets_per_unit    INTEGER DEFAULT 0   -- เม็ดต่อหน่วย
concentration_value REAL DEFAULT 0      -- ความแรง
concentration_unit  TEXT DEFAULT ''     -- หน่วยความแรง (mg, ug)
package_type        TEXT DEFAULT ''     -- jar/box/bottle
strips_per_box      INTEGER DEFAULT 0
tablets_per_strip   INTEGER DEFAULT 0
createdAt           TEXT
updatedAt           TEXT
```

#### `stock_log` — ประวัติเพิ่ม/ลดสต็อก

```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
productId     INTEGER → products(id)
changeAmount  INTEGER                   -- บวก = เพิ่ม, ลบ = ลด
reason        TEXT                      -- เหตุผล
recordId      INTEGER → records(id)
createdAt     TEXT
```

#### `service_items` — รายการค่าบริการ

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
name        TEXT NOT NULL
description TEXT DEFAULT ''
category    TEXT DEFAULT 'other'        -- consultation/medicine/surgery/vaccination/grooming/lab/imaging/dental/hospitalization/boarding/other
unit        TEXT DEFAULT 'ครั้ง'
cost        REAL DEFAULT 0
price       REAL DEFAULT 0
is_active   INTEGER DEFAULT 1
source      TEXT DEFAULT 'user'         -- user/preloaded
created_at  TEXT
updated_at  TEXT
-- มี 60+ รายการ preloaded เริ่มต้น
```

#### `service_item_categories` — หมวดหมู่ค่าบริการ

```sql
id           INTEGER PRIMARY KEY AUTOINCREMENT
category_key TEXT NOT NULL UNIQUE
label        TEXT NOT NULL
icon         TEXT DEFAULT 'fa-tag'      -- Font Awesome icon class
color        TEXT DEFAULT 'gray'        -- Tailwind color name
is_system    INTEGER DEFAULT 0
created_at   TEXT
updated_at   TEXT
-- 11 หมวดหมู่ระบบ preloaded
```

#### `treatment_items` — รายการค่ารักษา (เรียนรู้จากการใช้งาน)

```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
name          TEXT UNIQUE
price         REAL DEFAULT 0
cost          REAL DEFAULT 0
category      TEXT DEFAULT 'general'
useCount      INTEGER DEFAULT 1         -- ใช้กี่ครั้งแล้ว
lastUsed      TEXT
isShortcut    INTEGER DEFAULT 0         -- ติดดาว shortcut หรือไม่
source        TEXT DEFAULT 'learned'    -- learned/service_item
serviceItemId INTEGER DEFAULT NULL      -- FK ไปยัง service_items
createdAt     TEXT
```

#### `template_bundles` — ชุด Template สำเร็จรูป

```sql
id             INTEGER PRIMARY KEY AUTOINCREMENT
name           TEXT NOT NULL
description    TEXT DEFAULT ''
category       TEXT DEFAULT 'general'
templateFields TEXT DEFAULT '{}'        -- JSON: {dx, treatment, prescription, followUp}
billingItems   TEXT DEFAULT '[]'        -- JSON Array รายการค่ารักษาในชุด
isActive       INTEGER DEFAULT 1
useCount       INTEGER DEFAULT 0
lastUsed       TEXT
source         TEXT DEFAULT 'user'      -- user/preloaded
createdAt      TEXT
updatedAt      TEXT
```

#### `price_templates` — แพ็คเกจราคา

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
name            TEXT NOT NULL
description     TEXT DEFAULT ''
items           TEXT DEFAULT '[]'       -- JSON Array {name, type, qty, cost, price}
synced_bundle_id INTEGER DEFAULT NULL   -- FK ไปยัง template_bundles
is_active       INTEGER DEFAULT 1
use_count       INTEGER DEFAULT 0
source          TEXT DEFAULT 'user'
created_at      TEXT
updated_at      TEXT
-- มี 12 แพ็คเกจ preloaded เริ่มต้น
```

---

### 6.4 กลุ่ม HR / พนักงาน

#### `employees` — พนักงาน

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
name        TEXT NOT NULL
position    TEXT                        -- ตำแหน่ง
phone       TEXT
salary      REAL DEFAULT 0
licenseNo   TEXT                        -- เลขที่ใบอนุญาตสัตวแพทย์
status      TEXT DEFAULT 'active'       -- active/inactive
startDate   TEXT
createdAt   TEXT
updatedAt   TEXT
```

#### `employee_profiles` — ข้อมูลส่วนตัวพนักงาน (extended)

```sql
id               INTEGER PRIMARY KEY AUTOINCREMENT
employeeId       INTEGER NOT NULL UNIQUE → employees(id) CASCADE
idCardNo         TEXT DEFAULT ''
dob              TEXT DEFAULT ''         -- วันเกิด
gender           TEXT DEFAULT ''
nationality      TEXT DEFAULT 'ไทย'
address          TEXT DEFAULT ''
education        TEXT DEFAULT ''
emergencyContact TEXT DEFAULT ''
emergencyPhone   TEXT DEFAULT ''
bloodType        TEXT DEFAULT ''
profilePhoto     TEXT DEFAULT ''
workHistoryJSON  TEXT DEFAULT '[]'       -- JSON ประวัติการทำงาน
certifications   TEXT DEFAULT ''
notes            TEXT DEFAULT ''
createdAt        TEXT
updatedAt        TEXT
```

#### `employee_leaves` — การลา

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
employeeId  INTEGER NOT NULL → employees(id) CASCADE
leaveType   TEXT NOT NULL               -- sick/personal/vacation/maternity
startDate   TEXT NOT NULL
endDate     TEXT NOT NULL
days        INTEGER DEFAULT 1
reason      TEXT DEFAULT ''
status      TEXT DEFAULT 'pending'      -- pending/approved/rejected
approvedBy  TEXT DEFAULT ''
approvedAt  TEXT DEFAULT ''
createdAt   TEXT
```

#### `schedules` — ตารางการทำงาน

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
employeeId  INTEGER → employees(id) CASCADE
date        TEXT
shift       TEXT                        -- morning/afternoon/night
note        TEXT
assignedBy  TEXT DEFAULT 'Admin'
createdAt   TEXT
```

---

### 6.5 กลุ่มการเงิน

#### `expenses` — ค่าใช้จ่ายคลินิก

```sql
id                  INTEGER PRIMARY KEY AUTOINCREMENT
date                TEXT
category            TEXT
description         TEXT
amount              REAL DEFAULT 0
receiptFilename     TEXT                -- ชื่อไฟล์ใบเสร็จ
receiptOriginalName TEXT
receiptMimeType     TEXT
receiptSize         INTEGER
createdAt           TEXT
```

#### `cost_items` — ต้นทุนและค่าเสื่อมราคา

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
type            TEXT NOT NULL           -- fixed/variable/depreciation
category        TEXT
description     TEXT
amount          REAL DEFAULT 0
month           TEXT                    -- เดือนที่บันทึก
assetName       TEXT                    -- ชื่อสินทรัพย์ (กรณีค่าเสื่อม)
purchaseCost    REAL DEFAULT 0
salvageValue    REAL DEFAULT 0
usefulLifeYears INTEGER DEFAULT 5
purchaseDate    TEXT
isActive        INTEGER DEFAULT 1
createdAt       TEXT
updatedAt       TEXT
```

#### `audit_log` — ประวัติการแก้ไขทางการเงิน

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
action      TEXT NOT NULL               -- create/update/delete/payment
entityType  TEXT                        -- records/ipd/product
entityId    TEXT
staffName   TEXT
details     TEXT (JSON หรือ text)
createdAt   TEXT
```

#### `tax_purchase_entries` — ภาษีซื้อ

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
date            TEXT
supplierName    TEXT
taxId           TEXT
description     TEXT
amount          REAL DEFAULT 0
vatAmount       REAL DEFAULT 0
totalAmount     REAL DEFAULT 0
documentNo      TEXT
createdAt       TEXT
```

#### `tax_withholding_entries` — ภาษีหัก ณ ที่จ่าย

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
date            TEXT
payeeName       TEXT
taxId           TEXT
incomeType      TEXT
amount          REAL DEFAULT 0
withholdingRate REAL DEFAULT 0
withholdingAmount REAL DEFAULT 0
documentNo      TEXT
createdAt       TEXT
```

---

### 6.6 กลุ่ม LuxuVet (โรงแรมสัตว์เลี้ยง)

#### `luxuvet_appointments` — นัดหมาย Grooming/Hotel

```sql
id              TEXT PRIMARY KEY        -- UUID
petName         TEXT
ownerName       TEXT
hn              TEXT
phone           TEXT
breed           TEXT
type            TEXT DEFAULT 'grooming' -- grooming/hotel
date            TEXT
time            TEXT DEFAULT '09:00'
petCount        INTEGER DEFAULT 1
status          TEXT DEFAULT 'pending'
notes           TEXT
checkInDate     TEXT
checkInTime     TEXT
checkOutDate    TEXT
nights          INTEGER DEFAULT 1
roomCount       INTEGER DEFAULT 1
roomSize        TEXT DEFAULT 'M'
specialRequests TEXT
gcalEventId     TEXT                    -- Google Calendar Event ID
source          TEXT
createdAt       TEXT
updatedAt       TEXT
```

#### `luxuvet_service_records` — บันทึกบริการ

```sql
id            TEXT PRIMARY KEY
appointmentId TEXT
petName       TEXT
ownerName     TEXT
hn            TEXT
phone         TEXT
breed         TEXT
type          TEXT DEFAULT 'grooming'
serviceDate   TEXT
time          TEXT
price         REAL DEFAULT 0
extraCharge   REAL DEFAULT 0
discount      REAL DEFAULT 0
total         REAL DEFAULT 0
notes         TEXT
status        TEXT DEFAULT 'completed'
completedAt   TEXT
```

#### `luxuvet_hotel_rooms` — ห้องพักโรงแรม

```sql
id          TEXT PRIMARY KEY
number      TEXT
name        TEXT
size        TEXT DEFAULT 'M'            -- S/M/L/XL
type        TEXT DEFAULT 'standard'
price       REAL DEFAULT 0
status      TEXT DEFAULT 'available'    -- available/occupied/maintenance
notes       TEXT
createdAt   TEXT
updatedAt   TEXT
```

#### `luxuvet_hotel_bookings` — การจองโรงแรม

```sql
id            TEXT PRIMARY KEY
roomId        TEXT → luxuvet_hotel_rooms
appointmentId TEXT
petName       TEXT
ownerName     TEXT
hn            TEXT
phone         TEXT
checkInDate   TEXT
checkInTime   TEXT
checkOutDate  TEXT
checkOutTime  TEXT
nights        INTEGER DEFAULT 1
pricePerNight REAL DEFAULT 0
totalPrice    REAL DEFAULT 0
status        TEXT DEFAULT 'booked'     -- booked/checked-in/checked-out/cancelled
notes         TEXT
specialNeeds  TEXT
createdAt     TEXT
updatedAt     TEXT
```

#### `luxuvet_hotel_buildings` — อาคาร

```sql
id          TEXT PRIMARY KEY
code        TEXT
name        TEXT
floorCount  INTEGER DEFAULT 1
notes       TEXT
createdAt   TEXT
```

#### `luxuvet_hotel_cleaning` — บันทึกทำความสะอาด

```sql
id          TEXT PRIMARY KEY
roomId      TEXT
cleanedAt   TEXT
cleanedBy   TEXT
notes       TEXT
status      TEXT DEFAULT 'completed'
createdAt   TEXT
```

#### `luxuvet_hotel_activity_logs` — Activity logs hotel

```sql
id          TEXT PRIMARY KEY
bookingId   TEXT
petName     TEXT
activity    TEXT
timestamp   TEXT
staffName   TEXT
notes       TEXT
createdAt   TEXT
```

#### `luxuvet_cashier_queue` — คิวแคชเชียร์ LuxuVet

```sql
id          TEXT PRIMARY KEY
petName     TEXT
ownerName   TEXT
serviceType TEXT
status      TEXT DEFAULT 'waiting'
notes       TEXT
createdAt   TEXT
updatedAt   TEXT
```

#### `luxuvet_cashier_receipts` — ใบเสร็จ LuxuVet

```sql
id            TEXT PRIMARY KEY
receiptNumber TEXT
petName       TEXT
ownerName     TEXT
items         TEXT (JSON)
subtotal      REAL DEFAULT 0
discount      REAL DEFAULT 0
total         REAL DEFAULT 0
paymentMethod TEXT
paidAt        TEXT
notes         TEXT
createdAt     TEXT
```

---

### 6.7 กลุ่มอื่นๆ

#### `owner_idcards` — ข้อมูลบัตรประชาชนเจ้าของสัตว์

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
hn          TEXT                        -- HN ที่ผูกไว้
cidNumber   TEXT                        -- เลขบัตรประชาชน
fullName    TEXT
address     TEXT
rawJson     TEXT (JSON)                 -- ข้อมูลดิบจากบัตร
createdAt   TEXT
updatedAt   TEXT
```

#### `family_data` — ข้อมูลครอบครัว (เชื่อม HN หลาย pets)

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
hn          TEXT
ownerName   TEXT
petName     TEXT
species     TEXT
breed       TEXT
gender      TEXT
birthDate   TEXT
phoneNumber TEXT
data        TEXT (JSON)                 -- ข้อมูลเพิ่มเติม
createdAt   TEXT
updatedAt   TEXT
```

#### `medical_images` — Metadata รูปภาพทางการแพทย์

```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
recordId      INTEGER → records(id)
ipdId         INTEGER → ipd(id) CASCADE
recordType    TEXT                      -- opd/ipd/lab/xray
filename      TEXT                      -- ชื่อไฟล์บน disk
originalName  TEXT
mimeType      TEXT
size          INTEGER
description   TEXT
createdAt     TEXT
```

#### `bsava_formulary` — ข้อมูลยาจาก BSAVA PDF

```sql
id                TEXT PRIMARY KEY (AUTOINCREMENT)
name              TEXT NOT NULL         -- ชื่อยา
abbreviation      TEXT
trade_names       TEXT                  -- ชื่อการค้า
legal_category    TEXT
formulations      TEXT                  -- รูปแบบยา
action            TEXT
uses              TEXT                  -- การใช้งาน
contraindications TEXT                  -- ข้อห้ามใช้
adverse_reactions TEXT                  -- ผลข้างเคียง
drug_interactions TEXT
safety_handling   TEXT
doses             TEXT                  -- ขนาดยา
species           TEXT
source            TEXT
created_at        TEXT
```

#### `standard_treatments` — Text template สำเร็จรูป

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
code        TEXT UNIQUE                 -- รหัสย่อ
text        TEXT                        -- เนื้อหา
category    TEXT DEFAULT 'general'
field       TEXT DEFAULT 'treatment'    -- ใช้กับ field ไหน (treatment/dx/prescription)
useCount    INTEGER DEFAULT 0
lastUsed    TEXT
createdAt   TEXT
```

#### `textbook_profiles` — Profile การ Import ตำรายา

```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
description TEXT DEFAULT ''
profile_json TEXT NOT NULL              -- JSON config การ extract
created_at  TEXT
updated_at  TEXT
```

#### `custom_breeds` — พันธุ์สัตว์ที่ผู้ใช้เพิ่มเอง

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
name        TEXT NOT NULL
species     TEXT                        -- dog/cat/rabbit/bird/etc
useCount    INTEGER DEFAULT 1
createdAt   TEXT
updatedAt   TEXT
```

#### `shortcut_treatment_items` — (Legacy ย้ายไป treatment_items แล้ว)

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
name        TEXT NOT NULL
price       INTEGER NOT NULL
cost        INTEGER DEFAULT 0
category    TEXT DEFAULT 'general'
createdAt   TEXT
-- ถูก migrate ไปที่ treatment_items (isShortcut=1) โดยอัตโนมัติ
```

---

## 7. REST API ทั้งหมด

Base URL: `http://localhost:3000`  
(หรือ `http://<LAN-IP>:3000` เมื่อเปิด LAN mode)

### Pages

| Method | Path       | คำอธิบาย                      |
| ------ | ---------- | ----------------------------- |
| GET    | `/`        | DocuVet หน้าหลัก (index.html) |
| GET    | `/control` | ControlVet                    |
| GET    | `/luxuvet` | LuxuVet                       |

### Records (เวชระเบียน)

| Method | Path                                     | คำอธิบาย                                         |
| ------ | ---------------------------------------- | ------------------------------------------------ |
| GET    | `/api/records`                           | ดึงรายการ records (มี query: date, search, page) |
| GET    | `/api/records/:id`                       | ดึง record เดียว                                 |
| POST   | `/api/records`                           | สร้าง record ใหม่                                |
| PUT    | `/api/records/:id`                       | แก้ไข record                                     |
| DELETE | `/api/records/:id`                       | ลบ record                                        |
| GET    | `/api/records/pending-payment`           | รายการที่ยังไม่ชำระเงิน                          |
| POST   | `/api/records/:id/payment`               | บันทึกการชำระเงิน                                |
| DELETE | `/api/records/:id/payment`               | ยกเลิกการชำระเงิน                                |
| DELETE | `/api/records/pending-payment/clear-all` | ล้าง pending ทั้งหมด                             |
| GET    | `/api/records/search-by-phone`           | ค้นหาด้วยเบอร์โทร                                |
| GET    | `/api/records/payment-history`           | ประวัติการชำระ                                   |
| POST   | `/api/records/pending-from-queue`        | สร้าง record จากคิว                              |
| POST   | `/api/records/batch`                     | Import หลาย records พร้อมกัน                     |
| POST   | `/api/records/:id/lock`                  | Lock record                                      |
| DELETE | `/api/records/:id/lock`                  | Unlock record                                    |
| GET    | `/api/records/:id/lock`                  | ตรวจสอบสถานะ lock                                |

### Queue (คิว)

| Method | Path             | คำอธิบาย          |
| ------ | ---------------- | ----------------- |
| GET    | `/api/queue`     | ดึงคิวทั้งหมด     |
| POST   | `/api/queue`     | เพิ่มคิวใหม่      |
| PUT    | `/api/queue/:id` | อัพเดตคิว (สถานะ) |
| DELETE | `/api/queue/:id` | ลบคิว             |

### Appointments (นัดหมาย)

| Method | Path                    | คำอธิบาย           |
| ------ | ----------------------- | ------------------ |
| GET    | `/api/appointments`     | ดึงนัดหมาย         |
| POST   | `/api/appointments`     | สร้างนัดหมาย       |
| PUT    | `/api/appointments/:id` | แก้ไขนัดหมาย       |
| PATCH  | `/api/appointments/:id` | อัพเดตสถานะนัดหมาย |
| DELETE | `/api/appointments/:id` | ยกเลิกนัดหมาย      |

### Products (สินค้า/ยา)

| Method | Path                               | คำอธิบาย                  |
| ------ | ---------------------------------- | ------------------------- |
| GET    | `/api/products`                    | สินค้า active             |
| GET    | `/api/products/all`                | สินค้าทั้งหมด             |
| GET    | `/api/products/:id`                | สินค้าเดียว               |
| GET    | `/api/products/barcode/:barcode`   | ค้นหาด้วย barcode         |
| POST   | `/api/products`                    | เพิ่มสินค้า               |
| PUT    | `/api/products/:id`                | แก้ไขสินค้า               |
| DELETE | `/api/products/:id`                | ลบสินค้า                  |
| POST   | `/api/products/:id/stock`          | เพิ่ม/ลดสต็อก             |
| POST   | `/api/products/batch-deduct-stock` | ลดสต็อกหลายรายการพร้อมกัน |
| POST   | `/api/products/import-batch`       | Import สินค้าจาก CSV      |
| POST   | `/api/products/:id/deduct-cc`      | ลด cc ยาฉีด               |
| POST   | `/api/products/:id/adjust-cc`      | ปรับ cc ยาฉีด             |
| POST   | `/api/products/:id/deduct-tablets` | ลดยาเม็ด                  |
| POST   | `/api/products/:id/adjust-tablets` | ปรับยาเม็ด                |

### Stock

| Method | Path                | คำอธิบาย                     |
| ------ | ------------------- | ---------------------------- |
| POST   | `/api/stock/adjust` | ปรับสต็อก                    |
| POST   | `/api/stock/deduct` | ลดสต็อก (batch)              |
| GET    | `/api/stock-log`    | ประวัติสต็อก                 |
| GET    | `/api/stock-logs`   | ประวัติสต็อก (endpoint ใหม่) |
| POST   | `/api/stock-log`    | บันทึก stock log             |

### Employees & HR

| Method | Path                                 | คำอธิบาย                             |
| ------ | ------------------------------------ | ------------------------------------ |
| GET    | `/api/veterinarians`                 | รายชื่อสัตวแพทย์ (จาก clinic-config) |
| GET    | `/api/employees`                     | พนักงาน active                       |
| GET    | `/api/employees/all`                 | พนักงานทั้งหมด                       |
| POST   | `/api/employees`                     | เพิ่มพนักงาน                         |
| PUT    | `/api/employees/:id`                 | แก้ไขพนักงาน                         |
| DELETE | `/api/employees/:id`                 | ลบพนักงาน                            |
| GET    | `/api/employee-profiles/:employeeId` | โปรไฟล์พนักงาน                       |
| PUT    | `/api/employee-profiles/:employeeId` | แก้ไขโปรไฟล์                         |
| GET    | `/api/employee-leaves`               | ประวัติการลา                         |
| POST   | `/api/employee-leaves`               | บันทึกการลา                          |
| PUT    | `/api/employee-leaves/:id`           | อัพเดตการลา                          |
| DELETE | `/api/employee-leaves/:id`           | ลบการลา                              |
| GET    | `/api/schedules`                     | ตารางเวร                             |
| POST   | `/api/schedules`                     | เพิ่มตารางเวร                        |
| DELETE | `/api/schedules/:id`                 | ลบตารางเวร                           |

### IPD (ผู้ป่วยใน)

| Method | Path                                            | คำอธิบาย                   |
| ------ | ----------------------------------------------- | -------------------------- |
| GET    | `/api/ipd`                                      | รายการ IPD                 |
| POST   | `/api/ipd`                                      | Admit สัตว์                |
| PUT    | `/api/ipd/:id`                                  | อัพเดต IPD                 |
| DELETE | `/api/ipd/:id`                                  | ลบ IPD                     |
| GET    | `/api/ipd/:id/daily`                            | บันทึกรายวัน (เก่า)        |
| POST   | `/api/ipd/:id/daily`                            | เพิ่มบันทึกรายวัน          |
| GET    | `/api/ipd/:id/tasks`                            | Task list                  |
| POST   | `/api/ipd/:id/tasks`                            | เพิ่ม Task                 |
| PATCH  | `/api/ipd-tasks/:taskId`                        | อัพเดต Task                |
| DELETE | `/api/ipd-tasks/:taskId`                        | ลบ Task                    |
| GET    | `/api/ipd-tasks/pending`                        | Tasks ที่ยังค้างอยู่       |
| GET    | `/api/ipd/:id/vitals`                           | Vital signs                |
| GET    | `/api/ipd/:id/vitals/latest`                    | Vital ล่าสุด               |
| POST   | `/api/ipd/:id/vitals`                           | บันทึก Vital               |
| GET    | `/api/ipd-wards`                                | Ward ทั้งหมด               |
| GET    | `/api/ipd-wards/summary`                        | สรุป Ward                  |
| POST   | `/api/ipd-wards`                                | เพิ่ม Ward                 |
| PUT    | `/api/ipd-wards/:id`                            | แก้ไข Ward                 |
| DELETE | `/api/ipd-wards/:id`                            | ลบ Ward                    |
| GET    | `/api/ipd-cages`                                | กรงทั้งหมด                 |
| POST   | `/api/ipd-cages`                                | เพิ่มกรง                   |
| PUT    | `/api/ipd-cages/:id`                            | แก้ไขกรง                   |
| DELETE | `/api/ipd-cages/:id`                            | ลบกรง                      |
| GET    | `/api/ipd/dashboard/stats`                      | สถิติ IPD Dashboard        |
| GET    | `/api/ipd-admits`                               | รายการ Admit (ระบบใหม่)    |
| GET    | `/api/ipd-admits/:id`                           | Admit เดียว                |
| GET    | `/api/ipd-admits/patient`                       | ค้นหา Admit ด้วย HN/ชื่อ   |
| POST   | `/api/ipd-admits`                               | สร้าง Admit ใหม่           |
| PUT    | `/api/ipd-admits/:id`                           | อัพเดต Admit               |
| DELETE | `/api/ipd-admits/:id`                           | ลบ Admit                   |
| POST   | `/api/ipd-admits/:id/daily`                     | เพิ่มบันทึกรายวัน          |
| GET    | `/api/ipd-admits/:id/daily`                     | ดึงบันทึกรายวัน            |
| PUT    | `/api/ipd-admit-daily/:entryId`                 | แก้ไขบันทึกรายวัน          |
| DELETE | `/api/ipd-admit-daily/:entryId`                 | ลบบันทึกรายวัน             |
| POST   | `/api/ipd-admits/:id/daily-batch`               | เพิ่มบันทึกรายวันแบบ batch |
| POST   | `/api/ipd-admits/:id/billing-snapshots/replace` | อัพเดต billing snapshot    |
| GET    | `/api/ipd-admits/:id/deposits`                  | เงินมัดจำ                  |
| POST   | `/api/ipd-admits/:id/deposits`                  | รับเงินมัดจำ               |
| DELETE | `/api/ipd-deposits/:depositId`                  | ลบมัดจำ                    |
| PUT    | `/api/ipd-admits/:id/deposits/use`              | ใช้เงินมัดจำ               |
| GET    | `/api/ipd-admits/:id/payments`                  | ประวัติชำระเงิน IPD        |
| POST   | `/api/ipd-admits/:id/payments`                  | ชำระเงิน IPD               |
| DELETE | `/api/ipd-payments/:paymentId`                  | ลบการชำระ                  |
| POST   | `/api/ipd-discharge-docx`                       | ออกเอกสาร Discharge        |

### Financial & Reports

| Method | Path                               | คำอธิบาย             |
| ------ | ---------------------------------- | -------------------- |
| GET    | `/api/expenses`                    | ค่าใช้จ่าย           |
| POST   | `/api/expenses`                    | เพิ่มค่าใช้จ่าย      |
| DELETE | `/api/expenses/:id`                | ลบค่าใช้จ่าย         |
| GET    | `/api/cost-items`                  | รายการต้นทุน         |
| POST   | `/api/cost-items`                  | เพิ่มต้นทุน          |
| PUT    | `/api/cost-items/:id`              | แก้ไขต้นทุน          |
| DELETE | `/api/cost-items/:id`              | ลบต้นทุน             |
| GET    | `/api/cost-items/summary`          | สรุปต้นทุน           |
| GET    | `/api/cost-items/trend`            | Trend ต้นทุน         |
| GET    | `/api/profit-center/analysis`      | วิเคราะห์กำไร-ขาดทุน |
| GET    | `/api/dashboard/stats`             | สถิติ Dashboard หลัก |
| GET    | `/api/tax/purchase-entries`        | ภาษีซื้อ             |
| POST   | `/api/tax/purchase-entries`        | เพิ่มภาษีซื้อ        |
| PUT    | `/api/tax/purchase-entries/:id`    | แก้ไขภาษีซื้อ        |
| DELETE | `/api/tax/purchase-entries/:id`    | ลบภาษีซื้อ           |
| GET    | `/api/tax/withholding-entries`     | ภาษีหัก ณ ที่จ่าย    |
| POST   | `/api/tax/withholding-entries`     | เพิ่มภาษีหัก         |
| PUT    | `/api/tax/withholding-entries/:id` | แก้ไขภาษีหัก         |
| DELETE | `/api/tax/withholding-entries/:id` | ลบภาษีหัก            |

### Service Items & Templates

| Method | Path                                        | คำอธิบาย                   |
| ------ | ------------------------------------------- | -------------------------- |
| GET    | `/api/service-item-categories`              | หมวดหมู่บริการ             |
| POST   | `/api/service-item-categories`              | เพิ่มหมวดหมู่              |
| GET    | `/api/service-items`                        | รายการบริการ               |
| POST   | `/api/service-items`                        | เพิ่มรายการบริการ          |
| PUT    | `/api/service-items/:id`                    | แก้ไขรายการบริการ          |
| DELETE | `/api/service-items/:id`                    | ลบรายการบริการ             |
| POST   | `/api/service-items/import-treatment-items` | Import จาก treatment_items |
| POST   | `/api/service-items/import-batch`           | Import แบบ batch           |
| POST   | `/api/service-items/check-conflicts`        | ตรวจหารายการซ้ำ            |
| POST   | `/api/service-items/sync-all`               | Sync ทั้งหมด               |
| POST   | `/api/service-items/:id/sync`               | Sync รายการเดียว           |
| GET    | `/api/treatment-items`                      | รายการค่ารักษา             |
| GET    | `/api/treatment-items/suggest`              | Autocomplete ค่ารักษา      |
| POST   | `/api/treatment-items`                      | เพิ่มค่ารักษา              |
| PUT    | `/api/treatment-items/:id`                  | แก้ไขค่ารักษา              |
| DELETE | `/api/treatment-items/:id`                  | ลบค่ารักษา                 |
| GET    | `/api/treatment-items/shortcuts`            | รายการ Shortcut            |
| POST   | `/api/treatment-items/:id/toggle-shortcut`  | Toggle shortcut            |
| GET    | `/api/template-bundles`                     | ชุด Template               |
| GET    | `/api/template-bundles/:id`                 | Template เดียว             |
| POST   | `/api/template-bundles`                     | สร้าง Template             |
| PUT    | `/api/template-bundles/:id`                 | แก้ไข Template             |
| DELETE | `/api/template-bundles/:id`                 | ลบ Template                |
| POST   | `/api/template-bundles/:id/use`             | บันทึกการใช้ Template      |
| GET    | `/api/price-templates`                      | แพ็คเกจราคา                |
| POST   | `/api/price-templates`                      | สร้างแพ็คเกจ               |
| PUT    | `/api/price-templates/:id`                  | แก้ไขแพ็คเกจ               |
| DELETE | `/api/price-templates/:id`                  | ลบแพ็คเกจ                  |
| POST   | `/api/price-templates/:id/sync-bundle`      | Sync กับ Template Bundle   |

### Standards & Suggestions

| Method | Path                     | คำอธิบาย                            |
| ------ | ------------------------ | ----------------------------------- |
| GET    | `/api/standards`         | Text templates                      |
| POST   | `/api/standards`         | เพิ่ม Template                      |
| PUT    | `/api/standards/:id`     | แก้ไข Template                      |
| DELETE | `/api/standards/:id`     | ลบ Template                         |
| POST   | `/api/standards/:id/use` | บันทึกการใช้                        |
| GET    | `/api/suggestions`       | AI Autocomplete (เรียนรู้จากข้อมูล) |
| GET    | `/api/breeds`            | พันธุ์สัตว์                         |
| GET    | `/api/breeds/history`    | ประวัติพันธุ์                       |
| POST   | `/api/breeds`            | เพิ่มพันธุ์                         |
| PUT    | `/api/breeds/:id`        | แก้ไขพันธุ์                         |
| DELETE | `/api/breeds/:id`        | ลบพันธุ์                            |
| POST   | `/api/breeds/:id/use`    | บันทึกการใช้พันธุ์                  |

### Clinic Config & HN

| Method | Path                                  | คำอธิบาย                  |
| ------ | ------------------------------------- | ------------------------- |
| GET    | `/api/clinic-config`                  | ตั้งค่าคลินิก             |
| PUT    | `/api/clinic-config`                  | บันทึกตั้งค่า             |
| POST   | `/api/clinic-config/receipt-backfill` | Backfill เลขใบเสร็จ       |
| GET    | `/api/clinic-config/hn-stats`         | สถิติ HN                  |
| POST   | `/api/clinic-config/hn-backfill`      | Backfill HN               |
| GET    | `/api/hn-family-audit`                | ตรวจสอบ HN ซ้ำ            |
| POST   | `/api/hn-family-repair`               | แก้ไข HN ซ้ำ              |
| POST   | `/api/generate-invoice`               | สร้างเลข Invoice          |
| POST   | `/api/generate-receipt`               | สร้างเลขใบเสร็จ           |
| POST   | `/api/generate-hn`                    | สร้าง HN                  |
| GET    | `/api/preview-invoice`                | Preview เลข Invoice ถัดไป |
| GET    | `/api/preview-receipt`                | Preview เลขใบเสร็จถัดไป   |
| GET    | `/api/preview-hn`                     | Preview HN ถัดไป          |
| GET    | `/api/family-data`                    | ข้อมูลครอบครัว            |
| POST   | `/api/family-data`                    | บันทึกข้อมูลครอบครัว      |
| POST   | `/api/clinic-logo`                    | Upload โลโก้              |
| POST   | `/api/clinic-icon`                    | Upload ไอคอน              |

### Images

| Method | Path                           | คำอธิบาย           |
| ------ | ------------------------------ | ------------------ |
| POST   | `/api/images/upload`           | Upload รูปภาพ      |
| GET    | `/api/images/record/:recordId` | รูปของ record      |
| GET    | `/api/images/ipd/:ipdId`       | รูปของ IPD         |
| DELETE | `/api/images/:id`              | ลบรูป              |
| PATCH  | `/api/images/link-record`      | Link รูปกับ record |

### Thai ID Card

| Method | Path                      | คำอธิบาย                 |
| ------ | ------------------------- | ------------------------ |
| GET    | `/api/idcard/read`        | อ่านบัตรประชาชน          |
| GET    | `/api/idcard/status`      | สถานะเครื่องอ่านบัตร     |
| POST   | `/api/idcard/save`        | บันทึกข้อมูลบัตร         |
| GET    | `/api/idcard/by-hn/:hn`   | ดึงข้อมูลบัตรด้วย HN     |
| GET    | `/api/idcard/by-cid/:cid` | ดึงข้อมูลบัตรด้วยเลขบัตร |
| GET    | `/api/idcard/linked-hns`  | HN ที่ผูกกับบัตรแล้ว     |
| DELETE | `/api/idcard/by-hn/:hn`   | ลบข้อมูลบัตร             |
| PUT    | `/api/idcard/by-hn/:hn`   | อัพเดตข้อมูลบัตร         |

### Documents

| Method | Path                       | คำอธิบาย                 |
| ------ | -------------------------- | ------------------------ |
| POST   | `/api/referral-letter/:id` | สร้างจดหมายส่งตัว (DOCX) |
| POST   | `/api/ipd-discharge-docx`  | เอกสาร Discharge (DOCX)  |

### BSAVA & Textbook

| Method | Path                                | คำอธิบาย                 |
| ------ | ----------------------------------- | ------------------------ |
| GET    | `/api/bsava-formulary`              | ค้นหายาใน BSAVA          |
| GET    | `/api/bsava-formulary/stats`        | สถิติ BSAVA              |
| POST   | `/api/bsava-formulary/import`       | Import จาก PDF           |
| DELETE | `/api/bsava-formulary`              | ล้างข้อมูล BSAVA         |
| GET    | `/api/textbook-import/profiles`     | Profiles การ Import      |
| POST   | `/api/textbook-import/profiles`     | สร้าง Profile            |
| DELETE | `/api/textbook-import/profiles/:id` | ลบ Profile               |
| POST   | `/api/textbook-import/extract`      | Extract ข้อความจาก PDF   |
| POST   | `/api/textbook-import/parse`        | Parse ข้อมูลยา           |
| POST   | `/api/textbook-import/import`       | Import เข้า BSAVA DB     |
| GET    | `/api/textbook-import/sources`      | แหล่งข้อมูลที่ import มา |

### Backup

| Method | Path                  | คำอธิบาย                                  |
| ------ | --------------------- | ----------------------------------------- |
| GET    | `/api/backup/full`    | Export Backup (ZIP: DB + images + config) |
| POST   | `/api/backup/restore` | Restore จาก ZIP                           |

### License

| Method | Path                    | คำอธิบาย             |
| ------ | ----------------------- | -------------------- |
| GET    | `/api/license/info`     | ข้อมูล License       |
| GET    | `/api/license/check`    | ตรวจสอบ License      |
| POST   | `/api/license/activate` | Activate License Key |

### System

| Method | Path                   | คำอธิบาย                       |
| ------ | ---------------------- | ------------------------------ |
| GET    | `/api/server-ip`       | IP ของ Server                  |
| GET    | `/api/events`          | SSE Stream                     |
| GET    | `/api/realtime/status` | สถานะ WebSocket clients        |
| GET    | `/api/server/monitor`  | ข้อมูล System (CPU, RAM, disk) |
| GET    | `/api/search/patients` | ค้นหาผู้ป่วย (HN/ชื่อ/เบอร์)   |
| GET    | `/api/developer-notes` | Dev notes                      |

### LuxuVet

| Method | Path                        | คำอธิบาย            |
| ------ | --------------------------- | ------------------- |
| GET    | `/api/luxuvet-stats`        | สถิติ LuxuVet       |
| POST   | `/api/luxuvet/migrate`      | Migrate ข้อมูล      |
| GET    | `/api/luxuvet/:table`       | ดึงข้อมูล table ใดๆ |
| GET    | `/api/luxuvet/:table/:id`   | ดึงแถวเดียว         |
| POST   | `/api/luxuvet/:table`       | เพิ่มแถว            |
| POST   | `/api/luxuvet/:table/batch` | เพิ่มหลายแถว        |
| PUT    | `/api/luxuvet/:table/:id`   | แก้ไขแถว            |
| DELETE | `/api/luxuvet/:table/:id`   | ลบแถว               |

---

## 8. ระบบพิเศษ

### 8.1 ระบบ HN (Hospital Number) อัตโนมัติ

```
การสร้าง HN ใหม่:
1. ตรวจสอบว่าเป็น record ประเภทที่ต้องการ HN หรือไม่
   (ไม่สร้างให้ billType: cashier/shop)
2. ค้นหา HN เดิมของเจ้าของจาก DB ก่อน:
   - Priority 1: match ด้วย ownerName + phoneNumber
   - Priority 2: match ด้วย ownerName (เดียวในระบบ)
   - Priority 3: match ด้วย phone (unique)
3. ถ้าไม่พบ → สร้างใหม่ (HN000001, HN000002, ...)
4. Uniqueness guard: วน check ซ้ำใน DB สูงสุด 100 ครั้ง
5. Self-healing: ถ้า counter ต่ำกว่า max ใน DB → ปรับอัตโนมัติ

Backfill Modes (สำหรับข้อมูลเก่า):
- missing  : เติม HN ให้เฉพาะที่ยังไม่มี
- unify    : รวม HN ซ้ำของเจ้าของคนเดียวกันให้เป็นอันเดียว
- regenerate: สร้าง HN ใหม่ทั้งหมด
```

### 8.2 ระบบ Record Locking (Multi-user)

เมื่อมีหลายเครื่องใช้ผ่าน LAN:

- เมื่อเปิด record เพื่อแก้ไข → Lock โดยบันทึก `lockedBy` + `lockedAt`
- Lock refresh ทุก 60 วินาที (auto-renew)
- ถ้า lock หมดอายุ (>5 นาที) → ถือว่า unlock อัตโนมัติ
- หน้า Cashier ใช้ระบบนี้ป้องกัน double-payment

### 8.3 OCR Scanner

- ใช้ **Tesseract.js** (ทำงาน local ทั้งหมด)
- รองรับภาษา: ไทย (`tha.traineddata`) + อังกฤษ (`eng.traineddata`)
- มี queue system สำหรับ OCR งานหลายชิ้น
- ผล OCR เก็บใน `ocr-result-queue.json`

### 8.4 Thai ID Card Reader

- อ่านบัตรประชาชนผ่าน PowerShell script (`thai-id-reader.ps1`, `card-diag.ps1`)
- ส่งข้อมูลกลับมา: ชื่อ, เลขบัตร, ที่อยู่
- เก็บข้อมูลบัตรใน `owner_idcards` table และ `queue.idCardJson`

### 8.5 Document Generator

- **ใบเสร็จ/Invoice** — สร้าง PDF ด้วย receipt-engine.js
- **จดหมายส่งตัว** — สร้างไฟล์ `.docx` ด้วย `docx` library
- **Discharge Summary** — สร้างไฟล์ `.docx`
- **ฉลากยา** — พิมพ์ผ่านหน้า drug-label.html
- **Tax Documents** — ภาษีซื้อ/ภาษีหัก ณ ที่จ่าย

### 8.6 BSAVA Drug Reference

- Import ข้อมูลยาจาก **BSAVA PDF** (2 เล่ม — สุนัขแมว และ Exotic)
- ใช้ `pdf-parse` extract ข้อความ
- มี flexible textbook import system พร้อม custom profiles
- เก็บข้อมูลยาไว้ใน `bsava_formulary` table
- ค้นหา / autocomplete ยาขณะเขียน prescription

### 8.7 AI-like Suggestions

- ระบบ `/api/suggestions` เรียนรู้จากข้อมูลที่บันทึกมา
- Autocomplete: dx, treatment, prescription, followUp
- ข้อมูลมาจาก `records` + `treatment_items` + `standard_treatments`
- ยิ่งใช้บ่อย ยิ่งขึ้นมาก่อน (useCount ranking)

### 8.8 Cash Drawer

- รองรับการเปิด Cash drawer อัตโนมัติเมื่อชำระเงิน
- ใช้ `cash-drawer.js`

### 8.9 Firewall Management

- จัดการ Windows Firewall ผ่าน Electron IPC
- `check-firewall` — ตรวจสอบ rule
- `add-firewall-rule` — เพิ่ม rule เปิด port 3000
- `enable-firewall` / `disable-firewall` — เปิด/ปิด Firewall

### 8.10 Text Encoding Fix

- `text-fixer.js` แก้ปัญหา Thai text mojibake (ตัวอักษรเสีย)
- ใช้กับการอ่าน clinic-config.json (รองรับ UTF-16LE, UTF-8 w/BOM, UTF-8)

---

## 9. ระบบ License

### การทำงาน

```
1. ติดตั้งครั้งแรก:
   - สร้าง Hardware ID จาก system info (CPU, MAC, hostname)
   - บันทึก firstInstallDate
   - เริ่ม Trial period 7 วัน
   - บันทึกลง license.dat (Encrypted)

2. ทุกครั้งที่เปิดโปรแกรม:
   - โหลด license.dat → decrypt → ตรวจสอบ checksum
   - ถ้าไฟล์เสีย → ลอง restore จาก .lic.bak
   - ตรวจสอบ: Trial หมดหรือยัง? / Hardware ID ตรงไหม?
   - ถ้าไม่ผ่าน → เปิดหน้า Activation

3. Activation:
   - ผู้ใช้ใส่ License Key
   - ตรวจสอบ Key ด้วย Secret + Hardware ID
   - บันทึก activated=true + activationDate
   - Secret Key ในโค้ด: 'PaWaT1986PaWaT1986'

4. API Endpoints ที่ไม่ถูก Block แม้ license หมด:
   - /api/license/info
   - /api/license/check
   - /api/license/activate
```

### ข้อมูลใน license.dat (หลัง decrypt)

```json
{
  "version": "1.0",
  "hardwareId": "...",
  "firstInstallDate": "ISO Date",
  "lastCheckDate": "ISO Date",
  "activated": true/false,
  "licenseKey": "...",
  "activationDate": "ISO Date",
  "firstRunNotified": true/false,
  "checksum": "..."
}
```

---

## 10. การ Backup และ Update

### Local Backup

- **Export**: GET `/api/backup/full` — สร้าง ZIP ที่มี:
  - `vet_clinic.db`
  - โฟลเดอร์ `images/`
  - `clinic-config.json`
- **Restore**: POST `/api/backup/restore` — upload ZIP กลับ

### Cloud Backup (Optional)

- IPC: `cloud-backup`
- ส่งไฟล์ `vet_clinic.db` ด้วย HTTP PUT ไปยัง URL ที่ผู้ใช้กำหนดเอง
- Header: `Authorization: Bearer <token>`, `X-Filename: docuvet_backup_<timestamp>.db`
- ไม่มี auto-schedule ใช้งานได้จริงในโค้ดปัจจุบัน (set-auto-backup เป็น stub)

### Auto Update

- ใช้ Electron `autoUpdater`
- Provider: **GitHub Releases**
- Repository: `github.com/greatjug/docuvet4.02T`
- Config: `app-update.yml`

### Config Backup

- `clinic-config.json` มีสำเนาหลายเวอร์ชัน (timestamp backup)
- ตัวอย่าง: `clinic-config.json.backup.2026-02-11T15-58-02-835Z`

---

## 11. ไฟล์และโฟลเดอร์สำคัญ

### ไฟล์ในโปรแกรม (`app.asar`)

```
main.js                    — Main process (~707 KB, ~14,000 บรรทัด)
index.html                 — หน้า DocuVet หลัก
ControlVet.html            — หน้า ControlVet
cashier.html               — หน้า Cashier
treatment-tab.html         — หน้าตรวจรักษา
surgery-log.html           — หน้าผ่าตัด
drug-label.html            — หน้าฉลากยา
ocr-scanner.html           — หน้า OCR
activation.html            — หน้า Activation
consolelauncher.html       — Console viewer
license-manager.js         — License system
receipt-engine.js          — PDF generator
text-fixer.js              — Thai encoding fix
ocr-engine.js              — OCR wrapper
thai-id-reader.js          — บัตรประชาชน
bsava-drugs.json           — ข้อมูลยา BSAVA (preloaded)
default-drugs.json         — ยาเริ่มต้น
clinic-config.template.json — Template config
eng.traineddata            — Tesseract English model
tha.traineddata            — Tesseract Thai model
sandy.xlsx                 — (ไม่ทราบวัตถุประสงค์)
EULA.txt                   — ข้อตกลงการใช้งาน
```

### ไฟล์ Data (userData path)

```
%AppData%\naphat-vet-system\
├── vet_clinic.db                    — SQLite Database (ข้อมูลทั้งหมด)
├── clinic-config.json               — ตั้งค่าคลินิก (Counter, prefix, ข้อมูลคลินิก)
├── clinic-config.json.backup.*      — Backup config หลายเวอร์ชัน
├── license.dat                      — License (encrypted)
├── .lic.bak                         — License backup
├── ocr-result-queue.json            — OCR queue
├── images\                          — รูปภาพผลแลป / X-ray
├── receipts\                        — ใบเสร็จ PDF
└── assets\
    ├── fonts\                       — Sarabun fonts (TTF)
    └── clinic\                      — โลโก้คลินิก
```

### ตำแหน่ง clinic-config.json จริง (Windows)

```
C:\Users\<ชื่อ User>\AppData\Roaming\naphat-vet-system\clinic-config.json
```

---

## ตัวเลขสรุป

| รายการ                     | จำนวน                              |
| -------------------------- | ---------------------------------- |
| ตาราง Database             | **~40 ตาราง**                      |
| REST API Endpoints         | **~180+ endpoints**                |
| Electron IPC Handlers      | **~30 handlers**                   |
| บรรทัดโค้ด main.js         | **~14,400 บรรทัด**                 |
| รายการ Service preloaded   | **60+ รายการ**                     |
| แพ็คเกจราคา preloaded      | **12 แพ็คเกจ**                     |
| Template bundles preloaded | **10+ bundles**                    |
| Default IPD Wards          | **4 wards (A, B, ICU, Isolation)** |

---

_รายงานนี้ถอดรหัสจาก app.asar โดยตรง — ข้อมูลถูกต้อง ณ เวอร์ชัน 3.2.0_
