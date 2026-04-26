# FUFU Partner — Project Overview for Sub-Agents

## What This Project Is
Pet business management platform (Partner Portal) for Thai vet clinics, pet hotels, grooming salons, and pet shops. Partners log in and manage their daily operations: queue, OPD/IPD records, inventory, finance, and documents.

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES Modules), HTML5, CSS variables |
| Backend | Node.js + Express.js (`api.js`) |
| Database | Supabase (PostgreSQL + Auth) |
| Styling | Custom CSS variables — Primary `#0D9488` (teal), Accent `#D4AF37` (gold) |
| Fonts | Prompt (UI), Sarabun (Thai text labels) |

## File Structure
```
FUFU_partner/
├── api.js                    ← Express backend (all REST endpoints)
├── dashboard.html            ← Single shell page (SPA)
├── js/
│   ├── app.js                ← Entry: detects page, lazy-imports modules
│   ├── auth.js               ← Login / logout / store selection / auth guard
│   ├── register.js
│   ├── partner/
│   │   ├── dashboard.js      ← Orchestrator: nav, page switching, RBAC
│   │   ├── queue.js          ← Queue management
│   │   ├── medical.js        ← Medical records list
│   │   ├── opd-card.js       ← OPD card + SOAP + body map
│   │   ├── ipd.js            ← IPD ward + cage map
│   │   ├── inventory.js      ← Stock, FEFO, suppliers
│   │   ├── finance.js        ← Income stats + POS
│   │   ├── invoice.js        ← Invoice/receipt template
│   │   ├── hotel.js          ← Room grid + check-in/out
│   │   ├── grooming.js       ← Grooming queue + add-ons
│   │   ├── documents.js      ← Document center (consent, lab, referral)
│   │   ├── kanban.js         ← Task board
│   │   ├── audit.js          ← Immutable audit trail
│   │   ├── data-masking.js   ← Phone/name masking (3 levels)
│   │   ├── rbac.js           ← Role permissions matrix
│   │   └── settings.js       ← Store settings
│   ├── utils/
│   │   ├── config.js         ← API_BASE, STORAGE_KEYS, FEATURE_FLAGS
│   │   ├── supabase-client.js← fetchFromSupabase, apiRequest, insert/update/delete
│   │   ├── formatters.js     ← formatBaht, formatThaiDate, formatThaiDateShort
│   │   ├── notifications.js  ← showToast(message, type)
│   │   ├── validators.js
│   │   └── error-boundary.js
│   └── landing/              ← Public landing page (not relevant to partner portal)
├── css/
│   ├── base.css              ← CSS variables + resets (DO NOT MODIFY colors here)
│   ├── dashboard.css         ← Sidebar, topbar, layout
│   ├── components.css        ← Card, badge, table, modal, toast, field-group
│   └── partner-modules.css   ← Module-specific styles (queue cards, SOAP, etc.)
└── agents/                   ← Sub-agent context files (this directory)
```

## Core Architecture Pattern

### Page Flow
```
app.js → detects URL path → imports relevant modules → boots
dashboard.html → dashboard.js (init) → renders sidebar nav based on role → handles page switching
```

### API Pattern
All API calls go through Express (`api.js`), which proxies to Supabase:
```js
// Preferred: via Express backend
import { apiRequest } from '../utils/supabase-client.js';
const data = await apiRequest('/api/queue?store_id=xxx');

// Direct Supabase (fallback only)
import { fetchFromSupabase } from '../utils/supabase-client.js';
const data = await fetchFromSupabase('table_name', { store_id: 'xxx' });
```

Auth token is always passed as `Authorization: Bearer <token>` header — `apiRequest` handles this automatically from `localStorage`.

### Auth State (localStorage keys)
```js
// From STORAGE_KEYS in js/utils/config.js
'fufu_token'           // JWT from Supabase Auth
'fufu_role'            // 'vet' | 'shop' | 'hotel' | 'grooming' | 'admin'
'fufu_user'            // JSON { email, id }
'selected_store_id'    // UUID of currently active store
'selected_store_category' // 'vet_clinic' | 'pet_shop' | 'pet_hotel' | 'pet_grooming'
'fufu_supa_url'        // Supabase project URL
'fufu_supa_key'        // Supabase anon key
'fufu_staff_id'        // Staff member ID (for audit logs)
'fufu_staff_role'      // 'owner' | 'vet' | 'reception' | 'staff' | 'accountant'
'fufu_masking_level'   // '1' | '2' | '3' for data masking
```

### Feature Flags (js/utils/config.js)
Toggle experimental features without deploy:
```js
FEATURE_FLAGS.ENABLE_MEDICAL_MODULE   // true
FEATURE_FLAGS.ENABLE_HOTEL_MODULE     // true
FEATURE_FLAGS.ENABLE_OPD_CARD         // true
FEATURE_FLAGS.ENABLE_IPD_WARD         // true
FEATURE_FLAGS.ENABLE_INVENTORY_ALERTS // true
FEATURE_FLAGS.ENABLE_PROMPTPAY        // false (not live yet)
FEATURE_FLAGS.ENABLE_POS              // true (flag on, no full UI yet)
FEATURE_FLAGS.ENABLE_CRM              // true (flag on, no module yet)
```

### RBAC — Partner Types vs Staff Roles
- **Partner type** (determines which nav items appear): `vet`, `shop`, `hotel`, `grooming`, `admin`
- **Staff role** (within a store, determines permissions): `owner`, `vet`, `reception`, `staff`, `accountant`

### Audit Trail Pattern
All sensitive data mutations must call `logAudit()`:
```js
import { logAudit } from './audit.js';
logAudit('UPDATE', 'medical_record', recordId, oldData, newData, 'reason');
```

### Data Masking Pattern
Sensitive fields (phone, full name) must be masked based on staff role:
```js
import { maskPhone, maskName } from './data-masking.js';
maskPhone('0812345678', level); // level 1=full, 2=partial, 3=hidden
```

## Key Business Rules
1. **Commission**: FUFU charges 5% GP on all transactions (`COMMISSION_RATE = 0.05`)
2. **FEFO**: Inventory dispenses earliest-expiry batch first
3. **Queue numbering**: Auto-increments per store per day (A001, A002...)
4. **Multi-store**: One user can own multiple stores; `selected_store_id` switches context
5. **Immutable audit**: `audit_logs` table must never be deleted or updated, only inserted

## Sub-Agent Modules
Each folder in `agents/` has a `CLAUDE.md` with module-specific context:
- `auth/` — Login, logout, store selection, RBAC guard
- `queue/` — Queue management, walk-in, emergency, TV mode
- `clinic/` — OPD card, SOAP, body map, IPD ward, medical records
- `inventory/` — Stock, FEFO batches, low-stock alerts, suppliers
- `pos/` — Point of sale, invoicing, payment methods
- `finance/` — Income stats, transactions, commission, export
- `grooming/` — Grooming queue, add-ons, post-grooming report
- `hotel/` — Room map, check-in/out, availability
- `document/` — Consent forms, lab reports, referrals, PDF generation
