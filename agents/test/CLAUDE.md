# Test Agent — CLAUDE.md

## Role
ทดสอบระบบ FUFU Partner Portal ครอบคลุมทั้ง API (server-side) และ UI flow (checklist)
รายงานผลเป็น ✅ PASS / ❌ FAIL / ⚠ WARN พร้อมรายละเอียดที่จำเป็น

---

## Environment

```
Dev server : npm run dev  →  http://localhost:3000
Test user  : multi@fufu.app / 123456789
Stores     : FUFU Vet Clinic (vet_clinic) · FUFU Mega Shop (pet_shop)
             FUFU Grand Hotel (pet_hotel) · FUFU Premium Grooming (pet_grooming)
```

ก่อนรัน test ทุกครั้ง: ตรวจสอบว่า server รันอยู่ที่ port 3000

---

## API Test Suite

### Auth

| # | Request | Expected |
|---|---|---|
| A1 | `POST /api/auth/login` `{email, password}` ถูกต้อง | `success:true`, `stores` array ไม่ว่าง |
| A2 | `POST /api/auth/login` password ผิด | `success:false` |
| A3 | `GET /api/queue` ไม่มี token | `401 Missing token` |
| A4 | `GET /api/queue` token ไม่ถูก | `401 Invalid or expired token` |

### Queue

| # | Request | Expected |
|---|---|---|
| Q1 | `GET /api/queue?store_id=<id>&date=<today>` | `success:true`, data array |
| Q2 | `POST /api/queue` `{store_id, pet_name, owner_name, service_type}` | `success:true`, `queue_number` auto-increment |
| Q3 | `POST /api/queue` ซ้ำอีกครั้ง | queue_number เพิ่มขึ้น 1 |
| Q4 | `PATCH /api/queue/:id` `{status:"called"}` | `called_at` timestamp ถูก set |
| Q5 | `PATCH /api/queue/:id` `{status:"completed"}` | `completed_at` timestamp ถูก set |
| Q6 | `POST /api/queue` ไม่มี `store_id` | `400 store_id required` |

### Medical Records

| # | Request | Expected |
|---|---|---|
| M1 | `POST /api/medical-records` full OPD payload | `success:true`, `id` คืนมา |
| M2 | `GET /api/medical-records?store_id=<id>` | array ของ records |
| M3 | `GET /api/medical-records/:id` | record เดียว |
| M4 | `PATCH /api/medical-records/:id` `{status:"completed"}` | อัพเดทสำเร็จ |
| M5 | `GET /api/medical-records?store_id=<id>&record_type=opd` | เฉพาะ OPD records |

### Finance

| # | Request | Expected |
|---|---|---|
| F1 | `GET /api/finance/summary?store_id=<id>` | `{today, week, month, commission}` |
| F2 | `GET /api/finance/transactions?store_id=<id>` | array ของ transactions |
| F3 | `POST /api/finance/transactions` `{store_id, amount:1000, type:"consultation"}` | `commission` = 50, `net_amount` = 950 |

### Stores

| # | Request | Expected |
|---|---|---|
| S1 | `GET /api/stores` (with token) | stores ของ user นี้ |
| S2 | `POST /api/stores` `{name, category}` | สร้าง store ใหม่ |

---

## How to Run API Tests

ใช้ curl หรือ fetch จาก Node.js script:

```bash
# 1. Login และเก็บ token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"multi@fufu.app","password":"123456789"}' \
  | node -e "process.stdin.resume();process.stdin.on('data',d=>{const r=JSON.parse(d);console.log(r.token)})")

# 2. ดึง stores
STORE_ID=$(curl -s http://localhost:3000/api/stores \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "process.stdin.resume();process.stdin.on('data',d=>{const r=JSON.parse(d);console.log(r.data[0].id)})")

# 3. Test queue
curl -s "http://localhost:3000/api/queue?store_id=$STORE_ID&date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN"
```

---

## UI Flow Checklist

### 1. Auth Flow
- [ ] เข้า `http://localhost:3000/login.html` — เห็น login form
- [ ] ถ้า login อยู่แล้ว — banner "คุณ login อยู่แล้ว" ปรากฏ ไม่ redirect อัตโนมัติ
- [ ] Login ด้วย credentials ผิด — toast error
- [ ] Login สำเร็จ, มี 1 store — redirect dashboard ทันที
- [ ] Login สำเร็จ, มีหลาย store — เห็น store picker
- [ ] กด Logout — redirect กลับ login

