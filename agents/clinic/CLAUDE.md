# Clinic Agent — CLAUDE.md

## Scope
Module นี้ดูแลงาน clinical workflow ทั้งหมดของ vet clinic:
- **OPD Card** — SOAP note, vitals, prescription (FEFO-aware)
- **Medical Records** — ประวัติการรักษา list, search, tab filter
- **IPD Ward** — visual cage map, admission, treatment sheet (`ipd.js` — แยก file)

ไม่ดูแล: queue management (`queue.js`), billing/POS (`finance.js`), documents (`documents.js`)

---

## Files ที่ Agent นี้ดูแล

| File | Status | หน้าที่ |
|---|---|---|
| `js/partner/opd-card.js` | **rebuild** | OPD card UI ทั้งหมด |
| `js/partner/medical.js` | exists, อย่าแก้ | Medical records list |
| `js/partner/ipd.js` | exists, อย่าแก้ | IPD ward (แยก task) |

**อ่านแต่อย่าแก้:** `js/utils/config.js`, `js/utils/supabase-client.js`, `js/utils/formatters.js`, `js/partner/audit.js`

---

## Existing Code — อ่านแล้วก่อนเขียน

### `opd-card.js` เดิม — สิ่งที่ต้องเก็บไว้

**Save logic (ปรับปรุง)**
```js
// เดิม: insertToSupabase / updateInSupabase (direct)
// ใหม่: apiRequest('/api/medical-records', { method: 'POST'|'PATCH' })
// เหมือนที่ medical.js ใช้อยู่
```

### `opd-card.js` เดิม — สิ่งที่ต้องเปลี่ยน

| ปัญหาเดิม | แก้เป็น |
|---|---|
| `renderOPDCard(container, record)` — ต้องส่ง container เอง | `renderOPDCard(queueItem, existingRecord)` — หา container เอง (`#page-opd`) |
| Patient info ว่างเปล่า — ให้ user กรอกเอง | Pre-fill จาก `queueItem` ทันที |
| Layout 3 column (info / SOAP / rx) | Layout ใหม่: patient bar + vitals row + SOAP 2×2 + prescription card |
| SOAP เป็น plain textarea ธรรมดา | 4 box แยกสี ชัดเจน ตาม UX requirement |
| Save ต้องกดปุ่มเท่านั้น | Autosave debounce 1.5s ทุก textarea change |
| ไม่รู้ว่ามี unsaved changes | `isDirty` flag + visual indicator |

---

## API Endpoints

### มีอยู่แล้วใน `api.js`
```
GET  /api/medical-records?store_id=UUID&record_type=opd|ipd&status=...
POST /api/medical-records     ← รับ full record object, auto-sets visit_date + status
```

### ยังขาด (อย่าสร้างตอนนี้ — ใส่ TODO ไว้)
```
PATCH /api/medical-records/:id    ← สำหรับ autosave update
GET   /api/medical-records/:id    ← สำหรับ load existing record
```

---

## Database Table: `medical_records`

```
id, store_id, record_type,         -- 'opd' | 'ipd' | 'followup'
pet_name, owner_name, species,
subjective, objective, assessment, plan,   -- SOAP
vitals,            -- JSONB: { temp, weight, hr, rr }
prescriptions,     -- JSONB array: [{ drug, dose, freq, days, route, note }]
diagnosis, treatment, notes,
status,            -- 'in_progress' | 'completed'
weight_kg, temperature_c, heart_rate, respiratory_rate,  -- ยังมีอยู่ flat (legacy)
visit_date, created_at
```

---

## State ที่ต้องมีใน module

```js
let currentQueue    = null;   // queue item ที่เปิด OPD จาก (จาก fufu:openOPD event)
let currentRecord   = null;   // { id, subjective, objective, assessment, plan, ...vitals, ...}
let prescriptions   = [];     // [{ id, drug, dose, freq, days, route, note }]
let autosaveTimer   = null;
let isDirty         = false;  // มี unsaved changes
```

---

## Entry Point — Interface ที่ต้องรักษา

### Export หลัก
```js
/**
 * Called by dashboard.js เมื่อ navigate ไป page-opd
 * Triggered by: document.dispatchEvent(new CustomEvent('fufu:openOPD', { detail: queueItem }))
 * @param {Object|null} queueItem  — { id, queue_number, notes, service_type, priority }
 * @param {Object|null} existingRecord — ถ้า open จาก medical records list (edit mode)
 */
export function renderOPDCard(queueItem = null, existingRecord = null)
```

ใน `dashboard.js` เรียกแบบนี้:
```js
document.addEventListener('fufu:openOPD', (e) => {
  navigateTo('opd');
  renderOPDCard(e.detail);  // e.detail = queueItem
});
```

