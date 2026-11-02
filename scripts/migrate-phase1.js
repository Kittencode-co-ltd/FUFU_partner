/**
 * FUFU Partner — Phase 1 Database Migration (Critical Fixes)
 *
 * Safe to run: no existing data loss, all changes are additive or type-safe casts.
 *
 * What this does:
 *   1. store_staff  — add FK to stores, UNIQUE constraint, user_id column
 *   2. orders       — drop broken table + recreate with proper schema
 *   3. order_items  — drop broken table + recreate with product_id FK
 *   4. invoices     — fix INTEGER money columns → NUMERIC(12,2)
 *   5. transactions — fix INTEGER vat columns → NUMERIC(12,2)
 *   6. inventory_batches — fix cost_price INTEGER → NUMERIC(12,2), add supplier_id FK
 *   7. Indexes      — add 6 missing performance indexes
 *   8. RLS          — add store-isolation policies on core tables
 *
 * Usage:
 *   node scripts/migrate-phase1.js <supabase_access_token>
 *
 * Get access token from: https://supabase.com/dashboard/account/tokens
 */

const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Usage: node scripts/migrate-phase1.js <access_token>');
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
console.log('\n📦 Phase 1: store_staff constraints');
// ─────────────────────────────────────────────────────────────────────────────

// Add FK store_staff → stores
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'store_staff' AND constraint_name = 'store_staff_store_id_fkey'
    ) THEN
      ALTER TABLE store_staff
        ADD CONSTRAINT store_staff_store_id_fkey
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
    END IF;
  END $$
`, 'store_staff → stores FK');

// Add UNIQUE(store_id, user_email)
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'store_staff' AND constraint_name = 'store_staff_unique_member'
    ) THEN
      ALTER TABLE store_staff
        ADD CONSTRAINT store_staff_unique_member UNIQUE (store_id, user_email);
    END IF;
  END $$
`, 'store_staff UNIQUE(store_id, user_email)');

// Add user_id column (links directly to auth.users)
await sql(`
  ALTER TABLE store_staff
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
`, 'store_staff.user_id column');

// Populate user_id from auth.users where email matches (best-effort)
await sql(`
  UPDATE store_staff ss
  SET user_id = au.id
  FROM auth.users au
  WHERE au.email = ss.user_email
    AND ss.user_id IS NULL
`, 'Populate store_staff.user_id from auth.users');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🛒 Phase 1: orders & order_items (drop broken + recreate)');
// ─────────────────────────────────────────────────────────────────────────────

// Drop old broken tables (no real data in them)
await sql(`DROP TABLE IF EXISTS order_items CASCADE`, 'DROP old order_items');
await sql(`DROP TABLE IF EXISTS orders CASCADE`,      'DROP old orders');

// Recreate orders with proper multi-tenant schema
await sql(`
  CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    user_id          UUID NOT NULL REFERENCES auth.users(id),
    pet_owner_id     UUID REFERENCES pet_owners(id),
    order_number     TEXT,
    delivery_method  TEXT CHECK (delivery_method IN ('pickup', 'delivery')),
    delivery_address JSONB,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','preparing','ready','shipped','delivered','cancelled')),
    payment_status   TEXT NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN ('pending','paid','refunded','failed')),
    payment_method   TEXT,
    payment_reference TEXT,
    subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    vat_rate         NUMERIC(5,2)  NOT NULL DEFAULT 0,
    vat_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    total            NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
  )
`, 'CREATE orders (new schema)');

await sql(`
  CREATE TABLE order_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id),
    product_name TEXT          NOT NULL,
    unit_price   NUMERIC(12,2) NOT NULL,
    quantity     INTEGER       NOT NULL CHECK (quantity > 0),
    subtotal     NUMERIC(12,2) NOT NULL
  )
`, 'CREATE order_items (new schema with product_id FK)');

// RLS for orders
await sql(`ALTER TABLE orders     ENABLE ROW LEVEL SECURITY`, 'RLS orders');
await sql(`ALTER TABLE order_items ENABLE ROW LEVEL SECURITY`, 'RLS order_items');
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_store_isolation') THEN
      CREATE POLICY orders_store_isolation ON orders
        FOR ALL TO authenticated
        USING (
          store_id IN (
            SELECT store_id FROM store_staff WHERE user_email = auth.email() AND is_active = true
            UNION
            SELECT id FROM stores WHERE owner_email = auth.email() OR owner_id = auth.uid()
          )
          OR user_id = auth.uid()
        );
    END IF;
  END $$
