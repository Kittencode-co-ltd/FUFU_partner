/**
 * Nuclear RLS fix — drops ALL policies on affected tables, recreates correctly.
 *
 * Usage: node scripts/fix-rls-nuclear.js <access_token>
 */

const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2];
if (!ACCESS_TOKEN) { console.error('Usage: node scripts/fix-rls-nuclear.js <token>'); process.exit(1); }

async function sql(query, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    { method:'POST', headers:{'Authorization':`Bearer ${ACCESS_TOKEN}`,'Content-Type':'application/json'}, body:JSON.stringify({query}) }
  );
  const data = await res.json();
  if (!res.ok || data.error) { console.log(`  ❌ ${label||''}:`, data.error||data.message); return null; }
  if (label) console.log(`  ✅ ${label}`);
  return Array.isArray(data) ? data : data;
}

// ── Step 1: List ALL existing policies on affected tables ─────────────────────
console.log('\n🔍 Listing all current RLS policies...');
const policies = await sql(`
  SELECT tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname
`, null);

const rows = Array.isArray(policies) ? policies : [];
console.log(`  Found ${rows.length} total policies`);
rows.forEach(r => console.log(`    ${r.tablename}: ${r.policyname}`));

// ── Step 2: Drop ALL policies on every table (clean slate) ───────────────────
console.log('\n🗑️  Dropping ALL existing RLS policies (clean slate)...');
for (const { tablename, policyname } of rows) {
  await sql(
    `DROP POLICY IF EXISTS "${policyname}" ON ${tablename}`,
    `Drop ${tablename}."${policyname}"`
  );
}

// ── Step 3: Recreate correct policies (store_staff-based only) ───────────────
console.log('\n✅ Recreating correct RLS policies...');

// Reusable USING clause
const storeCheck = `
  store_id IN (
    SELECT ss.store_id FROM store_staff ss
      WHERE ss.user_email = auth.email() AND ss.is_active = true
    UNION
    SELECT s.id FROM stores s
      WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
  )
`;

// Standard store-isolation policy for each table
const standardTables = [
  'queue_entries','medical_records','grooming_sessions','hotel_bookings',
  'hotel_rooms','inventory_batches','invoices','ipd_admissions','ipd_cages',
  'ipd_treatments','ipd_vitals','expenses','products','stock_movements',
  'suppliers','soap_templates','tasks','documents','orders',
  // NOTE: order_items excluded — no store_id column, handled separately below
  // NOTE: store_staff excluded — self-referential policy causes infinite recursion, handled separately below
  'roles','service_items',
];

for (const table of standardTables) {
  await sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}') THEN
        ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='${table}' AND policyname='${table}_store_iso') THEN
          EXECUTE $pol$
            CREATE POLICY ${table}_store_iso ON ${table}
              FOR ALL TO authenticated
              USING (${storeCheck})
              WITH CHECK (${storeCheck})
          $pol$;
        END IF;
      END IF;
    END $$
  `, `RLS (store_staff): ${table}`);
}

// pet_owners — global table: staff sees owners of their store's pets, mobile user sees own
await sql(`
  DO $$ BEGIN
    ALTER TABLE pet_owners ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pet_owners' AND policyname='pet_owners_iso') THEN
      CREATE POLICY pet_owners_iso ON pet_owners
        FOR ALL TO authenticated
        USING (
          id IN (
            SELECT DISTINCT p.owner_id FROM pets p
            WHERE p.store_id IN (
              SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
              UNION
              SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
            )
          )
          OR auth_user_id = auth.uid()
        );
    END IF;
  END $$
`, 'RLS: pet_owners (store-or-self)');

// pets — store-scoped + mobile user can see own pets
await sql(`
  DO $$ BEGIN
    ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pets' AND policyname='pets_iso') THEN
      CREATE POLICY pets_iso ON pets
        FOR ALL TO authenticated
        USING (
          store_id IN (
            SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
            UNION
            SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
          )
          OR owner_id IN (
            SELECT po.id FROM pet_owners po WHERE po.auth_user_id = auth.uid()
          )
        )
        WITH CHECK (
          store_id IN (
            SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
            UNION
            SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
          )
        );
    END IF;
  END $$