### Parse queue notes
Queue `notes` field เก็บแบบ `"pet_name - owner_name"`:
```js
function parseQueueNotes(notes = '') {
  const parts = notes.split(' - ');
  return {
    petName:   parts[0]?.trim() || '',
    ownerName: parts[1]?.trim() || '',
  };
}
```

---

## Layout ที่ต้องสร้าง (HTML ใน `dashboard.html`)

```
┌─────────────────────────────────────────────┐
│ [🐾 Pet Avatar] Pet Name  Species/Breed     │  ← opd-patient-bar
│ Queue #A001  Owner: คุณสมชาย               │
│                [💾 Save] [🖨]               │
├────────────┬──────────────────────────────── │
│ 🌡 38.5°C  │ ⚖ 5.2kg │ ❤ 120bpm │ 🫁 24   │  ← vitals-row (4 boxes)
├────────────┴──────────────────────────────── │
│ ┌──────────────┐  ┌──────────────────────┐  │
│ │ S Subjective │  │ O Objective          │  │  ← soap-grid (2×2)
│ │ [textarea]   │  │ [textarea]           │  │
│ └──────────────┘  └──────────────────────┘  │
│ ┌──────────────┐  ┌──────────────────────┐  │
│ │ A Assessment │  │ P Plan               │  │
│ │ [textarea]   │  │ [textarea]           │  │
│ └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────┤
│ 💊 Prescription  [+ เพิ่มยา]               │  ← prescription-card
│ ┌──────────────────────────────────────────┐│
│ │ Amoxicillin 250mg │ BID 7d PO │ [×]    ││
│ └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## SOAP Box Colors (CSS class names)

```js
// border-top color per section
soap-s → #3B82F6  (blue)   — Subjective
soap-o → #8B5CF6  (purple) — Objective
soap-a → #F97316  (orange) — Assessment
soap-p → #0D9488  (teal)   — Plan
```

Class names ใน CSS (`partner-modules.css`):
```css
.soap-box          /* wrapper */
.soap-letter-s / -o / -a / -p  /* colored letter badge */
.soap-textarea     /* the textarea */
.soap-s            /* border-top: 3px solid #3B82F6 */
```

---

## Vitals — Normal Range สำหรับ color coding

```js
const VITALS_NORMAL = {
  temp:   { min: 37.5, max: 39.2, unit: '°C' },    // สุนัข/แมวทั่วไป
  weight: { min: null, max: null, unit: 'kg' },      // ไม่มี range (ขึ้นกับสายพันธุ์)
  hr:     { min: 60,   max: 140,  unit: 'bpm' },     // สุนัข
  rr:     { min: 10,   max: 30,   unit: '/min' },
};
// ถ้าค่าเกิน range → vitals input border เป็นสีแดง
```

---

## Prescription Data Structure

```js
// แต่ละ prescription row:
{
  id:    crypto.randomUUID(),
  drug:  'Amoxicillin',       // ชื่อยา
  dose:  '250mg',             // ขนาดยา
  freq:  'BID',               // 'SID'|'BID'|'TID'|'QID'|'PRN'
  days:  7,                   // จำนวนวัน
  route: 'PO',                // 'PO'|'SC'|'IM'|'IV'|'TOP'
  note:  'กินหลังอาหาร',      // หมายเหตุ
  // FEFO fields (optional — ถ้า inventory module ส่งมา)
  product_id: null,
  batch_id:   null,
  lot_number: null,
}
```

Frequency labels:
```js
const FREQ_LABELS = {
  SID: 'วันละ 1 ครั้ง', BID: 'วันละ 2 ครั้ง',
  TID: 'วันละ 3 ครั้ง', QID: 'วันละ 4 ครั้ง',
  PRN: 'เมื่อจำเป็น',
};
```

---

## Autosave Pattern

```js
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const autosave = debounce(saveRecord, 1500);

