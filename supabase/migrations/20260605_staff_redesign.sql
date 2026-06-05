-- ════════════════════════════════════════════════════════════════════════════
-- Staff table redesign — 2026-06-05
-- Run in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Add missing columns (idempotent)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS position    TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS role_color  TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS start_date  DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS notes       TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin         TEXT;

-- 2. Ensure role check constraint covers all needed values
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('owner','manager','veterinarian','receptionist','pharmacist','groomer','staff'));

-- 3. UNIQUE constraint on (store_id, email) — required for upsert / conflict detection
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_store_id_email_unique;
ALTER TABLE staff ADD CONSTRAINT staff_store_id_email_unique UNIQUE (store_id, email);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_staff_store_id  ON staff(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_email     ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_user_id   ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_active    ON staff(store_id, is_active);

-- ════════════════════════════════════════════════════════════════════════════
-- RLS — Staff table
-- NOTE: Never query auth.users directly in RLS policies (permission denied).
--       Use auth.uid(), auth.email(), auth.jwt() instead.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (clean slate)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'staff' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON staff', r.policyname);
  END LOOP;
END$$;

-- SELECT: store owner sees all staff; staff see own record by user_id or email
CREATE POLICY "staff_select" ON staff
  FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
    OR email   = auth.email()
  );

-- INSERT: only store owner
CREATE POLICY "staff_insert" ON staff
  FOR INSERT WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- UPDATE: store owner updates any; staff updates own masking_level
CREATE POLICY "staff_update_owner" ON staff
  FOR UPDATE USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "staff_update_self" ON staff
  FOR UPDATE USING (
    user_id = auth.uid() OR email = auth.email()
  ) WITH CHECK (
    user_id = auth.uid() OR email = auth.email()
  );

-- DELETE (soft only — set is_active=false): only owner
CREATE POLICY "staff_delete" ON staff
  FOR DELETE USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════════════════════
-- RLS — Roles table (custom store positions)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'roles' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON roles', r.policyname);
  END LOOP;
END$$;

-- Owner manages their store's roles; staff can read roles in their store
CREATE POLICY "roles_select" ON roles
  FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM staff WHERE email = auth.email() AND is_active = true)
  );

CREATE POLICY "roles_insert" ON roles
  FOR INSERT WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "roles_update" ON roles
  FOR UPDATE USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "roles_delete" ON roles
  FOR DELETE USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════════════════════
-- Trigger: auto-link auth.users.id → staff.user_id on first login
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.link_staff_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.staff
  SET    user_id    = NEW.id,
         updated_at = now()
  WHERE  email   = NEW.email
    AND  user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_staff_user_id ON auth.users;
CREATE TRIGGER trg_link_staff_user_id
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_staff_user_id();
