# FUFU Partner — Clinic Tasks
> สร้าง: 10 พ.ค. 2026 | Project: FUFU_partner | Stack: Node/Express + Supabase + Tailwind + Vanilla HTML

---

## 🔴 BUG — ต้องแก้ก่อน

### BUG-01 · คิวตรวจไม่แสดงผล
**หน้า:** คิวตรวจ (Queue)
**อาการ:** หน้า Queue แสดงว่าว่างเปล่า ทั้งที่มีข้อมูล appointment/queue อยู่ใน Supabase จริง
**สิ่งที่ต้องทำ:**
- ตรวจสอบ query ดึงข้อมูล queue ว่า filter status หรือ date ถูกต้องไหม
- ตรวจสอบ Supabase Realtime subscription ว่า subscribe channel ถูก table/filter หรือเปล่า
- แก้ให้หน้า Queue โหลดข้อมูลถูกต้อง และ update แบบ realtime เมื่อมี queue ใหม่เข้ามา

---

### BUG-02 · นัดหมาย: Schema error + ไม่มีช่องเลือกสัตว์เลี้ยง
**หน้า:** สัตว์เลี้ยง & นัดหมาย > Modal "สร้างนัดหมาย"
**อาการ:**
1. Error: `Could not find the 'notes' column of 'appointments' in the schema cache`
2. Modal ไม่มีช่องให้เลือกว่าจะนัดเจ้าของ/สัตว์เลี้ยงคนไหน

**สิ่งที่ต้องทำ:**
- เพิ่ม column `notes TEXT` ใน table `appointments` แล้ว run migration / reload Supabase schema cache
- เพิ่ม searchable dropdown ใน Modal "สร้างนัดหมาย" ให้เลือก Owner ก่อน แล้ว filter Pet ตาม Owner
- Form fields ที่ควรมีใน Modal: วันที่นัด, เวลา, เลือกเจ้าของ (search by name/phone), เลือกสัตว์เลี้ยง, บริการ, หมายเหตุ (notes)

---

## 🟠 UX/UI — ปรับให้ใช้งานง่ายขึ้น

### UX-01 · หน้าสัตว์เลี้ยง & เจ้าของ ต้องพิมพ์หาก่อนถึงจะเห็นข้อมูล
**หน้า:** สัตว์เลี้ยง & นัดหมาย (tab สัตว์เลี้ยง / เจ้าของ)
**อาการ:** หน้าว่างเปล่า ต้องพิมพ์ใน search box ก่อนถึงจะมีข้อมูลขึ้น

**สิ่งที่ต้องทำ:**
- เมื่อเปิดหน้า ให้ดึงข้อมูลทั้งหมด (query ว่าง = ดึงทุกรายการ) แสดงเป็น list ทันที
- เพิ่ม pagination หรือ infinite scroll เพื่อรองรับข้อมูลจำนวนมาก
- search box ยังคงใช้งานได้ตามปกติ (filter จาก list ที่โหลดมาแล้ว หรือ query ใหม่ก็ได้)

---

### UX-02 · OPD Card Layout ไม่สวย
**หน้า:** หน้าบันทึกการตรวจ (OPD Card)
**อาการ:** Card เล็กเกินไป พื้นที่ไม่ได้ใช้งาน textarea บีบอัด

**สิ่งที่ต้องทำ:**
- ปรับ layout ให้ใช้พื้นที่เต็มหน้า (full-width container)
- ส่วน HX, PE, Dx, Tx ปรับเป็น 2-column grid (HX|PE บนบน, Dx|Tx ล่าง) หรือ full-width stacked ที่ textarea กว้างขึ้น
- เพิ่ม min-height ของ textarea แต่ละช่องให้พิมพ์ได้สบาย (อย่างน้อย 120px)
- เพิ่ม padding/margin ภายใน card ให้หายใจได้

---

### UX-03 · กราฟรายได้แสดงผลไม่สวย
**หน้า:** รายได้
**อาการ:** Bar chart เล็ก label อ่านยาก ไม่มี tooltip

