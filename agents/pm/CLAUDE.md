# Project Manager Agent — CLAUDE.md

## Role
คุมภาพรวมการพัฒนา FUFU Partner Portal ทั้งหมด — ติดตาม progress, จัดลำดับ priority, ระบุ dependency, และ brief sub-agents ก่อนลงมือทำงาน

---

## Project Overview

**Product:** Pet business management platform (Partner Portal)
**Partner types:** vet_clinic · pet_shop · pet_hotel · pet_grooming
**Tech stack:** Vanilla JS (ES Modules) · Node.js/Express · Supabase (PostgreSQL + Auth) · Tailwind CSS
**Repo structure:**
```
FUFU_partner/
├── public/          ← static files served by Express (HTML, CSS, JS)
├── server/          ← Express backend
│   ├── index.js     ← entry point (port 3000)
│   └── routes/      ← API route handlers
├── src/             ← source CSS (Tailwind input)
├── agents/          ← sub-agent context files
└── .env             ← SUPABASE_URL, SUPABASE_KEY, PORT
```

**Dev command:** `npm run dev` → `http://localhost:3000`

---

## Completion Status (as of 2026-04-26)

| Module | % Done | Blocking Issues |
|---|---|---|
| **Auth** | 55% | Token refresh ไม่มี, 401 ไม่ redirect |
| **Queue** | 50% | UI เป็น table (ต้อง rebuild เป็น card), ไม่มี OPD bridge |
| **Clinic (OPD/IPD)** | 45% | OPD card ต้อง rebuild, ขาด PATCH/GET endpoints |
| **Finance** | 35% | ข้อมูลทั้งหมดเป็น mock, ขาด GET /api/transactions |
| **Hotel** | 32% | UI มีแต่เป็น mock ทั้งหมด, DB tables ยังไม่มี |
| **Grooming** | 30% | UI มีแต่เป็น mock ทั้งหมด, ไม่มี API |
| **Inventory** | 28% | FEFO ยังไม่ implement, DB tables ยังไม่มี |
| **POS** | 25% | ไม่มี checkout flow จริง, invoices table ยังไม่มี |
| **Documents** | 22% | ทั้งหมด mock, ไม่มี API, DB table ยังไม่มี |

**Overall: ~38% complete**

---

## Development Phases

### Phase 1 — Core Vet Clinic Flow (สูงสุด)
เป้าหมาย: vet clinic ใช้งานได้ครบ 1 วันทำงาน

```
Auth fix → Queue rebuild → OPD Card rebuild → Finance real data
```

| Task | Owner Agent | Dependency | Status |
|---|---|---|---|
| Queue card UI + walk-in bar | queue | - | ❌ TODO |
| Queue → OPD bridge event | queue + clinic | queue UI | ❌ TODO |
| OPD Card rebuild (new layout + autosave) | clinic | - | ❌ TODO |
| PATCH /api/medical-records/:id | clinic | - | ❌ TODO |
| GET /api/transactions | finance | - | ❌ TODO |
| Auth 401 global redirect | auth | - | ❌ TODO |

### Phase 2 — Backend Data Layer
เป้าหมาย: ต่อ real DB แทน mock ทุก module

| Task | Owner Agent | Dependency | Status |
|---|---|---|---|
| inventory_batches + stock_movements DB | inventory | - | ❌ TODO |
| FEFO dispense logic (POST /api/inventory/dispense) | inventory | DB tables | ❌ TODO |
| Expiry alert 3-tier (30/60/90d) | inventory | - | ❌ TODO |
| hotel_rooms + hotel_bookings DB | hotel | - | ❌ TODO |
| Hotel check-in/out API | hotel | DB tables | ❌ TODO |
| grooming_sessions DB + start/complete API | grooming | - | ❌ TODO |
| Finance GET /api/transactions + summary | finance | - | ❌ TODO |
| Finance CSV export | finance | GET transactions | ❌ TODO |

### Phase 3 — POS & Documents
เป้าหมาย: ชำระเงินได้จริง + ออกเอกสารได้

| Task | Owner Agent | Dependency | Status |
|---|---|---|---|
| POS checkout flow (product select → payment) | pos | inventory | ❌ TODO |
| invoices DB table + POST /api/invoice | pos | - | ❌ TODO |
| PromptPay QR generation | pos | ENABLE_PROMPTPAY flag | ❌ TODO |
| Document templates (consent, prescription, referral) | document | - | ❌ TODO |
| PDF generation (browser print / server) | document | templates | ❌ TODO |
| Receipt auto-generate after payment | pos + document | POS flow | ❌ TODO |

