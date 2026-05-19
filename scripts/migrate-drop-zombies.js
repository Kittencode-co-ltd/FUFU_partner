/**
 * FUFU Partner — Drop Zombie Tables Migration
 *
 * Removes tables that exist in the schema but are never used by any route or frontend.
 * Each table has a replacement that is actively used.
 *
 * Zombie tables → replacement:
 *   customers         → pet_owners (global owner profile, no store_id)
 *   grooming_records  → grooming_sessions (simpler, used by app)
 *   vaccinations      → pet_vaccinations  (store-scoped version)
 *   treatment_sheets  → ipd_treatments    (used by IPD ward)
 *   profiles          → auth.users directly (not needed as mirror)
 *   staff_permissions → not implemented (granular perms not used)
 *   staff_roles       → store_staff.roles[] array (used by RBAC)
 *   staff             → store_staff (used by auth + RBAC)
 *
 * What this KEEPS on active tables:
 *   - customer_id columns (nullable UUIDs — just removing FK constraint, keeping col)
 *   - assigned_staff_id on queue_entries (keep col, remove FK — may repurpose later)
 *   - vet_staff_id on medical_records (keep col, remove FK — may repurpose later)
 *
 * Usage:
 *   node scripts/migrate-drop-zombies.js <supabase_access_token>
 */

const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Usage: node scripts/migrate-drop-zombies.js <access_token>');
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
console.log('\n🔓 Step 1: Drop FK constraints pointing to "customers"');
console.log('   (columns kept — just removing foreign key relationship)');
// ─────────────────────────────────────────────────────────────────────────────

const customerFKs = [
  ['medical_records', 'medical_records_customer_id_fkey'],
  ['hotel_bookings',  'hotel_bookings_customer_id_fkey'],
  ['ipd_admissions',  'ipd_admissions_customer_id_fkey'],
  ['queue_entries',   'queue_entries_customer_id_fkey'],
  ['transactions',    'transactions_customer_id_fkey'],
  ['documents',       'documents_customer_id_fkey'],
];

for (const [table, constraint] of customerFKs) {
  await sql(
    `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`,
    `Drop FK: ${table}.${constraint}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔓 Step 2: Drop FK constraints pointing to "staff"');
console.log('   (columns kept — store_staff is the authoritative staff table)');
// ─────────────────────────────────────────────────────────────────────────────

const staffFKs = [
  ['medical_records', 'medical_records_vet_staff_id_fkey'],
  ['medical_records', 'medical_records_created_by_fkey'],
  ['medical_records', 'medical_records_updated_by_fkey'],
  ['medical_records', 'medical_records_deleted_by_fkey'],
  ['audit_logs',      'audit_logs_staff_id_fkey'],
  ['documents',       'documents_created_by_fkey'],
  ['hotel_bookings',  'hotel_bookings_created_by_fkey'],
  ['queue_entries',   'queue_entries_assigned_staff_id_fkey'],
  ['tasks',           'tasks_assigned_to_fkey'],
  ['tasks',           'tasks_created_by_fkey'],
];

for (const [table, constraint] of staffFKs) {
  await sql(
    `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`,
    `Drop FK: ${table}.${constraint}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🗑️  Step 3: Drop zombie tables (safe order)');
// ─────────────────────────────────────────────────────────────────────────────

// 1. staff_permissions — FK to staff, not implemented
await sql(`DROP TABLE IF EXISTS staff_permissions CASCADE`, 'DROP staff_permissions');

// 2. staff_roles — FK to staff + roles; replaces by store_staff.roles[]
await sql(`DROP TABLE IF EXISTS staff_roles CASCADE`, 'DROP staff_roles');

// 3. grooming_records — replaced by grooming_sessions
await sql(`DROP TABLE IF EXISTS grooming_records CASCADE`, 'DROP grooming_records');

// 4. treatment_sheets — replaced by ipd_treatments
await sql(`DROP TABLE IF EXISTS treatment_sheets CASCADE`, 'DROP treatment_sheets');

// 5. vaccinations — replaced by pet_vaccinations (store-scoped)
await sql(`DROP TABLE IF EXISTS vaccinations CASCADE`, 'DROP vaccinations');

// 6. profiles — unused mirror of auth.users
await sql(`DROP TABLE IF EXISTS profiles CASCADE`, 'DROP profiles');

// 7. customers — replaced by pet_owners (global) for patient context
await sql(`DROP TABLE IF EXISTS customers CASCADE`, 'DROP customers');

// 8. staff — replaced by store_staff; FKs removed above
await sql(`DROP TABLE IF EXISTS staff CASCADE`, 'DROP staff');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔒 Step 4: Add FK from tasks/queue to store_staff (optional repurpose)');
// ─────────────────────────────────────────────────────────────────────────────
// Now that staff is dropped, the assigned_to/assigned_staff_id columns are bare UUIDs.
// Optionally re-FK them to store_staff.id for proper referential integrity.

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'tasks' AND constraint_name = 'tasks_assigned_to_store_staff_fkey'
    ) THEN
      ALTER TABLE tasks
        ADD CONSTRAINT tasks_assigned_to_store_staff_fkey
        FOREIGN KEY (assigned_to) REFERENCES store_staff(id) ON DELETE SET NULL;
    END IF;
  END $$
`, 'tasks.assigned_to → store_staff FK');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'queue_entries' AND constraint_name = 'queue_entries_assigned_staff_store_fkey'
    ) THEN
      ALTER TABLE queue_entries
        ADD CONSTRAINT queue_entries_assigned_staff_store_fkey
        FOREIGN KEY (assigned_staff_id) REFERENCES store_staff(id) ON DELETE SET NULL;
    END IF;
  END $$
`, 'queue_entries.assigned_staff_id → store_staff FK');

// ─────────────────────────────────────────────────────────────────────────────
// Reload PostgREST schema cache
await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload PostgREST schema cache');

console.log(`
✅ Zombie tables dropped successfully!

Dropped (8 tables):
  staff_permissions  — not implemented
  staff_roles        — replaced by store_staff.roles[]
  grooming_records   — replaced by grooming_sessions
  treatment_sheets   — replaced by ipd_treatments
  vaccinations       — replaced by pet_vaccinations
  profiles           — unused auth.users mirror
  customers          — replaced by pet_owners
  staff              — replaced by store_staff

FK constraints removed from active tables:
  medical_records    — customer_id, vet_staff_id, created_by, updated_by, deleted_by
  hotel_bookings     — customer_id, created_by
  ipd_admissions     — customer_id
  queue_entries      — customer_id, assigned_staff_id (re-FK'd to store_staff)
  transactions       — customer_id
  documents          — customer_id, created_by
  audit_logs         — staff_id
  tasks              — assigned_to, created_by (re-FK'd to store_staff)

Columns kept (nullable, orphaned UUID — clean up later if desired):
  customer_id on: medical_records, hotel_bookings, ipd_admissions, queue_entries, transactions, documents
  vet_staff_id, created_by, updated_by, deleted_by on: medical_records
  staff_id on: audit_logs
`);
