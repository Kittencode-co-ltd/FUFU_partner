-- ============================================================
-- FUFU — Emergency RLS Reset Script
-- Use this to drop and recreate all RLS policies on the current schema.
-- Run in: Supabase Dashboard → SQL Editor
-- NOTE: For a full rebuild, use scripts/db_rebuild/ steps 01-06 instead.
-- ============================================================

-- Drop all existing policies before recreating (idempotent)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ── profiles ──────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self ON profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── stores ────────────────────────────────────────────────────
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY stores_public_read ON stores FOR SELECT TO authenticated
  USING (is_active = true);
CREATE POLICY stores_owner_write ON stores FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR owner_email = auth.email());
CREATE POLICY stores_owner_update ON stores FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR owner_email = auth.email())
  WITH CHECK (owner_id = auth.uid() OR owner_email = auth.email());
CREATE POLICY stores_owner_delete ON stores FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR owner_email = auth.email());

-- ── staff ─────────────────────────────────────────────────────
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_select ON staff FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));
CREATE POLICY staff_write ON staff FOR ALL TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ))
  WITH CHECK (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));

-- ── roles / staff_roles / staff_permissions ───────────────────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_iso ON roles FOR ALL TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ))
  WITH CHECK (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));

ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_roles_iso ON staff_roles FOR ALL TO authenticated
  USING (staff_id IN (
    SELECT st.id FROM staff st WHERE st.store_id IN (
      SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st2.store_id FROM staff st2 WHERE st2.user_id = auth.uid() AND st2.is_active = true
    )
  ));

ALTER TABLE staff_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_permissions_iso ON staff_permissions FOR ALL TO authenticated
  USING (staff_id IN (
    SELECT st.id FROM staff st WHERE st.store_id IN (
      SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st2.store_id FROM staff st2 WHERE st2.user_id = auth.uid() AND st2.is_active = true
    )
  ));

-- ── pet_owners ────────────────────────────────────────────────
ALTER TABLE pet_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY pet_owners_self ON pet_owners FOR ALL TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY pet_owners_store ON pet_owners FOR SELECT TO authenticated
  USING (id IN (
    SELECT p.owner_id FROM pets p WHERE p.store_id IN (
      SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
    )
  ));

-- ── pets ──────────────────────────────────────────────────────
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY pets_owner ON pets FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY pets_store_select ON pets FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));
CREATE POLICY pets_store_write ON pets FOR INSERT TO authenticated
  WITH CHECK (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));
CREATE POLICY pets_store_update ON pets FOR UPDATE TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));

-- ── customers ─────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_iso ON customers FOR ALL TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ))
  WITH CHECK (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));

-- ── notifications ─────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_self ON notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── appointments ──────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointments_owner ON appointments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY appointments_store_select ON appointments FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));
CREATE POLICY appointments_store_update ON appointments FOR UPDATE TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));

-- ── queue_entries ─────────────────────────────────────────────
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_iso ON queue_entries FOR ALL TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ))
  WITH CHECK (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));

-- ── medical_records ───────────────────────────────────────────
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY medical_iso ON medical_records FOR ALL TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ))
  WITH CHECK (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));

-- ── health_records ────────────────────────────────────────────
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_records_self ON health_records FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── vaccinations ──────────────────────────────────────────────
ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY vaccinations_self ON vaccinations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── pet_vaccinations ──────────────────────────────────────────
ALTER TABLE pet_vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY pet_vaccinations_iso ON pet_vaccinations FOR ALL TO authenticated
  USING (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ))
  WITH CHECK (store_id IN (
    SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
    UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
  ));

-- ── scan_results ──────────────────────────────────────────────
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY scan_results_self ON scan_results FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── IPD ───────────────────────────────────────────────────────
DO $outer$ BEGIN

  ALTER TABLE ipd_cages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ipd_cages_iso ON ipd_cages FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE ipd_admissions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ipd_admissions_iso ON ipd_admissions FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE ipd_treatments ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ipd_treatments_iso ON ipd_treatments FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE ipd_vitals ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ipd_vitals_iso ON ipd_vitals FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE treatment_sheets ENABLE ROW LEVEL SECURITY;
  CREATE POLICY treatment_sheets_iso ON treatment_sheets FOR ALL TO authenticated
    USING (admission_id IN (SELECT id FROM ipd_admissions));

  ALTER TABLE hotel_rooms ENABLE ROW LEVEL SECURITY;
  CREATE POLICY hotel_rooms_iso ON hotel_rooms FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE hotel_bookings ENABLE ROW LEVEL SECURITY;
  CREATE POLICY hotel_bookings_iso ON hotel_bookings FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE grooming_sessions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY grooming_sessions_iso ON grooming_sessions FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE grooming_records ENABLE ROW LEVEL SECURITY;
  CREATE POLICY grooming_records_iso ON grooming_records FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
  CREATE POLICY suppliers_iso ON suppliers FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE products ENABLE ROW LEVEL SECURITY;
  CREATE POLICY products_iso ON products FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
  CREATE POLICY inventory_batches_iso ON inventory_batches FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
  CREATE POLICY stock_movements_iso ON stock_movements FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY service_items_iso ON service_items FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY orders_owner ON orders FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY order_items_via_orders ON order_items FOR ALL TO authenticated
    USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

  ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  CREATE POLICY invoices_iso ON invoices FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY transactions_iso ON transactions FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
  CREATE POLICY expenses_iso ON expenses FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE soap_templates ENABLE ROW LEVEL SECURITY;
  CREATE POLICY soap_templates_iso ON soap_templates FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
  CREATE POLICY documents_iso ON documents FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tasks_iso ON tasks FOR ALL TO authenticated
    USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true))
    WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true));

  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT TO authenticated
    WITH CHECK (store_id IN (
      SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
    ) OR store_id IS NULL);
  CREATE POLICY audit_logs_select ON audit_logs FOR SELECT TO authenticated
    USING (store_id IN (
      SELECT s.id FROM stores s WHERE s.owner_id = auth.uid() OR s.owner_email = auth.email()
      UNION SELECT st.store_id FROM staff st WHERE st.user_id = auth.uid() AND st.is_active = true
    ) OR store_id IS NULL);

END $outer$;

NOTIFY pgrst, 'reload schema';
SELECT 'RLS reset complete — all policies recreated' AS status;