**สิ่งที่ต้องทำ:**
- เพิ่มความสูงของ chart container (อย่างน้อย 250px)
- format label แกน X เป็น dd/MM (เช่น 10/05)
- แสดง tooltip เมื่อ hover แสดงวันที่ + ยอด (฿)
- แสดงค่า ฿ บน bar หรือใกล้ bar เมื่อข้อมูลไม่หนาแน่น

---

### UX-04 · Task Board หน้าตาไม่ดีพอ
**หน้า:** Task Board
**อาการ:** UI ยังไม่น่าใช้งาน

**สิ่งที่ต้องทำ:**
- ปรับเป็น Kanban layout: column แต่ละสถานะ (Todo / In Progress / Done)
- Card แต่ละ task แสดง: ชื่องาน, ผู้รับผิดชอบ (assignee), สถานะ, priority badge
- มีปุ่ม move task ระหว่าง column (ถ้ายังไม่ทำ drag & drop ก็ใช้ปุ่ม dropdown สถานะแทนได้)

---

## 🔵 FEATURE — สิ่งที่ต้องเพิ่ม

### FEAT-01 · IPD Ward — แยก Operation Mode กับ Settings Mode
**หน้า:** IPD Ward
**สิ่งที่ต้องทำ:**
- เพิ่มปุ่ม ⚙️ "ตั้งค่ากรง" (เฉพาะ admin/vet role) → เปิด Settings Mode
  - Settings Mode: CRUD กรง (เพิ่ม/แก้ชื่อ/ลบกรง, ตั้งราคา/วัน, กำหนด type: ปกติ/ICU)
- โหมดปกติ (Operation Mode) แสดงเฉพาะ:
  - รับสัตว์เข้ากรง (assign pet → cage)
  - จำหน่ายสัตว์ออก (discharge)
  - บันทึก Treatment log ประจำวัน (ให้อาหาร, ยา, สังเกตอาการ)

---

### FEAT-02 · Audit Trail — ประวัติการรักษา
**หน้า:** OPD Card / ประวัติการรักษา
**สิ่งที่ต้องทำ:**

**ฝั่ง Database (Supabase):**
- เพิ่ม column ใน OPD card table: `created_by UUID FK→staff`, `updated_by UUID FK→staff`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- สร้าง table `audit_logs`: `id`, `action` (create/update/delete), `target_table`, `target_id`, `old_data JSONB`, `new_data JSONB`, `performed_by UUID FK→staff`, `performed_at TIMESTAMPTZ`
- ใช้ soft delete: เพิ่ม column `deleted_at`, `deleted_by` แทนการลบจริง

**ฝั่ง UI:**
- แสดงชื่อ/ID สัตวแพทย์ที่บันทึก + วันเวลา ใต้แต่ละ OPD Card entry
- ปุ่มลบ OPD Card: เปิด confirm dialog "ยืนยันการลบ? การกระทำนี้จะถูกบันทึก log"
- หลังลบ → บันทึก log ใน `audit_logs` ทันที

---

### FEAT-03 · Stock ยา — เชื่อมกับ RX และ IPD
**หน้า:** Stock / คลัง
**สิ่งที่ต้องทำ:**
- เมื่อบันทึกใบสั่งยา (RX) ใน OPD Card → stock ของยานั้น -quantity อัตโนมัติ
- เมื่อบันทึก Treatment log ใน IPD → stock ของยาที่ให้ -quantity อัตโนมัติ
- ตั้ง low stock threshold ต่อรายการยา → แสดง badge เตือนบน Dashboard และ menu Stock
- เพิ่มหน้า "รายงาน Stock": ประวัติการเบิก-จ่ายรายการยา (who, when, qty, source: OPD/IPD/Manual)

---

### FEAT-04 · ระบบ Role & Permission แบบ Custom
**หน้า:** ตั้งค่า > พนักงาน / สิทธิ์
**อ้างอิง:** Discord Role System

