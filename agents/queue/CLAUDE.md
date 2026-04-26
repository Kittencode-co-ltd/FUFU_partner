# Queue Module — Sub-Agent Context

## Purpose
Manage appointment queues for all partner types. Core workflow entry point: walk-in patients arrive → get added to queue → called → treated → completed. Every other module (OPD, POS, grooming timer) starts from a queue item.

## Files Owned
| File | Role |
|---|---|
| `js/partner/queue.js` | All queue UI and logic |
| `api.js` lines 172–242 | Backend: `GET/POST/PATCH /api/queue` |

## API Endpoints (all exist in `api.js`)

### GET /api/queue
```
?store_id=UUID&date=YYYY-MM-DD&status=waiting|called|in_progress|completed
```
Returns array of `queue_entries` rows ordered by `queue_number ASC`.

### POST /api/queue
```js
{ store_id, pet_name, owner_name, service_type, priority, notes, estimated_time }
// Auto-increments queue_number for today
// Defaults: status='waiting', source='walk_in', priority='normal', estimated_time=20
```

### PATCH /api/queue/:id
```js
{ status, ...other_fields }
// Auto-sets timestamps: called_at, started_at, completed_at based on status
```

## Supabase Table: `queue_entries`
```
id, store_id, queue_number, queue_date, service_type, priority,
status, notes, estimated_time, source,
called_at, started_at, completed_at, created_at
```
Note: `notes` field currently stores `"pet_name - owner_name"` as a combined string. A cleaner DB schema would separate `pet_name` and `owner_name` as columns.

## Status State Machine
```
waiting → called → in_progress → completed
                 → no_show
         → cancelled
```

## Priority Levels
```js
emergency  // 🔴 always shown at top of queue
vip        // ⭐ shown with gold badge
normal     // default
```

## Current State
- ✅ Real API endpoints exist (GET, POST, PATCH)
- ✅ Auto-increment queue_number per store per day
- ✅ Priority system (emergency, vip, normal)
- ✅ Status tracking with auto-timestamps
- ✅ TV display mode (toggleTVMode)
- ✅ Calendar view (renderCalendar) — feature flagged off
- ❌ **UI is table-based** — needs card-based redesign
- ❌ **No walk-in quick-add bar** — currently buried in a modal
- ❌ **No emergency insert shortcut** — must go through full form
- ❌ **No clear call/start/done action buttons per queue item**
- ❌ Queue items don't link directly to OPD card

## Key Exports (must keep for compatibility)
```js
export function renderQueue(queue)       // Renders mini preview on dashboard home
export function renderFullQueue(storeId) // Renders full queue page
export function renderCalendar()         // Calendar view (FEATURE_FLAG gated)
export function toggleTVMode()           // TV fullscreen display
export async function initQueue(storeId, role) // Called by dashboard.js to initialize queue page
```

## UX Requirements (needs rebuild)
The current table layout must be replaced with card-based UI:

**Walk-in Quick-Add Bar** (top of queue page):
```
[ชื่อสัตว์เลี้ยง input] [ชื่อเจ้าของ input] [บริการ select] [🚨 ด่วน toggle] [+ Walk-in button]
```
Emergency toggle changes priority of new queue item; form submits to `POST /api/queue`.

**Queue Stats Counters** (below walk-in bar):
```
รอ: N  |  กำลังรักษา: N  |  เสร็จแล้ว: N  |  ทั้งหมด: N
```

**Queue Cards** (grid layout, 2–3 per row):
Each card shows: queue number badge, pet name, owner, service type, time, priority badge.
Actions per card depend on status:
- `waiting`     → [📢 เรียก] [📋 OPD]
- `called`      → [▶ เริ่มรักษา] [❌ ไม่มา] [📋 OPD]
- `in_progress` → [✓ เสร็จ] [📋 OPD]
- `completed`   → [📋 ดู OPD] (card dimmed)

Emergency cards: red left border, pinned at top section.

**OPD Bridge**: Clicking "📋 OPD" on a queue card should:
1. Navigate to `page-opd`
2. Pre-fill OPD card with queue item data (pet name, owner, service, queue number)
3. Use custom event: `document.dispatchEvent(new CustomEvent('fufu:openOPD', { detail: queueItem }))`

## TV Mode
Full-screen display for waiting room monitor. Shows only waiting/called items with large queue numbers. Toggle via `toggleTVMode()`.

## Auto-Refresh
Queue should auto-refresh every 30 seconds when page is active to reflect real-time updates from other staff.

## Conventions
- Always include `store_id` from `localStorage.getItem(STORAGE_KEYS.STORE_ID)`
- Always include `date = new Date().toISOString().split('T')[0]` when fetching today's queue
- Fall back to mock data if API unavailable (for dev without Supabase)
- Emergency items must visually appear at top of board regardless of queue_number order
