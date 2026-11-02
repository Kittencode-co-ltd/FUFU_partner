# FUFU Partner

ระบบ Portal สำหรับร้านค้าและคลินิกใน FUFU ปัจจุบันเชื่อมกับ customer Web app
และเตรียมโครงสร้างให้ย้ายการใช้งานต่อไปยัง Mobile ได้
โมดูลเดิมสำหรับ POS, inventory, finance, grooming และ hotel ยังอยู่ใน source แต่ถูกซ่อน
จาก navigation เมื่อ `FEATURE_FLAGS.MVP_MODE` เป็น `true`.

Production-safe default คือ `PARTNER_MVP_MODE=true` และ sidebar จะแสดงเฉพาะ
เคสคัดกรอง AI, ภาพรวม, นัดหมาย, ปฏิทิน, สัตว์ที่เข้ารับบริการ, สรุปการเข้ารับบริการ,
ข้อมูลคลินิก, ผู้ใช้งาน และออกจากระบบ โมดูลเดิมจะไม่ถูก lazy-load ใน MVP path.
การปิด MVP mode ทำได้เฉพาะ development runtime โดย inject
`window.__FUFU_FEATURES__ = { PARTNER_MVP_MODE: false }` ก่อนโหลด `config.js`.

---

## 🧰 Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js (ES modules) + [Express 4](https://expressjs.com/) |
| Database / Auth | [Supabase](https://supabase.com/) (`@supabase/supabase-js`) — เข้า Postgres ผ่าน `pg` ในบาง flow |
| Frontend | Next.js + React marketing landing page, existing partner HTML/JS portal, [Tailwind CSS 3](https://tailwindcss.com/) |
| PWA | `public/manifest.json` + `public/sw.js` |

> เวอร์ชันก่อนหน้าเป็น PHP — ปัจจุบันย้ายมาเป็น Node/Express ครบทั้งหมดแล้ว

---

## 📁 Project Structure

```
FUFU_partner/
├── app/                    # Next.js App Router landing page
├── app/                    # Next.js App Router landing page
├── server/
│   ├── index.js              # Express entrypoint, mount routes, serve public/ and Next.js and Next.js
│   ├── middleware/auth.js    # JWT / Supabase session check
│   └── routes/               # 16 route modules ตามฟีเจอร์ (ดูตาราง API ด้านล่าง)
├── public/                   # Static assets ที่ Express serve ออกไป
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── manifest.json
│   ├── sw.js                 # Service worker (PWA)
│   ├── css/                  # Compiled Tailwind output
│   ├── js/                   # Frontend scripts
│   └── icons/
├── src/css/input.css         # Tailwind input file
├── scripts/migrate.js        # DB migration runner
├── docs/                     # SETUP, DEPLOYMENT, SUPABASE schema ฯลฯ
├── api.js                    # Shared API client / helpers
├── tailwind.config.js
├── package.json
└── .env.example
```

---

## 🚀 Quick Start

ต้องมี Node.js 20+ และ Supabase development/staging project ห้ามใช้ production
credential ระหว่างงาน Phase 0–1

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. สร้าง .env จาก template
cp .env.example .env
# แล้วแก้ .env ให้ชี้ไปที่ Supabase project ของตัวเอง

# 3. รัน dev server
npm run dev
# → http://localhost:3000

# 4. Watch Tailwind ระหว่างพัฒนา UI (เปิดอีกเทอร์มินัลหนึ่ง)
npm run watch:css
```

### Environment variables (`.env`)

| Key | คำอธิบาย |
|-----|----------|
| `PORT` | พอร์ตของ Express server (default `3000`) |
| `Project_URL` | URL ของ Supabase project, เช่น `https://xxx.supabase.co` |
| `publishable_key` | Supabase anon key |

service-role key และ AI secret ห้ามอยู่ใน browser bundle หรือ `.env.example`.

ใช้ template แยกตาม environment: `.env.development.example`,
`.env.staging.example` และ `.env.production.example` โดยคัดลอกเป็น `.env`
เฉพาะในเครื่องหรือ deployment secret store เท่านั้น

### Build CSS สำหรับ production

```bash
npm run build:css   # minified output → public/css/main.css
npm test            # security foundation/static regression tests
```

Schema ที่เป็น source of truth อยู่ใน `supabase/migrations/` และ seed สำหรับ local/staging
อยู่ที่ `supabase/seed.sql` ห้ามใช้ไฟล์ seed กับ production ดู data model และ security
report ที่ `docs/MVP-SCHEMA.md` และ `docs/PHASE-1-SECURITY-REPORT.md`.

---

## 🔌 API

ทุก route mount ที่ prefix `/api/*` จาก `server/index.js`

| Prefix | ไฟล์ | ใช้สำหรับ |
|--------|------|-----------|
| `/api/auth` | `routes/auth.js` | Login / register / session |
| `/api/queue` | `routes/queue.js` | คิวลูกค้าหน้าร้าน |
| `/api/appointments` | `routes/appointments.js` | นัดหมาย |
| `/api/medical-records` | `routes/medical.js` | เวชระเบียน (vet) |
| `/api/ipd` | `routes/ipd.js` | คนไข้ใน (vet) |
| `/api/pets` | `routes/pets.js` | ข้อมูลสัตว์เลี้ยง |
| `/api/pos` | `routes/pos.js` | ระบบขายหน้าร้าน |
| `/api/inventory` | `routes/inventory.js` | สต็อกสินค้า |
| `/api/stores` | `routes/stores.js` | ข้อมูลร้านค้า / partner |
| `/api/grooming` | `routes/grooming.js` | บริการเสริมสวย |
| `/api/hotel` | `routes/hotel.js` | จองห้อง / check-in/out |
| `/api/finance` | `routes/finance.js` | รายรับ / commission |
| `/api/staff` | `routes/staff.js` | จัดการพนักงานในร้าน |
| `/api/tasks` | `routes/tasks.js` | งานภายในร้าน |
| `/api/documents` | `routes/documents.js` | เอกสาร / ใบรับรอง |
| `/api/audit` | `routes/audit.js` | Audit log |

> รายละเอียด method/payload ของแต่ละ endpoint ดูในไฟล์ route ตรงๆ ได้

### Public route handling

หน้า `/` ใช้ Next.js App Router ผ่าน Express entrypoint เดิม; `/_next/*` ถูกส่งให้ Next.js หลังเช็ก static assets ส่วน `/index.html` redirect ไปหน้าใหม่ `/` เส้นทาง `/login.html`, `/register.html` และ `/dashboard.html` ยังคงเสิร์ฟจาก `public/` โดยตรง Unknown non-API routes fallback ไปที่ `public/login.html`

---

## 🎨 หน้าเว็บ (public/)

| ไฟล์ | บทบาท |
|------|-------|
| `login.html` | Login (รองรับทุก role) |
| `register.html` | สมัคร partner ใหม่ |
| `app/page.jsx` | Next.js landing page at `/` (`/index.html` redirects to it through Express) |
| `dashboard.html` | แดชบอร์ดหลักหลัง login (สลับ UI ตาม role) |

---

## 🏪 Partner roles ที่รองรับ

- **vet** — คลินิกสัตวแพทย์ (queue, medical records, IPD, appointments)
- **shop** — ร้านขายอาหาร/ของสัตว์เลี้ยง (POS, inventory)
- **grooming** — ร้านเสริมสวย (queue, appointments)
- **hotel** — โรงแรมสัตว์ (room booking, check-in/out)

โปรไฟล์ partner เก็บใน Supabase ตาม schema ใน `docs/SUPABASE-SCHEMA.md` / `docs/SUPABASE-SCHEMA-V2.sql`

---

## 🗄️ Database

Schema และ migration scripts อยู่ใน `docs/`:

- `docs/SUPABASE-SCHEMA.md` — เอกสารอธิบาย schema
- `docs/SUPABASE-SCHEMA-V2.sql` — full SQL ล่าสุด รันใน Supabase SQL Editor
- `docs/sql-inventory-migration.sql`, `docs/sql-pets-migration.sql` — migrations เฉพาะส่วน
- `scripts/migrate.js` — runner สำหรับ migration

หลัก ๆ: `partners`, `pets`, `appointments`, `transactions`, `products`, `rooms`, `medical_records` พร้อม **Row Level Security** เปิดทุกตาราง

---

## 🔐 Security

- Supabase Auth (JWT) — ตรวจ token ผ่าน `server/middleware/auth.js`
- Row Level Security (RLS) เปิดทุก table — partner เข้าถึงเฉพาะข้อมูลตัวเอง
- CORS ตั้งใน `server/index.js`
- Secret keys อยู่ใน `.env` (อย่า commit)

---

## 📱 เชื่อมต่อกับ FUFU Mobile (Flutter)

Mobile App (`E:\git_repo\FUFU-App-Mobile`) ใช้ `supabase_flutter` คุยกับ Supabase ตรง ไม่ผ่าน Express (ยกเว้น endpoint ที่ต้อง business logic เพิ่ม)

ตัวอย่าง — ดึงคิววันนี้ของร้าน:

```dart
final today = DateTime.now().toIso8601String().split('T')[0];
final data = await Supabase.instance.client
  .from('appointments')
  .select('*, pets(name, avatar_url), profiles(name, phone)')
  .eq('partner_id', partnerId)
  .gte('date_time', '${today}T00:00:00')
  .lte('date_time', '${today}T23:59:59')
  .order('date_time');
```

ถ้าต้องการ logic ฝั่ง server (เช่น คำนวณ commission) เรียก `https://<partner-host>/api/finance/...` แทน

---

## 📚 อ่านเพิ่ม

- `docs/SETUP.md` — setup เครื่อง dev แบบละเอียด
- `docs/DEPLOYMENT-CHECKLIST.md` — checklist ก่อน deploy production
- `docs/INTEGRATION-BLUEPRINTS.md` — pattern การเชื่อมต่อกับระบบอื่น
- `Design.MD` — สรุป design decisions

---

**FUFU Partner** • Built for FUFU Pet Care Platform 🐾


## FUFU marketing landing page

หน้าแรกที่ `/` ใช้ Next.js App Router และทำงานผ่าน Express entrypoint เดิม ส่วน `/login.html`, API, dashboard, Supabase Auth และระบบพาร์ทเนอร์ยังใช้เส้นทางเดิม หน้าเว็บเข้าสู่ระบบผ่านบัญชีพาร์ทเนอร์เดิม ไม่มีการสร้างระบบ auth ซ้ำ ดู feature mapping ที่ `FEATURE-MAPPING.md`
