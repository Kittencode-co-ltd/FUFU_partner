/**
 * FUFU Partner — Fix RLS policies that reference dropped "staff" table
 *
 * After dropping the `staff` table, any RLS policy that references it
 * causes ALL queries on that table to fail with:
 *   "relation public.staff does not exist"
 *
 * This script:
 *   1. Finds all RLS policies referencing `staff` (not `store_staff`)
 *   2. Drops them
 *   3. Reloads PostgREST schema cache
 *
 * Usage:
 *   node scripts/fix-rls-staff-ref.js <supabase_access_token>
 */

const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Usage: node scripts/fix-rls-staff-ref.js <access_token>');
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
    return null;
  }
  if (label) console.log(`  ✅ ${label}`);
  return data;
}

// ─── Step 1: Find all policies that reference 'staff' but NOT 'store_staff' ──

console.log('\n🔍 Step 1: Finding RLS policies that reference old "staff" table...');

const found = await sql(`
  SELECT tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual       ILIKE '%from staff%'     OR qual       ILIKE '%join staff%'
      OR qual    ILIKE '%.staff.%'        OR qual       ILIKE '"staff"%'
      OR with_check ILIKE '%from staff%'  OR with_check ILIKE '%join staff%'
    )
    AND qual NOT ILIKE '%store_staff%'
`, null);

const rows = Array.isArray(found) ? found : (found?.data || []);

if (!rows.length) {
  console.log('  ℹ️  No problematic policies found via text search.');
  console.log('     Trying broader drop of known stale policies...');
} else {
  console.log(`  Found ${rows.length} problematic policy/policies:`);
  rows.forEach(r => console.log(`    - ${r.tablename}: ${r.policyname}`));
}

// ─── Step 2: Drop found policies ─────────────────────────────────────────────

console.log('\n🗑️  Step 2: Dropping problematic policies...');

for (const { tablename, policyname } of rows) {
  await sql(
    `DROP POLICY IF EXISTS "${policyname}" ON ${tablename}`,
    `DROP POLICY ${tablename}.${policyname}`
  );
}

// ─── Step 3: Proactively drop any "auth_users_all_*" style policies that
//     may have been created referencing staff (belt-and-suspenders) ──────────

console.log('\n🧹 Step 3: Proactive cleanup of any stale staff-referencing policies...');

// Drop any old policies on tables that were in the zombie migration
const zombieTablePolicies = [
  { table: 'queue_entries',    policies: ['queue_entries_rls', 'auth_users_all_queue_entries'] },
  { table: 'medical_records',  policies: ['auth_users_all_medical_records'] },
  { table: 'appointments',     policies: ['auth_users_all_appointments'] },
  { table: 'hotel_bookings',   policies: ['auth_users_all_hotel_bookings'] },
  { table: 'tasks',            policies: ['auth_users_all_tasks'] },
  { table: 'documents',        policies: ['auth_users_all_documents'] },
];

for (const { table, policies } of zombieTablePolicies) {
  for (const policy of policies) {
    await sql(
      `DROP POLICY IF EXISTS "${policy}" ON ${table}`,
      `DROP stale policy: ${table}.${policy}`
    );
  }
}

// ─── Step 4: Re-create correct RLS policies using store_staff only ────────────

console.log('\n✅ Step 4: Ensuring correct store_staff-based RLS policies exist...');

// Helper function for standard store isolation
async function ensureStorePolicy(table, policyName) {
  await sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='${table}' AND policyname='${policyName}') THEN
        CREATE POLICY ${policyName} ON ${table}
          FOR ALL TO authenticated
          USING (
            store_id IN (
              SELECT store_id FROM store_staff
                WHERE user_email = auth.email() AND is_active = true
              UNION
              SELECT id FROM stores
                WHERE owner_email = auth.email() OR owner_id = auth.uid()
            )
          )
          WITH CHECK (
            store_id IN (
              SELECT store_id FROM store_staff
                WHERE user_email = auth.email() AND is_active = true
              UNION
              SELECT id FROM stores
                WHERE owner_email = auth.email() OR owner_id = auth.uid()
            )
          );
      END IF;
    END $$
  `, `RLS policy (store_staff-based): ${table}`);
}

await ensureStorePolicy('queue_entries',  'queue_store_isolation');
await ensureStorePolicy('medical_records','medical_store_isolation');
await ensureStorePolicy('appointments',   'appointments_store_isolation');
await ensureStorePolicy('hotel_bookings', 'hotel_booking_isolation');
await ensureStorePolicy('tasks',          'task_store_isolation');
await ensureStorePolicy('documents',      'document_store_isolation');

// ─── Step 5: Reload PostgREST schema cache ───────────────────────────────────

await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload PostgREST schema cache');

console.log(`
✅ Fix complete!

What was done:
  1. Found and dropped RLS policies referencing old "staff" table
  2. Dropped any stale auth_users_all_* policies
  3. Recreated correct policies using store_staff table
  4. Reloaded PostgREST schema cache

Test: try the queue page again — the error should be gone.
`);