### Phase 4 — Production Hardening
| Task | Status |
|---|---|
| RBAC enforcement ที่ API level | ❌ TODO |
| Token refresh rotation | ❌ TODO |
| Staff sub-auth (staff login under store) | ❌ TODO |
| Global error boundary (catch 401, network down) | ❌ TODO |

---

## Module Dependencies Map

```
Auth
 └─ ทุก module (ต้อง token ก่อนเรียก API)

Queue
 ├─ → Clinic/OPD   (fufu:openOPD event)
 ├─ → Grooming     (queue entry เป็น grooming session)
 └─ → Hotel        (queue entry เป็น hotel check-in arrival)

Clinic/OPD
 ├─ ← Queue        (รับ queueItem)
 ├─ → Inventory    (dispense ยาจาก prescription — FEFO)
 ├─ → POS          (ส่ง line items หลังรักษา)
 └─ → Documents    (สร้าง prescription document)

Inventory
 ├─ ← Clinic       (dispense ตาม prescription)
 └─ ← POS          (dispense ตาม checkout items)

POS
 ├─ ← Queue        (รับ queueItem context)
 ├─ ← Clinic       (รับ prescription line items)
 ├─ ← Hotel        (รับ stay bill)
 ├─ ← Grooming     (รับ session cost + add-ons)
 ├─ → Inventory    (dispense สินค้าที่ขาย)
 ├─ → Finance      (บันทึก transaction)
 └─ → Documents    (สร้าง receipt)

Finance
 └─ ← POS          (ข้อมูล transaction ทั้งหมด)

Documents
 ├─ ← Clinic       (consent, prescription, referral)
 └─ ← POS          (receipt)
```

---

## Key Business Rules (ห้ามเปลี่ยน)

1. **Commission 5%** — FUFU หัก 5% ทุก transaction (`COMMISSION_RATE = 0.05` ใน config.js)
2. **FEFO** — Inventory ต้องจ่าย batch ที่ expiry เร็วที่สุดก่อนเสมอ
3. **Immutable audit** — `audit_logs` table: INSERT only, ห้าม UPDATE/DELETE เด็ดขาด
4. **Queue numbering** — A001, A002... reset ทุกวันต่อ store
5. **Multi-store** — 1 user มีได้หลาย store; context switch ผ่าน `selected_store_id`
6. **Body map ถูกตัดออก** — ไม่ implement ใน OPD card แล้ว (ตัดสินใจ 2026-04-26)

---

## Sub-Agent Directory

| Agent | CLAUDE.md | ดูแลไฟล์หลัก |
|---|---|---|
| **auth** | `agents/auth/CLAUDE.md` | `public/js/auth.js`, `server/routes/auth.js` |
| **queue** | `agents/queue/CLAUDE.md` | `public/js/partner/queue.js` |
| **clinic** | `agents/clinic/CLAUDE.md` | `public/js/partner/opd-card.js`, `medical.js`, `ipd.js` |
| **inventory** | `agents/inventory/CLAUDE.md` | `public/js/partner/inventory.js` |
| **pos** | `agents/pos/CLAUDE.md` | `public/js/partner/finance.js`, `invoice.js` |
| **finance** | `agents/finance/CLAUDE.md` | `public/js/partner/finance.js` |
| **grooming** | `agents/grooming/CLAUDE.md` | `public/js/partner/grooming.js` |
| **hotel** | `agents/hotel/CLAUDE.md` | `public/js/partner/hotel.js` |
| **document** | `agents/document/CLAUDE.md` | `public/js/partner/documents.js` |

---

## How to Brief a Sub-Agent

เมื่อจะ assign งานให้ sub-agent ให้ระบุ:

1. **อ่าน CLAUDE.md** ของ module นั้นก่อนเสมอ
2. **ระบุ task** จาก Phase table ด้านบน
3. **ระบุ dependency** ที่ต้องรอหรือ assume เสร็จแล้ว
4. **อ่านไฟล์ที่เกี่ยวข้อง** ก่อนเขียนโค้ดใหม่
5. **อัพเดท status** ใน PM CLAUDE.md นี้หลังงานเสร็จ (❌ → ✅)

---

## Recently Completed

| วันที่ | งาน |
|---|---|
| 2026-04-26 | ตัด body map ออกจาก clinic scope |
| 2026-04-26 | Restore deleted source files (index.html, css/, js/) |
| 2026-04-26 | New server structure: `server/index.js` serves from `public/` |

---

## Environment

```env
PORT=3000
Project_URL=https://YOUR_PROJECT.supabase.co
publishable_key=YOUR_ANON_KEY
```

`.env` ต้องมีอยู่ที่ root ก่อน `npm run dev`
