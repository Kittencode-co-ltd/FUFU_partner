# Upload Error Test Prompt — FUFU Partner

## วิธีใช้
คัดลอก prompt ด้านล่างไปใช้กับ Claude Code หรือ agent ใด ๆ ใน project นี้

---

## PROMPT

```
คุณคือ QA agent ของ FUFU Partner Portal
ภารกิจ: ทดสอบ endpoint ที่เป็นการ "อัพโหลด / บันทึกข้อมูล" ทุกตัว (POST และ PATCH)
เพื่อหาว่า module ไหน **บันทึกไม่ได้** และ **เพราะอะไร**

---

## ขั้นตอน

### STEP 0 — เตรียมความพร้อม
1. ตรวจสอบว่า dev server รันอยู่ที่ port 3000 ด้วย:
   curl -s http://localhost:3000/api/health || echo "SERVER NOT RUNNING"
   ถ้าไม่ได้รัน ให้รัน: npm run dev (รอ 3 วิแล้วค่อยทดสอบ)

2. Login เพื่อขอ token:
   TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"multi@fufu.app","password":"123456789"}' \
     | node -e "process.stdin.resume();process.stdin.on('data',d=>{const r=JSON.parse(d);console.log(r.token)})")
   echo "TOKEN: $TOKEN"

3. ดึง store IDs ทั้ง 4 ประเภท:
   curl -s http://localhost:3000/api/stores -H "Authorization: Bearer $TOKEN" | node -e "
     process.stdin.resume();
     process.stdin.on('data',d=>{
       const stores = JSON.parse(d).data;
       stores.forEach(s => console.log(s.category, s.id, s.name));
     })"
   บันทึก:
     VET_ID = store_id ของ vet_clinic
     SHOP_ID = store_id ของ pet_shop
     HOTEL_ID = store_id ของ pet_hotel
     GROOMING_ID = store_id ของ pet_grooming

---

### STEP 1 — ทดสอบแต่ละ module ตามลำดับนี้

สำหรับแต่ละ test: บันทึกผลเป็น ✅ PASS / ❌ FAIL พร้อม HTTP status + error message

---

#### MODULE: Queue
```
Q-W1  POST /api/queue
      body: {"store_id":"<VET_ID>","pet_name":"ทองหล่อ","owner_name":"คุณมานะ","service_type":"opd"}
      expect: success:true, queue_number มีค่า

Q-W2  PATCH /api/queue/<id จาก Q-W1>
      body: {"status":"called"}
      expect: success:true, called_at ถูก set

Q-W3  PATCH /api/queue/<id จาก Q-W1>
      body: {"status":"in_progress"}
      expect: success:true

Q-W4  PATCH /api/queue/<id จาก Q-W1>
      body: {"status":"completed"}
      expect: success:true, completed_at ถูก set
```

---

#### MODULE: Medical Records (OPD)
```
M-W1  POST /api/medical-records
      body: {
        "store_id":"<VET_ID>",
        "record_type":"opd",
        "pet_name":"ทองหล่อ",
        "owner_name":"คุณมานะ",
        "species":"dog",
        "chief_complaint":"ไม่ยอมกินข้าว",
        "vitals":{"weight":5.2,"temperature":38.5,"heart_rate":80},
        "soap_subjective":"เจ้าของแจ้งว่าไม่กินอาหาร 2 วัน",
        "soap_objective":"ซึม น้ำหนักลด",
        "soap_assessment":"Anorexia",
        "soap_plan":"ให้ยากระตุ้นความอยากอาหาร"
      }
      expect: success:true, id คืนมา

M-W2  PATCH /api/medical-records/<id จาก M-W1>
      body: {"status":"completed","soap_plan":"ให้ยา + นัดติดตาม 1 สัปดาห์"}
      expect: success:true
```

---

#### MODULE: Documents
```
D-W1  POST /api/documents
      body: {"store_id":"<VET_ID>","doc_type":"consent","title":"หนังสือยินยอมผ่าตัด ทองหล่อ","pet_name":"ทองหล่อ","owner_name":"คุณมานะ"}
      expect: success:true, id คืนมา, status:"draft"

D-W2  PATCH /api/documents/<id จาก D-W1>
      body: {"status":"final","content":"ข้าพเจ้ายินยอมให้ผ่าตัด..."}
      expect: success:true
```

---

#### MODULE: Finance
```
F-W1  POST /api/finance/transactions
      body: {"store_id":"<VET_ID>","amount":1500,"type":"consultation","description":"ค่าตรวจ OPD"}
      expect: success:true, commission=75 (5%), net_amount=1425

F-W2  POST /api/finance/transactions
      body: {"store_id":"<VET_ID>","amount":500,"type":"medication","description":"ค่ายา"}
      expect: success:true
```

---

#### MODULE: Expenses
```
E-W1  POST /api/expenses
      body: {"store_id":"<VET_ID>","amount":2000,"category":"supplies","description":"ซื้ออุปกรณ์คลินิก"}
      expect: success:true

E-W2  PATCH /api/expenses/<id จาก E-W1>
      body: {"amount":2500,"description":"ซื้ออุปกรณ์คลินิก (แก้ไข)"}
      expect: success:true
