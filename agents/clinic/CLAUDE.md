# Clinic Module — Sub-Agent Context

## Purpose
Full clinical workflow for vet clinics: OPD consultations (SOAP notes, body map, vitals, prescriptions), IPD ward management (cage map, treatment sheets), and medical record history. Only visible to `role === 'vet'`.

## Files Owned
| File | Role |
|---|---|
| `js/partner/opd-card.js` | OPD card: SOAP, vitals, body map, prescription |
| `js/partner/ipd.js` | IPD ward: visual cage map, admissions, treatment sheet |
| `js/partner/medical.js` | Medical records list with OPD/IPD tab filter |

## API Endpoints

### GET /api/medical-records (exists in `api.js`)
```
?store_id=UUID&record_type=opd|ipd&status=completed|in_progress
Returns: array of medical_records, ordered by created_at DESC, limit 50
```

### POST /api/medical-records (exists in `api.js`)
```js
{
  store_id, visit_date, record_type,  // 'opd' or 'ipd'
  pet_name, owner_name, species,
  subjective, objective, assessment, plan,  // SOAP fields
  vitals: { temp, weight, hr, rr },
  prescriptions: [],
  status  // 'completed' | 'in_progress'
}
```

### Missing API endpoints (need to add to `api.js`):
- `GET /api/medical-records/:id` — get single record
- `PATCH /api/medical-records/:id` — update (for autosave)
- `GET /api/clinic/opd/save` — mentioned in Design.MD, not implemented

## Supabase Table: `medical_records`
```
id, store_id, record_type (opd|ipd), status,
pet_name, owner_name, species,
subjective, objective, assessment, plan,
vitals (JSONB), prescriptions (JSONB array),
body_map_markers (JSONB array),
visit_date, created_at, updated_at
```

## OPD Card (`opd-card.js`)

### Current State
- ✅ SOAP note fields (S, O, A, P) exist but lack visual clarity
- ✅ Interactive body map (SVG) for dog and cat
- ✅ Vitals fields (temp, weight, HR, RR)
- ✅ Prescription list with drug/dose/frequency
- ✅ Audit log on unmask events
- ❌ **SOAP boxes not visually distinct** — all look like plain textareas
- ❌ **No pre-fill from queue item** — must re-enter pet name/owner
- ❌ **No autosave** — data lost if page is left
- ❌ Body map markers not saved to DB
- ❌ FEFO-linked drug selection (shows stock availability)
- ❌ Body map for species other than dog/cat

### Key Exports
```js
export function renderOPDCard(queueItem)  // Called by dashboard.js when OPD page is opened
// queueItem structure:
// { id, queue_number, notes: "pet_name - owner_name", service_type, priority }
```

### OPD Card UX Requirements
**Patient Bar** (top of page — pre-filled from queue):
- Pet avatar emoji by species
- Pet name (large, bold)
- Species + breed + age (from queue or input)
- Owner name with 👤 icon
- Queue number badge (e.g. #A001)
- Buttons: [Body Map] [💾 บันทึก] [🖨 Print]

**Vitals Row** (4 boxes in a row):
- อุณหภูมิ (°C) — normal dog: 37.5–39.2
- น้ำหนัก (kg)
- HR (bpm) — normal dog: 60–140
- RR (breath/min) — normal dog: 10–30

**SOAP Grid** (2×2, color-coded top border):
- S (blue #3B82F6): Subjective — อาการที่เจ้าของแจ้ง
- O (purple #8B5CF6): Objective — ผลการตรวจร่างกาย
- A (orange #F97316): Assessment — การวินิจฉัย / DD
- P (teal #0D9488): Plan — แผนการรักษา + นัดติดตาม

**Prescription Section** (below SOAP):
- Table of prescribed drugs
- Add via modal: drug name, dose, frequency (SID/BID/TID/QID/PRN), days, route (PO/SC/IM/IV/TOP), note
- Remove individual lines

### Autosave Pattern
```js
const autosave = debounce(saveSOAP, 1500);  // debounce 1.5s
// Attach to all textarea input events
// Save to PATCH /api/medical-records/:id
```

## IPD Ward (`ipd.js`)

### Current State
- ✅ Visual cage map with color-coded status (available/occupied/maintenance/reserved)
- ✅ Admission data structure
- ✅ Treatment sheet (hourly log)
- ✅ Audit log on cage assignment
- ❌ No real API connection (all mock data)
- ❌ QR Cage Scanning — Design.MD requires scanning QR before drug admin to prevent errors
- ❌ No API endpoint for IPD data

### Cage Types
```js
standard: '🏠'
large: '🏡'
icu: '🏥'     // Requires elevated monitoring
isolation: '⚠️'  // Infectious disease cases
```

### Key Exports
```js
export function renderIPDWard(container)  // Renders full IPD page
```

## Medical Records List (`medical.js`)

### Current State
- ✅ Fetches from real API (`/api/medical-records`)
- ✅ OPD/IPD tab filter
- ✅ Vaccination tracker (next-due calculation)
- ✅ DLD export placeholder (กรมปศุสัตว์ format)
- ❌ Search/filter by pet name or owner
- ❌ Link from record row to OPD card for editing

### Key Exports
```js
export async function renderMedicalRecords()  // Called by dashboard.js for 'records' page
```

## Cross-Module Dependencies
- **Queue → OPD**: queue card "📋 OPD" fires `fufu:openOPD` event → `renderOPDCard(queueItem)`
- **OPD → Inventory**: prescription should check stock via inventory module (FEFO)
- **OPD → Document**: saving a record should optionally generate a prescription document
- **OPD → Audit**: all record saves must call `logAudit('CREATE'|'UPDATE', 'medical_record', ...)`
- **OPD → Data Masking**: owner phone shown with masking based on `fufu_masking_level`

## Body Map SVG Regions (existing in opd-card.js)
Dog: head, ear_l, ear_r, neck, chest, abdomen, back, tail, leg_fl, leg_fr, leg_rl, leg_rr
Cat: head, ear_l, ear_r, neck, body, tail, leg_fl, leg_fr, leg_rl, leg_rr

Click handler adds a marker `{ region, label, note }` to `bodyMapMarkers` array.
Markers rendered as colored dots on SVG + listed below as text.

## Conventions
- Always gate module init with `if (!FEATURE_FLAGS.ENABLE_MEDICAL_MODULE) return`
- Always call `logAudit` before any write operation on medical records
- species emoji mapping: dog → 🐕, cat → 🐈, rabbit → 🐰, bird → 🐦, other → 🐾
- Vitals stored as JSONB: `{ temp: 38.5, weight: 5.2, hr: 120, rr: 24 }`
- Prescriptions stored as JSONB array: `[{ drug, dose, freq, days, route, note }]`
