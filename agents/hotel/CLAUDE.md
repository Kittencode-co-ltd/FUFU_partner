# Hotel Module — Sub-Agent Context

## Purpose
Manage pet hotel room availability, check-in/out workflow, and daily care logs for Pet Hotel partners. Provides a visual room map so staff can see at a glance which rooms are occupied, available, or under maintenance.

## Files Owned
| File | Role |
|---|---|
| `js/partner/hotel.js` | Visual room map, check-in/out, care log |

## API Endpoints
### No hotel-specific endpoints exist in `api.js`

### Missing endpoints (need to add to `api.js`)
```
GET  /api/hotel/rooms?store_id=UUID                          ← room grid with current status
GET  /api/hotel/availability?store_id=UUID&from=DATE&to=DATE ← availability check (Design.MD)
POST /api/hotel/checkin                                      ← check-in a pet
POST /api/hotel/checkout/:booking_id                         ← check-out + generate bill
GET  /api/hotel/bookings?store_id=UUID&date=DATE             ← bookings for a date
POST /api/hotel/care-log                                     ← daily food/activity log entry
```

## Supabase Tables

### `hotel_rooms` (planned — does NOT exist yet)
```
id, store_id,
room_number,    -- e.g. '101', '201'
room_type,      -- 'standard' | 'deluxe' | 'suite'
status,         -- 'available' | 'occupied' | 'maintenance' | 'cleaning'
floor, notes,
price_per_night, created_at
```

### `hotel_bookings` (planned — does NOT exist yet)
```
id, store_id, room_id,
pet_name, owner_name, owner_phone,
species,                   -- 'dog' | 'cat' | 'rabbit' | 'other'
check_in_date, check_out_date,
actual_checkin_at,         -- timestamp when physically checked in
actual_checkout_at,        -- timestamp when physically checked out
nights,                    -- calculated: checkout - checkin
total_amount, status,      -- 'reserved' | 'checked_in' | 'checked_out' | 'cancelled'
deposit_amount, notes,
created_at
```

### `hotel_care_logs` (planned — does NOT exist yet)
```
id, booking_id, store_id,
log_date, log_time,
feeding_done,    -- bool
exercise_done,   -- bool
medication,      -- text or null
health_note,     -- any observations
logged_by, created_at
```

## Room Types & Prices (current mock data)
```js
standard: { label: 'Standard', price: 400, icon: '🛏' }
deluxe:   { label: 'Deluxe',   price: 650, icon: '⭐' }
suite:    { label: 'Suite',    price: 900, icon: '👑' }
```

## Room Status Colors
```js
available:   { label: 'ว่าง',          icon: '🟢', bg: 'rgba(16,185,129,0.06)'  }
occupied:    { label: 'มีผู้เข้าพัก',  icon: '🐾', bg: 'rgba(255,107,53,0.08)'  }
maintenance: { label: 'ซ่อมบำรุง',     icon: '🔧', bg: 'rgba(100,116,139,0.05)' }
cleaning:    { label: 'ทำความสะอาด',  icon: '🧹', bg: 'rgba(59,130,246,0.06)'  }
```

## Current State (mock: 22 rooms)
- ✅ Visual room grid with color-coded status cards
- ✅ Room type display (Standard / Deluxe / Suite)
- ✅ Occupied rooms show guest name, check-in/out dates
- ✅ Stat summary: ว่าง / มีผู้เข้าพัก / ซ่อมบำรุง counts
- ✅ Check-in modal UI (click room to open)
- ❌ **All data is mock** — no API connection
- ❌ Check-in form doesn't actually save to DB
- ❌ Check-out doesn't generate a bill or connect to POS
- ❌ No availability calendar view for future dates
- ❌ No daily care log entry form
- ❌ No nightly rate calculation with discount

## Check-In Flow (needs implementation)
1. Staff clicks an `available` room on the grid
2. Check-in modal opens with fields: pet name, owner name/phone, species, check-in date, check-out date, notes
3. System calculates nights and total price (nights × room_type.price)
4. On confirm: `POST /api/hotel/checkin` → room status → 'occupied'
5. Grid re-renders with room showing guest info

## Check-Out Flow (needs implementation)
1. Staff clicks an `occupied` room
2. Guest info shown with current stay duration
3. "Check Out" button generates bill (nights × price + add-ons)
4. Bill passed to POS for payment
5. On payment: `POST /api/hotel/checkout/:id` → room status → 'cleaning'

## Key Exports
```js
export async function renderRooms(role)   // Called by dashboard.js for 'rooms' page
// Only renders if role === 'hotel' AND FEATURE_FLAGS.ENABLE_HOTEL_MODULE
```

## Availability Logic (Design.MD endpoint: GET /api/hotel/availability)
For a date range (from, to):
- Query all bookings where check_in_date <= to AND check_out_date >= from
- Rooms not in that set are available
- Return: { available: count, rooms: [{ id, number, type, status }] }

## Cross-Module Dependencies
- **Queue**: hotel check-in can create an appointment/queue entry (e.g., for vet check on arrival)
- **POS**: check-out generates an invoice for the stay
- **Finance**: hotel bookings generate revenue entries
- **Audit**: check-in and check-out events must be logged — `logAudit('HOTEL_CHECKIN', 'hotel_booking', ...)`

## Conventions
- Only show for `role === 'hotel'` AND `FEATURE_FLAGS.ENABLE_HOTEL_MODULE === true`
- Room grid should be responsive: 5 columns desktop, 3 tablet, 2 mobile
- All prices per night in THB integers
- Check-out date is exclusive (like hotel convention): check-in Apr 14, check-out Apr 17 = 3 nights
- Guest info shown with data masking if `fufu_masking_level > 1`
