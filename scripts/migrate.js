/**
 * FUFU Partner — Database Migration Script
 * Uses Supabase Management API to execute SQL directly
 */

const PROJECT_REF   = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN  = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Usage: node scripts/migrate.js <access_token>');
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
    console.log(`❌ ${label}: ${data.error || data.message || JSON.stringify(data)}`);
    return false;
  }
  console.log(`✅ ${label}`);
  return true;
}

// ─── Migrations ───────────────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL,
    name       TEXT NOT NULL,
    contact    TEXT,
    phone      TEXT,
    email      TEXT,
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, 'CREATE suppliers');

await sql(`
  CREATE TABLE IF NOT EXISTS stock_movements (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id       UUID NOT NULL,
    product_id     UUID NOT NULL REFERENCES products(id),
    batch_id       UUID REFERENCES inventory_batches(id),
    movement_type  TEXT NOT NULL,
    quantity       INT  NOT NULL,
    reference_type TEXT,
    reference_id   UUID,
    reason         TEXT,
    performed_by   TEXT DEFAULT 'staff',
    created_at     TIMESTAMPTZ DEFAULT NOW()
  )`, 'CREATE stock_movements');

await sql(`
  CREATE INDEX IF NOT EXISTS idx_batches_fefo
    ON inventory_batches (product_id, is_active, expiry_date ASC NULLS LAST)
`, 'CREATE idx_batches_fefo');

await sql(`
  CREATE INDEX IF NOT EXISTS idx_appointments_store_date
    ON appointments (store_id, appt_date)
`, 'CREATE idx_appointments_store_date');

// ─── RLS Policies ─────────────────────────────────────────────────────────────

const tables = ['suppliers', 'stock_movements', 'inventory_batches', 'pet_owners', 'pets', 'pet_vaccinations', 'appointments'];

for (const t of tables) {
  await sql(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`, `RLS enable: ${t}`);
  await sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = '${t}' AND policyname = 'auth_users_all_${t}'
      ) THEN
        CREATE POLICY auth_users_all_${t} ON ${t}
          FOR ALL TO authenticated USING (true) WITH CHECK (true);
      END IF;
    END $$`, `RLS policy: ${t}`);
}

// ─── IPD Ward tables ──────────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS ipd_cages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL,
    cage_number TEXT NOT NULL,
    cage_type   TEXT DEFAULT 'standard',
    floor       INT  DEFAULT 1,
    status      TEXT DEFAULT 'available',
    daily_rate  NUMERIC(10,2) DEFAULT 500,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, cage_number)
  )`, 'CREATE ipd_cages');

await sql(`
  CREATE TABLE IF NOT EXISTS ipd_admissions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id         UUID NOT NULL,
    cage_id          UUID REFERENCES ipd_cages(id),
    pet_name         TEXT NOT NULL,
    owner_name       TEXT,
    species          TEXT DEFAULT 'dog',
    admission_reason TEXT,
    status           TEXT DEFAULT 'admitted',
    daily_rate       NUMERIC(10,2) DEFAULT 500,
    admitted_at      TIMESTAMPTZ DEFAULT NOW(),
    discharged_at    TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
  )`, 'CREATE ipd_admissions');

await sql(`
  CREATE TABLE IF NOT EXISTS ipd_treatments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id    UUID NOT NULL REFERENCES ipd_admissions(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL,
    treatment_time  TEXT NOT NULL,
    treatment_type  TEXT DEFAULT 'medication',
    description     TEXT,
    dosage          TEXT,
    status          TEXT DEFAULT 'pending',
    completed_by    TEXT,
    eat_status      TEXT,
    poop_status     TEXT,
    pee_status      TEXT,
    notes           TEXT,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`, 'CREATE ipd_treatments');

await sql(`ALTER TABLE ipd_cages       ENABLE ROW LEVEL SECURITY`, 'RLS ipd_cages');
await sql(`ALTER TABLE ipd_admissions  ENABLE ROW LEVEL SECURITY`, 'RLS ipd_admissions');
await sql(`ALTER TABLE ipd_treatments  ENABLE ROW LEVEL SECURITY`, 'RLS ipd_treatments');
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ipd_cages' AND policyname='ipd_cages_all') THEN
      CREATE POLICY ipd_cages_all ON ipd_cages FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF; END $$`, 'RLS policy ipd_cages');
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ipd_admissions' AND policyname='ipd_admissions_all') THEN
      CREATE POLICY ipd_admissions_all ON ipd_admissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF; END $$`, 'RLS policy ipd_admissions');
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ipd_treatments' AND policyname='ipd_treatments_all') THEN
      CREATE POLICY ipd_treatments_all ON ipd_treatments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF; END $$`, 'RLS policy ipd_treatments');

// ─── Documents table ──────────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id     UUID NOT NULL,
    doc_type     TEXT NOT NULL,
    title        TEXT NOT NULL,
    content      JSONB DEFAULT '{}',
    status       TEXT DEFAULT 'draft',
    ref_type     TEXT,
    ref_id       UUID,
    pet_name     TEXT,
    owner_name   TEXT,
    created_by   TEXT,
    signed_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  )`, 'CREATE documents');

await sql(`ALTER TABLE documents ENABLE ROW LEVEL SECURITY`, 'RLS documents');
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documents' AND policyname='documents_all') THEN
      CREATE POLICY documents_all ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF; END $$`, 'RLS policy documents');

// ─── Tasks (Kanban) table ─────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id     UUID NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT DEFAULT 'todo',
    priority     TEXT DEFAULT 'normal',
    assigned_to  TEXT,
    due_date     DATE,
    tags         TEXT[],
    created_by   TEXT,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  )`, 'CREATE tasks');

await sql(`ALTER TABLE tasks ENABLE ROW LEVEL SECURITY`, 'RLS tasks');
await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='tasks_all') THEN
      CREATE POLICY tasks_all ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF; END $$`, 'RLS policy tasks');

// ─── products extra columns ───────────────────────────────────────────────────

await sql(`ALTER TABLE products ADD COLUMN IF NOT EXISTS icon          TEXT    DEFAULT '📦'`,  'ADD products.icon');
await sql(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit          TEXT    DEFAULT 'ชิ้น'`, 'ADD products.unit');
await sql(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price    NUMERIC(10,2)`,          'ADD products.cost_price');
await sql(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sell_price    NUMERIC(10,2)`,          'ADD products.sell_price');
await sql(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_point INT`,                    'ADD products.reorder_point');
await sql(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_qty   INT`,                    'ADD products.reorder_qty');

// ─── store_staff extra columns ────────────────────────────────────────────────

await sql(`ALTER TABLE store_staff ADD COLUMN IF NOT EXISTS phone      TEXT`,       'ADD store_staff.phone');
await sql(`ALTER TABLE store_staff ADD COLUMN IF NOT EXISTS position   TEXT`,       'ADD store_staff.position');
await sql(`ALTER TABLE store_staff ADD COLUMN IF NOT EXISTS start_date DATE`,       'ADD store_staff.start_date');
await sql(`ALTER TABLE store_staff ADD COLUMN IF NOT EXISTS notes      TEXT`,       'ADD store_staff.notes');

// ─── Reload schema ────────────────────────────────────────────────────────────

await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload schema cache');

console.log('\n✅ Migration complete');
