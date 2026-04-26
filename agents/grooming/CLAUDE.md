# Grooming Module — Sub-Agent Context

## Purpose
Manage grooming appointments and in-progress sessions for Pet Grooming partners. Shows a live queue of grooming sessions with progress tracking, add-on services, and a post-grooming health report that can be sent to the clinic module.

## Files Owned
| File | Role |
|---|---|
| `js/partner/grooming.js` | All grooming UI: queue, progress, add-ons, post-report |

## API Endpoints
### No grooming-specific endpoints exist in `api.js`
Grooming uses `appointments` table via:
- `GET /api/appointments?store_id=UUID` — general appointments (shared with queue)

### Missing endpoints (need to add to `api.js`)
```
GET  /api/grooming?store_id=UUID&date=YYYY-MM-DD   ← grooming sessions for today
POST /api/grooming/start/:id                        ← start session + begin timer
POST /api/grooming/complete/:id                     ← complete + save health report
POST /api/grooming/health-report                    ← send report to clinic
```

## Supabase Tables

### `appointments` (shared with queue — exists)
```
id, store_id, pet_name, owner_name, service_type,
appt_date, status, notes, created_at
```

### `grooming_sessions` (planned — does NOT exist yet)
```
id, appointment_id, store_id,
pet_name, owner_name, species,
services,          -- JSONB array of service IDs
start_time, end_time,
status,            -- 'waiting' | 'in_progress' | 'done'
progress,          -- 0-100 integer
health_report,     -- JSONB (see below)
groomer_id,
created_at
```

### Health Report JSONB structure
```js
{
  checklist: {
    skin_condition: 'normal' | 'abnormal',    // ผิวหนัง
    coat_condition: 'normal' | 'abnormal',     // ขน
    ear_condition: 'normal' | 'abnormal',      // หู
    nail_condition: 'normal' | 'abnormal',     // เล็บ
    eye_condition: 'normal' | 'abnormal',      // ตา
    behavior: 'calm' | 'anxious' | 'aggressive'
  },
  notes: 'free text observations',
  referred_to_clinic: false,    // true if abnormality found
  referral_note: ''
}
```

## Add-On Services (current mock data)
```js
[
  { id: 'ao1', name: 'อาบน้ำ', icon: '🛁', price: 200 },
  { id: 'ao2', name: 'ตัดเล็บ', icon: '💅', price: 80 },
  { id: 'ao3', name: 'ทำความสะอาดหู', icon: '👂', price: 100 },
  { id: 'ao4', name: 'แปรงฟัน', icon: '🪥', price: 120 },
  { id: 'ao5', name: 'สปาผิว', icon: '💆', price: 350 },
  { id: 'ao6', name: 'ทำสีขน', icon: '🎨', price: 500 },
]
```

## Current State
- ✅ Grooming queue UI with progress bars (0–100%)
- ✅ In-progress session shows real-time elapsed time counter
- ✅ Add-on service selection UI
- ✅ Status badges (waiting / in-progress / done)
- ❌ **All data is mock** — no API connection
- ❌ Post-grooming health report UI not implemented
- ❌ Health report → clinic referral workflow not implemented
- ❌ Timer doesn't persist (resets on page refresh)
- ❌ No groomer assignment per session

## Post-Grooming Health Report (Design.MD feature)
Flag: `FEATURE_FLAGS.ENABLE_GROOMING_REPORT = true`

Workflow:
1. Groomer clicks "เสร็จสิ้น" on a session
2. Health checklist modal opens (skin, coat, ear, nail, eye, behavior)
3. If any item marked 'abnormal': show "ส่งต่อคลินิก" button
4. Clicking "ส่งต่อคลินิก" creates a new `queue_entry` in the clinic's queue (same partner group) or sends a notification

This cross-partner feature is not yet designed in DB schema.

## Key Exports
```js
export async function renderGrooming(role)  // Called by dashboard.js for 'grooming' page
// Only renders if role === 'grooming'
```

## Grooming Session Progress
Progress is tracked as a percentage (0–100) of the estimated session duration:
```js
// Start timer on session start
const startTime = Date.now();
const estimatedMs = estimatedMinutes * 60 * 1000;
const progress = Math.min(100, ((Date.now() - startTime) / estimatedMs) * 100);
```
Timer updates every 30 seconds via `setInterval`. Must be cleared when navigating away.

## Cross-Module Dependencies
- **Queue**: grooming sessions are a type of queue entry; share appointment data
- **POS**: on completion, auto-populate POS with session cost (services + add-ons)
- **Clinic**: health report can create a clinic referral / queue entry
- **Finance**: completed grooming sessions generate transactions
- **Audit**: session completion and health report submission must be logged

## Conventions
- Only show this module for `role === 'grooming'` partners
- Gate health report feature with `FEATURE_FLAGS.ENABLE_GROOMING_REPORT`
- Timer intervals must be stored and cleared on `page-grooming` deactivation
- Add-on prices sum into the total session cost for POS
- Progress bar color: < 50% → green, 50–80% → yellow, > 80% → orange/red