// attach ทุก SOAP textarea:
document.querySelectorAll('.soap-textarea').forEach(ta => {
  ta.addEventListener('input', () => {
    isDirty = true;
    updateDirtyIndicator();
    autosave();
  });
});
```

Dirty indicator: topbar แสดง "● กำลังบันทึก..." ระหว่าง save, "✓ บันทึกแล้ว" เมื่อเสร็จ

---

## Save Record — API Call

```js
async function saveRecord() {
  const storeId = localStorage.getItem(STORAGE_KEYS.STORE_ID);
  const data = {
    store_id:    storeId,
    record_type: 'opd',
    status:      'in_progress',
    // patient (จาก currentQueue หรือ currentRecord)
    pet_name:    currentRecord.pet_name,
    owner_name:  currentRecord.owner_name,
    species:     currentRecord.species || 'dog',
    // SOAP
    subjective:  document.getElementById('soap-s')?.value || '',
    objective:   document.getElementById('soap-o')?.value || '',
    assessment:  document.getElementById('soap-a')?.value || '',
    plan:        document.getElementById('soap-p')?.value || '',
    // Vitals (flat columns + JSONB)
    weight_kg:       parseFloat(document.getElementById('v-weight')?.value) || null,
    temperature_c:   parseFloat(document.getElementById('v-temp')?.value)   || null,
    heart_rate:      parseInt(document.getElementById('v-hr')?.value)        || null,
    respiratory_rate:parseInt(document.getElementById('v-rr')?.value)        || null,
    vitals: {
      temp:   document.getElementById('v-temp')?.value   || null,
      weight: document.getElementById('v-weight')?.value || null,
      hr:     document.getElementById('v-hr')?.value     || null,
      rr:     document.getElementById('v-rr')?.value     || null,
    },
    prescriptions: prescriptions,
  };

  logAudit('UPDATE', 'medical_record', currentRecord?.id || null, null, data, 'autosave OPD');

  if (currentRecord?.id) {
    // TODO: PATCH /api/medical-records/:id — endpoint ยังไม่มี
    // await apiRequest(`/api/medical-records/${currentRecord.id}`, { method: 'PATCH', body: JSON.stringify(data) });
    const result = await apiRequest('/api/medical-records', { method: 'POST', body: JSON.stringify(data) });
    if (result?.success && result.data?.id) currentRecord.id = result.data.id;
  } else {
    const result = await apiRequest('/api/medical-records', { method: 'POST', body: JSON.stringify(data) });
    if (result?.success && result.data?.id) currentRecord.id = result.data.id;
  }

  isDirty = false;
  updateDirtyIndicator();
}
```

---

## Audit Requirements

ทุก operation ต้อง log:
```js
import { logAudit } from './audit.js';

// เปิด OPD card
logAudit('VIEW', 'medical_record', recordId, null, null, `เปิด OPD card จากคิว #${queueItem?.queue_number}`);

// บันทึก
logAudit('UPDATE', 'medical_record', recordId, oldData, newData, 'autosave OPD');

// unmask patient data
logAudit('UNMASK', 'owner_info', ownerId, null, null, 'ดูข้อมูลเจ้าของสัตว์เลี้ยง');
```

---

## Interface กับ Module อื่น

### ← Queue (`queue.js`)
```js
// queue.js fires event เมื่อกด "📋 OPD" บน queue card:
document.dispatchEvent(new CustomEvent('fufu:openOPD', {
  detail: {
    id: 'queue-uuid',
    queue_number: 1,      // → แสดง #A001
    notes: 'บัดดี้ - คุณสมชาย',  // → parseQueueNotes() → { petName, ownerName }
    service_type: 'ตรวจทั่วไป',
    priority: 'normal',
  }
}));
```

### → Inventory (`inventory.js`)
เมื่อสั่งยา prescription ควร query stock:
```js
// TODO (ทำหลัง inventory module พร้อม):
// import { dispenseForPrescription } from './inventory.js';
// เมื่อ save record → dispense ยาทุกตัวใน prescriptions[] ออกจาก stock (FEFO)
```
ตอนนี้: ใส่ `// TODO: FEFO dispense` comment ไว้ใน saveRecord()

### → Documents (`documents.js`)
```js
// หลัง save สำเร็จ — ปุ่ม "สร้างใบสั่งยา" เรียก:
// import { renderDocumentCenter } from './documents.js';
// TODO: generate prescription document จาก prescriptions[]
```

---

## Conventions

- Element IDs ที่ต้องตรงกับ `dashboard.html`:
  - `#page-opd` — container ของ OPD page section
  - `#opd-pet-name`, `#opd-owner`, `#opd-queue-badge`, `#opd-pet-avatar`
  - `#v-temp`, `#v-weight`, `#v-hr`, `#v-rr`
  - `#soap-s`, `#soap-o`, `#soap-a`, `#soap-p`
  - `#rx-list`, `#add-rx-btn`, `#opd-save-btn`, `#opd-print-btn`
- Import formatters จาก `../utils/formatters.js` เสมอ
- showToast จาก `../utils/notifications.js`
- `apiRequest` จาก `../utils/supabase-client.js` (ไม่ใช้ insertToSupabase โดยตรง)
- species emoji: dog→🐕, cat→🐈, rabbit→🐰, bird→🐦, other→🐾