```

---

#### MODULE: Inventory
```
I-W1  POST /api/inventory/products
      body: {"store_id":"<VET_ID>","name":"ยาปฏิชีวนะ Amoxicillin 250mg","sku":"AMX250","unit":"เม็ด","price":5,"cost":2,"stock_qty":100,"min_stock":20}
      expect: success:true, id คืนมา

I-W2  PATCH /api/inventory/products/<id จาก I-W1>
      body: {"price":6,"stock_qty":120}
      expect: success:true

I-W3  POST /api/inventory/receive
      body: {"store_id":"<VET_ID>","product_id":"<id จาก I-W1>","qty":50,"note":"รับของจากซัพพลายเออร์"}
      expect: success:true, stock เพิ่มขึ้น

I-W4  POST /api/inventory/dispense
      body: {"store_id":"<VET_ID>","product_id":"<id จาก I-W1>","qty":5,"note":"จ่ายให้ผู้ป่วย"}
      expect: success:true, stock ลดลง

I-W5  POST /api/inventory/suppliers
      body: {"store_id":"<VET_ID>","name":"บริษัท ยาดี จำกัด","contact":"02-xxx-xxxx"}
      expect: success:true
```

---

#### MODULE: IPD (รพ. สัตว์)
```
IPD-W1  POST /api/ipd/cages
        body: {"store_id":"<VET_ID>","cage_number":"A01","cage_type":"small","description":"กรงเล็กชั้น 1"}
        expect: success:true

IPD-W2  POST /api/ipd/admissions
        body: {"store_id":"<VET_ID>","pet_name":"บัตเตอร์","owner_name":"คุณสมหมาย","cage_id":"<id จาก IPD-W1>","diagnosis":"Parvovirus","treatment_plan":"IV fluids + antibiotics"}
        expect: success:true, id คืนมา

IPD-W3  POST /api/ipd/vitals
        body: {"admission_id":"<id จาก IPD-W2>","weight":4.8,"temperature":39.2,"heart_rate":110,"note":"อาการดีขึ้นเล็กน้อย"}
        expect: success:true

IPD-W4  POST /api/ipd/treatments
        body: {"admission_id":"<id จาก IPD-W2>","treatment":"IV Normal Saline 500ml","scheduled_at":"<วันนี้ ISO string>"}
        expect: success:true

IPD-W5  PATCH /api/ipd/admissions/<id จาก IPD-W2>/discharge
        body: {"discharge_note":"อาการดีขึ้น ให้กลับบ้านได้"}
        expect: success:true, discharged_at ถูก set
```

---

#### MODULE: Grooming
```
G-W1  POST /api/grooming
      body: {"store_id":"<GROOMING_ID>","pet_name":"ฟูฟู","owner_name":"คุณสมใจ","service":"full_grooming","price":800}
      expect: success:true, id คืนมา

G-W2  PATCH /api/grooming/<id จาก G-W1>/start
      expect: success:true, started_at ถูก set

G-W3  PATCH /api/grooming/<id จาก G-W1>/complete
      expect: success:true, completed_at ถูก set

G-W4  PATCH /api/grooming/<id จาก G-W1>
      body: {"price":900,"note":"เพิ่มสปา"}
      expect: success:true
```

---

#### MODULE: Hotel
```
H-W1  POST /api/hotel/rooms
      body: {"store_id":"<HOTEL_ID>","room_number":"101","room_type":"standard","price_per_night":500}
      expect: success:true

H-W2  POST /api/hotel/checkin
      body: {"store_id":"<HOTEL_ID>","room_id":"<id จาก H-W1>","pet_name":"ดาวเรือง","owner_name":"คุณสมศักดิ์","checkin_date":"<วันนี้>","checkout_date":"<3 วันหลังจากนี้>"}
      expect: success:true, id คืนมา

H-W3  POST /api/hotel/checkout/<id จาก H-W2>
      expect: success:true, checked_out_at ถูก set, total_amount คำนวณถูก

H-W4  PATCH /api/hotel/rooms/<id จาก H-W1>
      body: {"price_per_night":600,"description":"ห้องปรับปรุงใหม่"}
      expect: success:true
```

---

#### MODULE: Pets & Owners
```
P-W1  POST /api/pets/owners
      body: {"store_id":"<VET_ID>","name":"คุณวิไล","phone":"081-xxx-xxxx","email":"wilai@example.com"}
      expect: success:true, id คืนมา

P-W2  POST /api/pets
      body: {"store_id":"<VET_ID>","owner_id":"<id จาก P-W1>","name":"แมวน้อย","species":"cat","breed":"Persian","age":3,"weight":4.5}
      expect: success:true, id คืนมา

P-W3  POST /api/pets/vaccinations
      body: {"pet_id":"<id จาก P-W2>","store_id":"<VET_ID>","vaccine_name":"Rabies","given_date":"<วันนี้>","next_due_date":"<1 ปีหลังจากนี้>"}
      expect: success:true

P-W4  PATCH /api/pets/<id จาก P-W2>
      body: {"weight":4.8,"note":"น้ำหนักเพิ่มขึ้น"}
      expect: success:true