### 2. Dashboard Home
- [ ] Sidebar แสดงชื่อ store และ role ถูกต้อง
- [ ] Stat cards แสดง: รอตรวจ / กำลังรักษา / เสร็จ / รายได้วันนี้
- [ ] คิววันนี้ preview ≤ 6 รายการ
- [ ] กด "ดูทั้งหมด →" → navigate ไปหน้า queue

### 3. Queue
- [ ] Walk-in bar แสดงครบ (ชื่อ, เจ้าของ, บริการ, 🚨 ด่วน)
- [ ] เพิ่ม walk-in → card ปรากฏ, queue_number auto-increment
- [ ] เพิ่มด่วน → card อยู่บนสุด, border สีแดง
- [ ] Stat bar นับถูกต้อง (รอ / กำลังรักษา / เสร็จ / ทั้งหมด)
- [ ] กด 📢 เรียก → badge เปลี่ยน "เรียกแล้ว"
- [ ] กด ▶ เริ่มรักษา → badge เปลี่ยน "กำลังรักษา"
- [ ] กด ✓ เสร็จ → card dimmed
- [ ] กด 📋 OPD → navigate ไป OPD card พร้อม pre-fill ชื่อ
- [ ] กด ❌ ไม่มา → card dimmed

### 4. OPD Card (เปิดจาก Queue)
- [ ] ชื่อสัตว์เลี้ยง + เจ้าของ pre-fill จาก queue notes
- [ ] เลือก species → emoji เปลี่ยน
- [ ] กรอก vitals → ถ้าเกิน range ตัวเลขเป็นสีแดง
- [ ] กรอก SOAP ทุก box → รอ 1.5 วิ → "✓ บันทึกแล้ว" (autosave)
- [ ] กด + เพิ่มยา → modal → กรอกข้อมูล → รายการยาปรากฏ
- [ ] กด × บนรายการยา → ลบออก
- [ ] กด 💾 บันทึก → "✓ บันทึกแล้ว"
- [ ] กด ← กลับ → navigate กลับ Queue

### 5. ประวัติการรักษา
- [ ] แสดง list ของ OPD records ทั้งหมด
- [ ] แต่ละ row: ชื่อสัตว์ + เจ้าของ + วันที่ + status badge
- [ ] vitals badge (น้ำหนัก/อุณหภูมิ) แสดงถ้ามีข้อมูล
- [ ] ค้นหาชื่อ → filter ทันที
- [ ] filter dropdown (กำลังรักษา/เสร็จ) → filter ทันที
- [ ] กดที่ row → เปิด OPD card พร้อม pre-fill ทุก field
- [ ] แก้ข้อมูล → autosave ใช้ PATCH (ไม่สร้าง record ใหม่)
- [ ] กด ← กลับ → navigate กลับ ประวัติการรักษา

### 6. รายได้
- [ ] Stat cards 4 ใบ: วันนี้ / 7วัน / เดือนนี้ / ค่าคอม 5%
- [ ] ตารางธุรกรรม: วันที่ / ประเภท / ยอด / ค่าคอม / สุทธิ

---

## Regression Tests (รันหลังทุก deploy)

```
1. Login → เลือก store → Dashboard โหลดได้
2. เพิ่ม queue → เปลี่ยน status ครบ cycle
3. เปิด OPD → บันทึก → เปิดจากประวัติ → ข้อมูลครบ
4. API: POST medical-records → GET medical-records → ข้อมูลตรงกัน
5. Logout → token หมด → access /api/queue → 401
```

---

## Known Issues (อัพเดทเมื่อเจอ)

| วันที่ | Issue | สถานะ |
|---|---|---|
| 2026-04-26 | `medical_records` ขาด columns → แก้ด้วย ALTER TABLE + NOTIFY pgrst | ✅ Fixed |
| 2026-04-26 | `stores` query คืน empty เพราะ RLS + anon key → แก้ด้วย user-scoped client | ✅ Fixed |
| 2026-04-26 | `branch_name` ไม่มีใน DB → ตัดออกจาก SELECT | ✅ Fixed |

---

## Reporting Format

เมื่อ test เสร็จให้รายงานในรูปแบบ:

```
## Test Report — YYYY-MM-DD

### API Tests
A1 ✅ Login returns token + 4 stores
A2 ✅ Wrong password returns 401
Q1 ✅ GET queue returns array
...

### UI Checklist
Auth Flow      ✅ 6/6
Dashboard Home ✅ 4/4
Queue          ✅ 9/9
OPD Card       ⚠ 7/8 — autosave ไม่ทำงานเมื่อ network ช้า
Medical List   ✅ 8/8
Finance        ✅ 2/2

### Bugs Found
- [BUG] ...
```