`, 'RLS: pets (store-or-owner)');

// pet_vaccinations
await sql(`
  DO $$ BEGIN
    ALTER TABLE pet_vaccinations ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pet_vaccinations' AND policyname='pet_vax_iso') THEN
      CREATE POLICY pet_vax_iso ON pet_vaccinations
        FOR ALL TO authenticated
        USING (
          store_id IN (
            SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
            UNION
            SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
          )
        );
    END IF;
  END $$
`, 'RLS: pet_vaccinations');

// appointments — special: nullable store_id (mobile unassigned bookings)
await sql(`
  DO $$ BEGIN
    ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_iso') THEN
      CREATE POLICY appointments_iso ON appointments
        FOR ALL TO authenticated
        USING (
          store_id IN (
            SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
            UNION
            SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
          )
          OR store_id IS NULL
          OR user_id = auth.uid()
        );
    END IF;
  END $$
`, 'RLS: appointments (store + mobile unassigned)');

// transactions — no store_id on order_items row, use parent
await sql(`
  DO $$ BEGIN
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='transactions_iso') THEN
      CREATE POLICY transactions_iso ON transactions
        FOR ALL TO authenticated
        USING (
          store_id IN (
            SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
            UNION
            SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
          )
        );
    END IF;
  END $$
`, 'RLS: transactions');

// order_items — no direct store_id, inherit from orders
await sql(`
  DO $$ BEGIN
    ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_items' AND policyname='order_items_via_order') THEN
      CREATE POLICY order_items_via_order ON order_items
        FOR ALL TO authenticated
        USING (order_id IN (SELECT id FROM orders));
    END IF;
  END $$
`, 'RLS: order_items (via orders)');

// audit_logs — store_id nullable, only staff can read
await sql(`
  DO $$ BEGIN
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='audit_logs_iso') THEN
      CREATE POLICY audit_logs_iso ON audit_logs
        FOR ALL TO authenticated
        USING (
          store_id IN (
            SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
            UNION
            SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
          )
          OR store_id IS NULL
        );
    END IF;
  END $$
`, 'RLS: audit_logs');

// store_staff — CANNOT use the standard storeCheck (references store_staff itself → infinite recursion)
// Instead: each user sees their own rows + store owners see all rows for their stores
await sql(`
  DO $$ BEGIN
    ALTER TABLE store_staff ENABLE ROW LEVEL SECURITY;
    -- SELECT: staff sees own record, owner sees all records for their store
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_staff' AND policyname='store_staff_select') THEN
      CREATE POLICY store_staff_select ON store_staff
        FOR SELECT TO authenticated
        USING (
          user_email = auth.email()
          OR store_id IN (
            SELECT id FROM stores WHERE owner_email = auth.email() OR owner_id = auth.uid()
          )
        );
    END IF;
    -- INSERT/UPDATE/DELETE: only store owners can manage staff
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_staff' AND policyname='store_staff_write') THEN
      CREATE POLICY store_staff_write ON store_staff
        FOR ALL TO authenticated
        USING (
          store_id IN (
            SELECT id FROM stores WHERE owner_email = auth.email() OR owner_id = auth.uid()
          )
        )
        WITH CHECK (
          store_id IN (
            SELECT id FROM stores WHERE owner_email = auth.email() OR owner_id = auth.uid()
          )
        );
    END IF;
  END $$
`, 'RLS: store_staff (non-recursive)');

// ── Step 4: Reload schema cache ───────────────────────────────────────────────
await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload PostgREST schema cache');

console.log(`
✅ Nuclear RLS fix complete!

All old policies dropped → clean slate.
New policies created using store_staff (no reference to dropped "staff" table).
Queue page should work now.
`);
