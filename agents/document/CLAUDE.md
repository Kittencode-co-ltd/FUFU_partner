# Document Module — Sub-Agent Context

## Purpose
Manage all formal documents: consent forms, lab reports, referral letters, prescriptions, receipts, and health certificates. Supports e-signature workflow, PDF generation, and document status tracking. Used primarily by vet clinics but receipts/invoices apply to all partner types.

## Files Owned
| File | Role |
|---|---|
| `js/partner/documents.js` | Document center UI: list, create, sign, PDF |

## API Endpoints
### No document-specific endpoints exist in `api.js`

### Missing endpoints (need to add to `api.js`)
```
GET  /api/documents?store_id=UUID&ref_id=UUID&doc_type=consent   ← list documents
POST /api/documents                                               ← create/save document
PATCH /api/documents/:id/sign                                     ← e-sign a document
POST /api/documents/generate-pdf                                  ← Design.MD endpoint, not built
GET  /api/documents/:id                                           ← fetch single document
```

## Supabase Table: `documents` (planned — does NOT exist yet)
Uses polymorphic association pattern (one table for all doc types):
```
id, store_id,
doc_type,      -- 'consent' | 'lab_report' | 'referral' | 'prescription' | 'receipt' | 'certificate'
ref_type,      -- 'medical_record' | 'queue_entry' | 'hotel_booking' | 'transaction'
ref_id,        -- UUID of the referenced entity
title,         -- e.g. 'ยินยอมผ่าตัดทำหมัน — บัดดี้'
content,       -- JSONB: template-specific fields
status,        -- 'draft' | 'signed' | 'finalized' | 'voided'
signed_by,     -- staff name
signed_at,     -- timestamp
pdf_url,       -- Storage URL after PDF generation
created_by, created_at
```

## Document Types and Templates
```js
consent:      { icon: '📋', title: 'หนังสือยินยอม', color: '#0D9488' }
lab_report:   { icon: '🔬', title: 'ผล Lab',         color: '#8B5CF6' }
referral:     { icon: '📤', title: 'ใบส่งตัว',        color: '#F97316' }
prescription: { icon: '💊', title: 'ใบสั่งยา',        color: '#10B981' }
receipt:      { icon: '🧾', title: 'ใบเสร็จ',         color: '#3B82F6' }
certificate:  { icon: '📜', title: 'ใบรับรอง',        color: '#EAB308' }
```

## Document Status Flow
```
draft → signed → finalized
              → voided (cancelled after signing)
draft → voided
```

## Current State
- ✅ Document list UI with status badges (draft / signed / finalized / voided)
- ✅ Document type icons and color coding
- ✅ "สร้างเอกสาร" button with template selector
- ✅ E-signature placeholder UI (click to "sign")
- ✅ Audit log on signature event
- ❌ **All data is mock** — no API connection
- ❌ PDF generation not implemented (Design.MD: `POST /api/documents/generate-pdf`)
- ❌ Document content templates not built (consent text, referral letter format, etc.)
- ❌ Digital signature cryptographic verification (currently just a name + timestamp)
- ❌ No link from OPD/prescription → auto-generate prescription document
- ❌ File storage (PDFs not saved to Supabase Storage)

## Key Exports
```js
export function renderDocumentCenter(container)  // Called by dashboard.js for 'documents' page
```

## E-Signature Workflow (current implementation)
1. Staff clicks "เซ็นชื่อ" on a draft document
2. Prompt for staff name (or use `getCurrentUser().email`)
3. Record: `signed_by`, `signed_at = new Date().toISOString()`
4. Status changes: `draft` → `signed`
5. `logAudit('SIGN', 'document', docId, null, { signed_by, signed_at }, 'document signature')`

True digital signatures (PKI certificates) are out of scope for now.

## PDF Generation (needs implementation)
Option A (server-side, recommended for production):
- `POST /api/documents/generate-pdf` with document content
- Server uses `puppeteer` or `pdfkit` to render HTML → PDF
- Upload to Supabase Storage, return public URL
- Store URL in `documents.pdf_url`

Option B (client-side, simpler):
- Use browser's `window.print()` with print-specific CSS
- Or use `jsPDF` library for client-side generation

Currently only `window.print()` placeholder exists via `invoice.js`.

## Template Content Fields

### Consent Form (`consent`)
```js
{
  petName, ownerName, procedure,
  risks: [],           // bulleted risk list
  ownerSignature: '',
  vetSignature: '',
  date: ''
}
```

### Lab Report (`lab_report`)
```js
{
  petName, ownerName, species,
  labTests: [{ name, result, unit, reference, status: 'normal'|'abnormal' }],
  interpretation: '',
  vetName: ''
}
```

### Referral Letter (`referral`)
```js
{
  petName, ownerName,
  referredTo: '',      // receiving clinic name
  reason: '',
  history: '',         // brief medical history
  currentMedications: [],
  urgency: 'routine'|'urgent'|'emergency',
  vetName: ''
}
```

## Cross-Module Dependencies
- **Clinic/OPD**: prescription from OPD → auto-generate `prescription` document
- **Clinic/OPD**: consent required before surgery → status check before IPD admission
- **POS**: receipt document auto-generated after payment
- **Audit**: every document signature must call `logAudit('SIGN', 'document', ...)`
- **Data Masking**: owner phone/ID in documents masked based on `fufu_masking_level`

## Conventions
- Polymorphic association: always store `ref_type` + `ref_id` to link document to its source entity
- Voided documents are never deleted — only status set to 'voided' with void reason
- All document mutations logged to audit trail
- PDFs stored in Supabase Storage bucket `documents/` under path `{store_id}/{doc_id}.pdf`
- `finalized` status = signed + PDF generated — cannot be edited