**สิ่งที่ต้องทำ:**

**ฝั่ง Database:**
- สร้าง table `roles`: `id`, `clinic_id`, `name`, `color`, `permissions JSONB`
- `permissions JSONB` โครงสร้าง: `{ "queue": ["view","edit"], "opd": ["view","create","edit"], "ipd": ["view"], "stock": [], "finance": [], "settings": [] }`
- สร้าง table `staff_roles`: `staff_id`, `role_id` (many-to-many)

**ฝั่ง UI:**
- หน้า "จัดการ Role": สร้าง/แก้ไข/ลบ Role พร้อมตั้งชื่อ + เลือก permission ต่อ module (toggle สวิตช์)
- ปุ่ม "Preview มุมมอง" — เลือก Role แล้วแสดง UI จำลองว่า Role นั้นเห็นอะไรได้บ้าง
- UI/Navigation ซ่อน menu และปุ่มที่ Role นั้นไม่มีสิทธิ์ (frontend guard)
- Backend: Supabase RLS policy ตาม role ของ staff ที่ login

**พนักงาน:**
- เพิ่มฟิลด์ Clinic USER_ID (เช่น VET001) ให้แต่ละพนักงาน — แสดงใน audit log แทน UUID
- เพิ่มปุ่ม "Reset รหัสผ่าน" ที่ใช้งานได้จริง (ส่ง reset link หรือตั้งรหัสใหม่ชั่วคราว)

---

### FEAT-05 · Settings คลินิก
**หน้า:** ตั้งค่า > คลินิก
**สิ่งที่ต้องทำ:**

**เวลาทำการ:**
- ตั้งค่าวัน/เวลาเปิด-ปิดแบบ weekly schedule (แต่ละวันเปิด-ปิดกี่โมง หรือ ปิดทั้งวัน)
- ข้อมูลนี้ส่งให้ฝั่ง App (Mobile) เพื่อไม่ให้ user จองนอกเวลา

**ค่ารักษา:**
- ตั้งค่าอัตราค่ารักษาเบื้องต้น (ค่าตรวจทั่วไป, ค่าแรงต่อ procedure แต่ละประเภท)
- ดึงค่านี้มา pre-fill ใน POS เมื่อเปิด bill — แก้ได้ต่อ visit

**สินค้า / ยา / อุปกรณ์:**
- หน้า CRUD รายการสินค้า: ชื่อ, ราคาขาย, ต้นทุน, หน่วย (เม็ด/ขวด/ชิ้น), หมวดหมู่ (ยา/วัสดุสิ้นเปลือง/อุปกรณ์), จำนวน stock ปัจจุบัน
- รายการนี้ link กับ Stock (FEAT-03) และ POS โดยตรง

---

## 📋 สรุป Priority

| ID | หัวข้อ | Priority | ความซับซ้อน |
|----|--------|----------|-------------|
| BUG-01 | คิวตรวจไม่ขึ้น | 🔴 Critical | ต่ำ |
| BUG-02 | Modal นัด: schema error + ไม่มีช่องเลือกสัตว์ | 🔴 Critical | ต่ำ-กลาง |
| UX-01 | List สัตว์เลี้ยง/เจ้าของ ต้องพิมพ์หาก่อน | 🟠 High | ต่ำ |
| UX-02 | OPD Card layout | 🟠 High | ต่ำ |
| UX-03 | กราฟรายได้ | 🟡 Medium | ต่ำ |
| UX-04 | Task Board | 🟡 Medium | กลาง |
| FEAT-01 | IPD แยก mode | 🟠 High | กลาง |
| FEAT-02 | Audit Trail OPD | 🟠 High | กลาง |
| FEAT-03 | Stock เชื่อม RX/IPD | 🟠 High | กลาง-สูง |
| FEAT-04 | Role & Permission | 🟡 Medium | สูง |
| FEAT-05 | Settings คลินิก | 🟡 Medium | กลาง |