```

---

#### MODULE: POS
```
POS-W1  POST /api/pos/checkout
        body: {
          "store_id":"<VET_ID>",
          "items":[
            {"product_id":"<id จาก I-W1>","qty":2,"price":6},
            {"service_name":"ค่าตรวจ","qty":1,"price":500}
          ],
          "payment_method":"cash",
          "total":512
        }
        expect: success:true, transaction_id คืนมา
```

---

#### MODULE: Tasks (Kanban)
```
T-W1  POST /api/tasks
      body: {"store_id":"<VET_ID>","title":"นัดติดตามอาการ ทองหล่อ","assigned_to":"<staff_id>","due_date":"<3 วันหลังจากนี้>"}
      expect: success:true, id คืนมา

T-W2  PATCH /api/tasks/<id จาก T-W1>
      body: {"status":"in_progress"}
      expect: success:true
```

---

#### MODULE: Service Items
```
SV-W1  POST /api/service-items
       body: {"store_id":"<VET_ID>","name":"ค่าตรวจเลือด CBC","price":800,"category":"lab"}
       expect: success:true

SV-W2  PATCH /api/service-items/<id จาก SV-W1>
       body: {"price":900}
       expect: success:true
```

---

#### MODULE: SOAP Templates
```
ST-W1  POST /api/soap-templates
       body: {"store_id":"<VET_ID>","name":"Gastritis template","subjective":"เจ้าของแจ้งอาเจียน","objective":"ท้องป่อง","assessment":"Gastritis","plan":"ให้ยาลดกรด"}
       expect: success:true

ST-W2  PATCH /api/soap-templates/<id จาก ST-W1>
       body: {"name":"Gastritis template v2"}
       expect: success:true
```

---

#### MODULE: Stores
```
STR-W1  PATCH /api/stores/<VET_ID>
         body: {"description":"คลินิกสัตวแพทย์ทดสอบ","phone":"02-xxx-xxxx"}
         expect: success:true
```

---

#### MODULE: Staff & Roles
```
ROLE-W1  POST /api/roles
          body: {"store_id":"<VET_ID>","name":"vet","permissions":["read","write"]}
          expect: success:true

STF-W1   POST /api/staff
          body: {"store_id":"<VET_ID>","name":"สมชาย ใจดี","email":"somchai@fufu.app","role":"vet"}
          expect: success:true
```

---

### STEP 2 — สรุปผลในรูปแบบนี้

```
## Upload Error Report — <วันที่>

### สรุปภาพรวม
| Module | POST | PATCH | สถานะ |
|--------|------|-------|-------|
| Queue | ✅/❌ | ✅/❌ | OK / มี error |
| Medical Records | ✅/❌ | ✅/❌ | ... |
| Documents | ✅/❌ | ✅/❌ | ... |
| Finance | ✅/❌ | - | ... |
| Expenses | ✅/❌ | ✅/❌ | ... |
| Inventory | ✅/❌ | ✅/❌ | ... |
| IPD | ✅/❌ | ✅/❌ | ... |
| Grooming | ✅/❌ | ✅/❌ | ... |
| Hotel | ✅/❌ | ✅/❌ | ... |
| Pets & Owners | ✅/❌ | ✅/❌ | ... |
| POS | ✅/❌ | - | ... |
| Tasks | ✅/❌ | ✅/❌ | ... |
| Service Items | ✅/❌ | ✅/❌ | ... |
| SOAP Templates | ✅/❌ | ✅/❌ | ... |
| Staff & Roles | ✅/❌ | - | ... |

### Bugs / Upload Errors พบ
สำหรับแต่ละ error ให้ระบุ:
- Test ID: <เช่น M-W1>
- Endpoint: POST /api/medical-records
- HTTP Status: <เช่น 500>
- Error Message: <ข้อความที่ server ตอบมา>
- สาเหตุที่น่าจะเป็น: <เช่น "column ไม่มีใน DB", "RLS block", "missing required field">
- วิธีแก้เบื้องต้น: <เช่น "ต้อง ALTER TABLE เพิ่ม column xxx">
```

---

### STEP 3 — ถ้าพบ error ให้ตรวจสอบเพิ่มเติม

สำหรับแต่ละ ❌ ที่พบ ให้ทำ:
1. ดู error message จาก Supabase ว่าเป็น column missing / RLS / constraint violation / ฯลฯ
2. ตรวจสอบ route file ใน `server/routes/<module>.js` บรรทัดที่เกี่ยวข้อง
3. ถ้าเป็น DB schema error → ตรวจดู migration ใน `scripts/migrate.js`
4. ระบุว่าต้อง fix อะไร (ALTER TABLE / แก้ route / แก้ RLS policy)

---

## หมายเหตุ
- ใช้ test credentials: multi@fufu.app / 123456789
- Staff role ที่ใช้ test เป็น owner (มีสิทธิ์ครบ) — ถ้า endpoint ไหน fail ด้วย 403 ให้ตรวจ requireRole()
- บางบรรทัดใช้ <id จาก step ก่อน> ให้นำค่าจริงมาแทน
```
