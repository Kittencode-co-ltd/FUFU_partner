# FUFU Partner

ระบบหลังบ้านสำหรับพาร์ทเนอร์ของ FUFU Pet Care — รองรับ คลินิกสัตวแพทย์, ร้านขายอาหาร/ของสัตว์เลี้ยง, ร้านเสริมสวย (grooming) และโรงแรมสัตว์ พร้อมระบบ POS, จัดคิว, สต็อก และรายงานการเงิน

---

## 🧰 Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js (ES modules) + [Express 4](https://expressjs.com/) |
| Database / Auth | [Supabase](https://supabase.com/) (`@supabase/supabase-js`) — เข้า Postgres ผ่าน `pg` ในบาง flow |
| Frontend | Vanilla HTML + JS (Multi-page) + [Tailwind CSS 3](https://tailwindcss.com/) |
| PWA | `public/manifest.json` + `public/sw.js` |

> เวอร์ชันก่อนหน้าเป็น PHP — ปัจจุบันย้ายมาเป็น Node/Express ครบทั้งหมดแล้ว

---

## 📁 Project Structure

```
FUFU_partner/
├── server/
│   ├── index.js              # Express entrypoint, mount routes, serve public/
│   ├── middleware/auth.js    # JWT / Supabase session check
│   └── routes/               # 16 route modules ตามฟีเจอร์ (ดูตาราง API ด้านล่าง)
├── public/                   # Static assets ที่ Express serve ออกไป
│   ├── login.html
│   ├── register.html
│   ├── index.html
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

ต้องมี Node.js 20+ และโปรเจกต์ Supabase พร้อม anon key

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

### Build CSS สำหรับ production

```bash
npm run build:css   # minified output → public/css/main.css
```

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

### SPA fallback

ทุก path ที่ไม่ใช่ `/api/*` จะถูก redirect ไปที่ `public/login.html`

---

## 🎨 หน้าเว็บ (public/)

| ไฟล์ | บทบาท |
|------|-------|
| `login.html` | Login (รองรับทุก role) |
| `register.html` | สมัคร partner ใหม่ |
| `index.html` | Landing page |
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
