-- ============================================================
-- FUFU Database — Step 10: Staff Module Compatibility Fix
-- The schema rebuild renamed store_staff → staff and switched to a
-- single-role model, but the application (staff.js, rbac.js, auth.js)
-- still uses the multi-role model with these columns:
--   user_email, name, roles[], pin, position, start_date, notes, invited_by
--
-- This migration extends the `staff` table with those columns so the
-- module works again WITHOUT rewriting the app's multi-role design, and
-- keeps the new-schema columns (full_name, email) in sync via a trigger
-- so both naming conventions stay valid.
--
-- Idempotent: safe to re-run. Run AFTER step 09.
-- ============================================================

-- ── 1. Add the columns the application expects ────────────────────────────────
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_email  text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS name        text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS roles       text[] DEFAULT '{}';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pin         text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS position    text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS start_date  date;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS notes       text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS invited_by  text;

-- full_name is NOT NULL in the new schema, but the app inserts `name`.
-- Drop the constraint and let the sync trigger below keep both populated.
ALTER TABLE public.staff ALTER COLUMN full_name DROP NOT NULL;

-- ── 2. Backfill so existing rows have both naming conventions ──────────────────
UPDATE public.staff SET name       = full_name WHERE name       IS NULL AND full_name IS NOT NULL;
UPDATE public.staff SET full_name  = name      WHERE full_name  IS NULL AND name      IS NOT NULL;
UPDATE public.staff SET user_email = email     WHERE user_email IS NULL AND email     IS NOT NULL;
UPDATE public.staff SET email      = user_email WHERE email     IS NULL AND user_email IS NOT NULL;

-- ── 3. Keep name↔full_name and email↔user_email in sync on write ───────────────
CREATE OR REPLACE FUNCTION public.sync_staff_name_email()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.full_name  := COALESCE(NEW.full_name,  NEW.name);
  NEW.name       := COALESCE(NEW.name,       NEW.full_name);
  NEW.email      := COALESCE(NEW.email,      NEW.user_email);
  NEW.user_email := COALESCE(NEW.user_email, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_sync_name_email ON public.staff;
CREATE TRIGGER staff_sync_name_email
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_name_email();

-- ── 4. Unique (store_id, user_email) — required by the POST upsert onConflict ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_store_user_email_unique'
  ) THEN
    ALTER TABLE public.staff
      ADD CONSTRAINT staff_store_user_email_unique UNIQUE (store_id, user_email);
  END IF;
END $$;

-- ── 5. Reload PostgREST schema cache ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

SELECT 'Staff module compatibility columns installed on public.staff' AS status;
