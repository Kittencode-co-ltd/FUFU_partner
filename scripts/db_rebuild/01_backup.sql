-- ============================================================
-- FUFU Database Rebuild — Step 1: Backup current data
-- Run in: Supabase Dashboard → SQL Editor
-- Skips tables that don't exist — safe to run even on partial schema.
-- ============================================================

DO $$
DECLARE
  tbls text[] := ARRAY[
    'stores',
    'store_staff',
    'pet_owners',
    'pets',
    'customers',
    'notifications',
    'appointments',
    'orders',
    'order_items',
    'vaccinations',
    'pet_vaccinations',
    'profiles',
    'roles',
    'scan_results',
    'medical_records'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS _bak_%I AS SELECT * FROM public.%I',
        t, t
      );
      RAISE NOTICE 'Backed up: %', t;
    ELSE
      RAISE NOTICE 'Skipped (not found): %', t;
    END IF;
  END LOOP;
END $$;

-- Verify what was actually backed up and row counts
SELECT
  tablename AS backed_up_table,
  (xpath('/row/c/text()',
    query_to_xml(format('SELECT COUNT(*) AS c FROM %I', tablename), false, true, ''))
  )[1]::text::int AS row_count
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE '_bak_%'
ORDER BY tablename;