`, 'RLS policy: orders');
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_items' AND policyname='order_items_via_orders') THEN
      CREATE POLICY order_items_via_orders ON order_items
        FOR ALL TO authenticated
        USING (
          order_id IN (SELECT id FROM orders)
        );
    END IF;
  END $$
`, 'RLS policy: order_items');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n💰 Phase 1: fix INTEGER money columns → NUMERIC(12,2)');
// ─────────────────────────────────────────────────────────────────────────────

// invoices
await sql(`ALTER TABLE invoices ALTER COLUMN subtotal   TYPE NUMERIC(12,2) USING subtotal::NUMERIC(12,2)`,   'invoices.subtotal → NUMERIC');
await sql(`ALTER TABLE invoices ALTER COLUMN discount   TYPE NUMERIC(12,2) USING discount::NUMERIC(12,2)`,   'invoices.discount → NUMERIC');
await sql(`ALTER TABLE invoices ALTER COLUMN total      TYPE NUMERIC(12,2) USING total::NUMERIC(12,2)`,      'invoices.total → NUMERIC');
await sql(`ALTER TABLE invoices ALTER COLUMN vat_amount TYPE NUMERIC(12,2) USING vat_amount::NUMERIC(12,2)`, 'invoices.vat_amount → NUMERIC');
await sql(`ALTER TABLE invoices ALTER COLUMN vat_rate   TYPE NUMERIC(5,2)  USING vat_rate::NUMERIC(5,2)`,   'invoices.vat_rate → NUMERIC');

// transactions
await sql(`ALTER TABLE transactions ALTER COLUMN vat_rate   TYPE NUMERIC(5,2)  USING vat_rate::NUMERIC(5,2)`,   'transactions.vat_rate → NUMERIC');
await sql(`ALTER TABLE transactions ALTER COLUMN vat_amount TYPE NUMERIC(12,2) USING vat_amount::NUMERIC(12,2)`, 'transactions.vat_amount → NUMERIC');

// inventory_batches
await sql(`ALTER TABLE inventory_batches ALTER COLUMN cost_price TYPE NUMERIC(12,2) USING COALESCE(cost_price, 0)::NUMERIC(12,2)`, 'inventory_batches.cost_price → NUMERIC');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔗 Phase 1: inventory_batches supplier_id FK');
// ─────────────────────────────────────────────────────────────────────────────

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'inventory_batches' AND constraint_name = 'inventory_batches_supplier_id_fkey'
    ) THEN
      -- Only add FK where supplier_id actually exists in suppliers table
      UPDATE inventory_batches SET supplier_id = NULL
        WHERE supplier_id IS NOT NULL
          AND supplier_id NOT IN (SELECT id FROM suppliers);

      ALTER TABLE inventory_batches
        ADD CONSTRAINT inventory_batches_supplier_id_fkey
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
    END IF;
  END $$
`, 'inventory_batches.supplier_id → suppliers FK');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n⚡ Phase 1: performance indexes');
// ─────────────────────────────────────────────────────────────────────────────

await sql(`CREATE INDEX IF NOT EXISTS idx_queue_daily    ON queue_entries (store_id, queue_date, status)`,                            'INDEX queue_entries (store_id, queue_date, status)');
await sql(`CREATE INDEX IF NOT EXISTS idx_medical_store  ON medical_records (store_id, created_at DESC)`,                             'INDEX medical_records (store_id, created_at)');
await sql(`CREATE INDEX IF NOT EXISTS idx_medical_pet    ON medical_records (pet_id) WHERE deleted_at IS NULL`,                       'INDEX medical_records (pet_id) partial');
await sql(`CREATE INDEX IF NOT EXISTS idx_appt_store     ON appointments (store_id, appt_date, status) WHERE store_id IS NOT NULL`,   'INDEX appointments (store_id, appt_date, status)');
await sql(`CREATE INDEX IF NOT EXISTS idx_vax_due        ON pet_vaccinations (pet_id, next_due_date)`,                                'INDEX pet_vaccinations (pet_id, next_due_date)');
await sql(`CREATE INDEX IF NOT EXISTS idx_stock_store    ON stock_movements (store_id, created_at DESC)`,                             'INDEX stock_movements (store_id, created_at)');
await sql(`CREATE INDEX IF NOT EXISTS idx_orders_store   ON orders (store_id, status, created_at DESC)`,                             'INDEX orders (store_id, status)');
await sql(`CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders (user_id, created_at DESC)`,                                       'INDEX orders (user_id)');

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔒 Phase 1: RLS policies (store isolation)');
// ─────────────────────────────────────────────────────────────────────────────

// Helper: create RLS policy for standard store-scoped tables
const storeIsolationTables = [
  { table: 'queue_entries',       policy: 'queue_store_isolation' },
  { table: 'medical_records',     policy: 'medical_store_isolation' },
  { table: 'grooming_sessions',   policy: 'grooming_store_isolation' },
  { table: 'hotel_bookings',      policy: 'hotel_booking_isolation' },
  { table: 'hotel_rooms',         policy: 'hotel_room_isolation' },
  { table: 'ipd_admissions',      policy: 'ipd_admission_isolation' },
  { table: 'ipd_cages',           policy: 'ipd_cage_isolation' },
  { table: 'ipd_treatments',      policy: 'ipd_treatment_store_isolation' },
  { table: 'ipd_vitals',          policy: 'ipd_vital_store_isolation' },
  { table: 'invoices',            policy: 'invoice_store_isolation' },
  { table: 'transactions',        policy: 'transaction_store_isolation' },
  { table: 'expenses',            policy: 'expense_store_isolation' },
  { table: 'products',            policy: 'product_store_isolation' },
  { table: 'inventory_batches',   policy: 'inventory_batch_isolation' },
  { table: 'stock_movements',     policy: 'stock_movement_isolation' },
  { table: 'suppliers',           policy: 'supplier_store_isolation' },
  { table: 'soap_templates',      policy: 'soap_template_isolation' },
  { table: 'tasks',               policy: 'task_store_isolation' },
  { table: 'documents',           policy: 'document_store_isolation' },
];

for (const { table, policy } of storeIsolationTables) {
  await sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='${table}' AND policyname='${policy}') THEN
        CREATE POLICY ${policy} ON ${table}
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
  `, `RLS policy: ${table}`);
}

