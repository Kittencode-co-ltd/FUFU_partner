-- ============================================================
-- FUFU Partner + Mobile — Comprehensive RLS Fix
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ─── 1. Fix store_staff: DROP all recursive policies ─────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='store_staff' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.store_staff', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.store_staff ENABLE ROW LEVEL SECURITY;

-- SELECT: staff sees own row, owner sees all store rows (NO self-reference → no recursion)
CREATE POLICY store_staff_select ON public.store_staff
  FOR SELECT TO authenticated
  USING (
    user_email = auth.email()
    OR store_id IN (
      SELECT id FROM stores WHERE owner_email = auth.email() OR owner_id = auth.uid()
    )
  );

-- WRITE: only store owner can add/edit/remove staff
CREATE POLICY store_staff_write ON public.store_staff
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

-- ─── 2. Fix stores: ensure RLS policies exist ─────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='stores' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.stores', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Owner or staff member can see the store
CREATE POLICY stores_select ON public.stores
  FOR SELECT TO authenticated
  USING (
    owner_id    = auth.uid()
    OR owner_email = auth.email()
    OR id IN (
      SELECT store_id FROM store_staff
      WHERE user_email = auth.email() AND is_active = true
    )
  );

-- Only owner can modify the store record
CREATE POLICY stores_write ON public.stores
  FOR ALL TO authenticated
  USING    (owner_id = auth.uid() OR owner_email = auth.email())
  WITH CHECK (owner_id = auth.uid() OR owner_email = auth.email());

-- ─── 3. Recreate profiles table (dropped by mistake, mobile uses it) ──────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  phone      TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill existing users
INSERT INTO public.profiles (id, full_name, phone, avatar_url, created_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', '') AS full_name,
  au.raw_user_meta_data->>'phone'       AS phone,
  au.raw_user_meta_data->>'avatar_url'  AS avatar_url,
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Auto-create profile on new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 4. Ensure other key tables have correct RLS ────────────────────────────
-- (only adds if policy doesn't already exist)

-- Helper: the standard store-isolation USING clause
-- staff sees rows for stores they work at; owner sees rows for their stores
-- NOTE: this subquery goes to store_staff (OK — only store_staff itself cannot recurse)

DO $outer$ BEGIN

  -- queue_entries
  ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='queue_entries' AND policyname='queue_entries_iso') THEN
    CREATE POLICY queue_entries_iso ON queue_entries FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- appointments
  ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_iso') THEN
    CREATE POLICY appointments_iso ON appointments FOR ALL TO authenticated
      USING (
        store_id IN (
          SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
          UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
        )
        OR store_id IS NULL
        OR user_id = auth.uid()
      );
  END IF;

  -- pets
  ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pets' AND policyname='pets_iso') THEN
    CREATE POLICY pets_iso ON pets FOR ALL TO authenticated
      USING (
        store_id IN (
          SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
          UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
        )
        OR owner_id IN (SELECT po.id FROM pet_owners po WHERE po.auth_user_id = auth.uid())
      )
      WITH CHECK (
        store_id IN (
          SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
          UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
        )
      );
  END IF;

  -- pet_owners
  ALTER TABLE pet_owners ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pet_owners' AND policyname='pet_owners_iso') THEN
    CREATE POLICY pet_owners_iso ON pet_owners FOR ALL TO authenticated
      USING (
        id IN (
          SELECT DISTINCT p.owner_id FROM pets p
          WHERE p.store_id IN (
            SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
            UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
          )
        )
        OR auth_user_id = auth.uid()
      );
  END IF;

  -- medical_records
  ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_records' AND policyname='medical_records_iso') THEN
    CREATE POLICY medical_records_iso ON medical_records FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- transactions
  ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='transactions_iso') THEN
    CREATE POLICY transactions_iso ON transactions FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- invoices
  ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='invoices_iso') THEN
    CREATE POLICY invoices_iso ON invoices FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- expenses
  ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expenses' AND policyname='expenses_iso') THEN
    CREATE POLICY expenses_iso ON expenses FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- tasks
  ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='tasks_iso') THEN
    CREATE POLICY tasks_iso ON tasks FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- products
  ALTER TABLE products ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_iso') THEN
    CREATE POLICY products_iso ON products FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- grooming_sessions
  ALTER TABLE grooming_sessions ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='grooming_sessions' AND policyname='grooming_sessions_iso') THEN
    CREATE POLICY grooming_sessions_iso ON grooming_sessions FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- hotel_bookings
  ALTER TABLE hotel_bookings ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hotel_bookings' AND policyname='hotel_bookings_iso') THEN
    CREATE POLICY hotel_bookings_iso ON hotel_bookings FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- hotel_rooms
  ALTER TABLE hotel_rooms ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hotel_rooms' AND policyname='hotel_rooms_iso') THEN
    CREATE POLICY hotel_rooms_iso ON hotel_rooms FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- ipd_admissions
  ALTER TABLE ipd_admissions ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ipd_admissions' AND policyname='ipd_admissions_iso') THEN
    CREATE POLICY ipd_admissions_iso ON ipd_admissions FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- ipd_cages
  ALTER TABLE ipd_cages ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ipd_cages' AND policyname='ipd_cages_iso') THEN
    CREATE POLICY ipd_cages_iso ON ipd_cages FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- inventory_batches
  ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory_batches' AND policyname='inventory_batches_iso') THEN
    CREATE POLICY inventory_batches_iso ON inventory_batches FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- audit_logs
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='audit_logs_iso') THEN
    CREATE POLICY audit_logs_iso ON audit_logs FOR ALL TO authenticated
      USING (
        store_id IN (
          SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
          UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
        )
        OR store_id IS NULL
      );
  END IF;

  -- documents
  ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documents' AND policyname='documents_iso') THEN
    CREATE POLICY documents_iso ON documents FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- pet_vaccinations
  ALTER TABLE pet_vaccinations ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pet_vaccinations' AND policyname='pet_vaccinations_iso') THEN
    CREATE POLICY pet_vaccinations_iso ON pet_vaccinations FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- soap_templates
  ALTER TABLE soap_templates ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soap_templates' AND policyname='soap_templates_iso') THEN
    CREATE POLICY soap_templates_iso ON soap_templates FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- stock_movements
  ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='stock_movements_iso') THEN
    CREATE POLICY stock_movements_iso ON stock_movements FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- suppliers
  ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='suppliers' AND policyname='suppliers_iso') THEN
    CREATE POLICY suppliers_iso ON suppliers FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- orders
  ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_iso') THEN
    CREATE POLICY orders_iso ON orders FOR ALL TO authenticated
      USING (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ))
      WITH CHECK (store_id IN (
        SELECT ss.store_id FROM store_staff ss WHERE ss.user_email = auth.email() AND ss.is_active = true
        UNION SELECT s.id FROM stores s WHERE s.owner_email = auth.email() OR s.owner_id = auth.uid()
      ));
  END IF;

  -- order_items (no direct store_id — inherit via parent orders)
  ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_items' AND policyname='order_items_via_orders') THEN
    CREATE POLICY order_items_via_orders ON order_items FOR ALL TO authenticated
      USING (order_id IN (SELECT id FROM orders));
  END IF;

END $outer$;

-- ─── 5. Reload PostgREST schema cache ────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── Done ────────────────────────────────────────────────────
SELECT 'RLS fix complete — all policies recreated correctly' AS status;
