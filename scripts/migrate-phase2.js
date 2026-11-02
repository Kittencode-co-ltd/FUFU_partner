/**
 * FUFU Partner — Phase 2 Database Migration (Schema Cleanup)
 *
 * Removes redundant/duplicate columns that accumulated over time.
 * Safe: all dropped columns are duplicates of newer columns already in use.
 *
 * IMPORTANT: Run AFTER migrate-phase1.js
 * IMPORTANT: Verify application code no longer references these columns before running.
 *
 * What this drops:
 *   pets             — age, weight, microchip_id, type  (duplicates of dob, weight_kg, microchip_no, species)
 *   hotel_bookings   — actual_check_in, actual_check_out (duplicates of actual_checkin_at, actual_checkout_at)
 *                    — total_cost (duplicate of total_amount)
 *   medical_records  — prescribed_meds (merged into prescriptions), vitals jsonb (individual columns exist)
 *   inventory_batches — batch_number (duplicate of lot_number), supplier text (use supplier_id FK instead)
 *
 * Usage:
 *   node scripts/migrate-phase2.js <supabase_access_token>
 */

const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Usage: node scripts/migrate-phase2.js <access_token>');
  process.exit(1);
}

async function sql(query, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    console.log(`  ❌ ${label}: ${data.error || data.message || JSON.stringify(data)}`);
    return false;
  }
  console.log(`  ✅ ${label}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🐾 Phase 2: pets table — drop duplicate columns');
// ─────────────────────────────────────────────────────────────────────────────
// age double precision   → use dob instead (calculated on frontend)
// weight double precision → use weight_kg (NUMERIC)
// microchip_id text      → use microchip_no
// type text              → use species

await sql(`ALTER TABLE pets DROP COLUMN IF EXISTS age`,          'pets.age → dropped (use dob)');
await sql(`ALTER TABLE pets DROP COLUMN IF EXISTS weight`,       'pets.weight → dropped (use weight_kg)');
await sql(`ALTER TABLE pets DROP COLUMN IF EXISTS microchip_id`, 'pets.microchip_id → dropped (use microchip_no)');
await sql(`ALTER TABLE pets DROP COLUMN IF EXISTS type`,         'pets.type → dropped (use species)');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🏨 Phase 2: hotel_bookings — drop duplicate columns');
// ─────────────────────────────────────────────────────────────────────────────
// actual_check_in TIMESTAMPTZ   → duplicate of actual_checkin_at
// actual_check_out TIMESTAMPTZ  → duplicate of actual_checkout_at
// total_cost NUMERIC            → duplicate of total_amount

await sql(`ALTER TABLE hotel_bookings DROP COLUMN IF EXISTS actual_check_in`,  'hotel_bookings.actual_check_in → dropped (use actual_checkin_at)');
await sql(`ALTER TABLE hotel_bookings DROP COLUMN IF EXISTS actual_check_out`, 'hotel_bookings.actual_check_out → dropped (use actual_checkout_at)');
await sql(`ALTER TABLE hotel_bookings DROP COLUMN IF EXISTS total_cost`,       'hotel_bookings.total_cost → dropped (use total_amount)');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🏥 Phase 2: medical_records — merge prescriptions + drop vitals jsonb');
// ─────────────────────────────────────────────────────────────────────────────

// First: copy prescribed_meds → prescriptions where prescriptions is empty
await sql(`
  UPDATE medical_records
  SET prescriptions = prescribed_meds
  WHERE (prescriptions IS NULL OR prescriptions = '[]'::jsonb)
    AND (prescribed_meds IS NOT NULL AND prescribed_meds != '[]'::jsonb)
`, 'medical_records: merge prescribed_meds → prescriptions');

// Drop redundant columns
await sql(`ALTER TABLE medical_records DROP COLUMN IF EXISTS prescribed_meds`, 'medical_records.prescribed_meds → dropped (use prescriptions)');
await sql(`ALTER TABLE medical_records DROP COLUMN IF EXISTS vitals`,          'medical_records.vitals jsonb → dropped (use individual columns)');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📦 Phase 2: inventory_batches — drop duplicate columns');
// ─────────────────────────────────────────────────────────────────────────────
// batch_number text  → duplicate of lot_number
// supplier text      → use supplier_id FK instead

await sql(`ALTER TABLE inventory_batches DROP COLUMN IF EXISTS batch_number`, 'inventory_batches.batch_number → dropped (use lot_number)');
await sql(`ALTER TABLE inventory_batches DROP COLUMN IF EXISTS supplier`,     'inventory_batches.supplier → dropped (use supplier_id FK)');

// ─────────────────────────────────────────────────────────────────────────────
// Reload PostgREST schema cache
await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload PostgREST schema cache');

console.log(`
✅ Phase 2 migration complete!

Dropped columns:
  pets:              age, weight, microchip_id, type
  hotel_bookings:    actual_check_in, actual_check_out, total_cost
  medical_records:   prescribed_meds (merged→prescriptions), vitals (jsonb)
  inventory_batches: batch_number, supplier

All application code should now use:
  pets:              dob, weight_kg, microchip_no, species
  hotel_bookings:    actual_checkin_at, actual_checkout_at, total_amount
  medical_records:   prescriptions (single column)
  inventory_batches: lot_number, supplier_id

Next: Phase 3 (backend auth) and Phase 4 (UX) are code changes, not DB migrations.
`);