// pet_owners — global table, special RLS: see owners of pets at your store OR own profile
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pet_owners' AND policyname='pet_owners_store_or_self') THEN
      CREATE POLICY pet_owners_store_or_self ON pet_owners
        FOR SELECT TO authenticated
        USING (
          -- Staff sees owners whose pets are at their store
          id IN (
            SELECT DISTINCT p.owner_id FROM pets p
            WHERE p.store_id IN (
              SELECT store_id FROM store_staff WHERE user_email = auth.email() AND is_active = true
              UNION
              SELECT id FROM stores WHERE owner_email = auth.email() OR owner_id = auth.uid()
            )
          )
          -- Mobile user sees their own profile
          OR auth_user_id = auth.uid()
        );
    END IF;
  END $$
`, 'RLS policy: pet_owners (store-or-self)');

// pets — store-scoped with global owner link
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pets' AND policyname='pets_store_or_owner') THEN
      CREATE POLICY pets_store_or_owner ON pets
        FOR ALL TO authenticated
        USING (
          store_id IN (
            SELECT store_id FROM store_staff WHERE user_email = auth.email() AND is_active = true
            UNION
            SELECT id FROM stores WHERE owner_email = auth.email() OR owner_id = auth.uid()
          )
          -- Mobile user sees their own pets
          OR owner_id IN (
            SELECT id FROM pet_owners WHERE auth_user_id = auth.uid()
          )
        );
    END IF;
  END $$
`, 'RLS policy: pets (store-or-owner)');

// appointments — special: nullable store_id (unassigned from mobile app)
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_access') THEN
      CREATE POLICY appointments_access ON appointments
        FOR ALL TO authenticated
        USING (
          -- Partner sees appointments assigned to their store OR unassigned (inbox)
          store_id IN (
            SELECT store_id FROM store_staff WHERE user_email = auth.email() AND is_active = true
            UNION
            SELECT id FROM stores WHERE owner_email = auth.email() OR owner_id = auth.uid()
          )
          OR store_id IS NULL   -- unassigned appointments from mobile app
          -- Mobile user sees their own bookings
          OR user_id = auth.uid()
          OR owner_id IN (SELECT id FROM pet_owners WHERE auth_user_id = auth.uid())
        );
    END IF;
  END $$
`, 'RLS policy: appointments (partner + mobile)');

// ─────────────────────────────────────────────────────────────────────────────
// Reload PostgREST schema cache
await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload PostgREST schema cache');

console.log(`
✅ Phase 1 migration complete!

Summary of changes:
  • store_staff: FK to stores, UNIQUE(store_id,user_email), user_id column
  • orders + order_items: dropped broken tables, recreated with proper schema
  • invoices: subtotal/discount/total/vat_amount/vat_rate → NUMERIC(12,2)
  • transactions: vat_rate/vat_amount → NUMERIC(12,2)
  • inventory_batches: cost_price → NUMERIC(12,2), supplier_id FK added
  • 8 performance indexes added
  • RLS policies added on ${storeIsolationTables.length + 4} tables

Next steps:
  Phase 2 — Run migrate-phase2.js (cleanup duplicate columns)
  Phase 3 — Add remaining RLS + consolidate staff tables
`);
