/**
 * Run the 5 pending migrations using Supabase Management API.
 * Usage: node scripts/migrate-pending.js <access_token>
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Usage: node scripts/migrate-pending.js <access_token>');
  process.exit(1);
}

async function runSql(sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: sql }),
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

async function runFile(filename) {
  const sql = readFileSync(join(__dirname, '..', 'docs', filename), 'utf-8');
  // Strip single-line comments and split on statement boundaries where needed
  return await runSql(sql, filename);
}

console.log('🚀 Running pending migrations...\n');

await runFile('sql-expenses-migration.sql');
await runFile('sql-pos-vat-migration.sql');
await runFile('sql-withholding-tax-migration.sql');
await runFile('sql-soap-templates-migration.sql');
await runFile('sql-medical-images-migration.sql');

// Also add missing columns on ipd_admissions (new fields from recent IPD rebuild)
await runSql(`ALTER TABLE ipd_admissions ADD COLUMN IF NOT EXISTS pet_id      UUID`, 'ADD ipd_admissions.pet_id');
await runSql(`ALTER TABLE ipd_admissions ADD COLUMN IF NOT EXISTS total_cost  NUMERIC(10,2) DEFAULT 0`, 'ADD ipd_admissions.total_cost');
await runSql(`ALTER TABLE ipd_admissions ADD COLUMN IF NOT EXISTS daily_notes TEXT`, 'ADD ipd_admissions.daily_notes');
await runSql(`ALTER TABLE ipd_admissions ADD COLUMN IF NOT EXISTS belongings_log JSONB DEFAULT '[]'`, 'ADD ipd_admissions.belongings_log');
await runSql(`ALTER TABLE ipd_admissions ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW()`, 'ADD ipd_admissions.updated_at');

// Add missing columns on ipd_vitals (if not created by sql-ipd-vitals-migration.sql)
await runSql(`
  CREATE TABLE IF NOT EXISTS ipd_vitals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id     UUID NOT NULL REFERENCES ipd_admissions(id) ON DELETE CASCADE,
    store_id         UUID,
    recorded_at      TIMESTAMPTZ DEFAULT NOW(),
    recorded_by      TEXT,
    temperature      NUMERIC(5,2),
    heart_rate       INT,
    weight_kg        NUMERIC(6,2),
    respiratory_rate INT,
    pain_score       INT,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
  )`, 'CREATE ipd_vitals (idempotent)');
await runSql(`ALTER TABLE ipd_vitals ENABLE ROW LEVEL SECURITY`, 'RLS ipd_vitals');
await runSql(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ipd_vitals' AND policyname='ipd_vitals_all') THEN
      CREATE POLICY ipd_vitals_all ON ipd_vitals FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF; END $$`, 'RLS policy ipd_vitals');

// Reload PostgREST schema cache
await runSql(`NOTIFY pgrst, 'reload schema'`, 'Reload schema cache');

console.log('\n✅ All pending migrations done');
