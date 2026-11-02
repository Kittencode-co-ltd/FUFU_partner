-- ============================================================
-- FUFU Database Rebuild — Step 5: Triggers and Functions
-- Run AFTER step 04 (RLS).
-- ============================================================

-- ── Auto-create profile on new user signup ───────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, plan_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    'Free Plan'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Pet count limit per subscription plan ────────────────────────────────
-- Plan limits:
--   Free Plan    → max 3 pets
--   Premium Plan → max 10 pets
--   Pro Plan     → unlimited
-- Only enforced for mobile-owned pets (user_id set); clinic patients (store_id only) are exempt.
CREATE OR REPLACE FUNCTION public.check_pet_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_plan  text;
  v_count integer;
  v_limit integer;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan_type INTO v_plan FROM profiles WHERE id = NEW.user_id;
  SELECT COUNT(*) INTO v_count FROM pets
    WHERE user_id = NEW.user_id
      AND is_active = true
      AND id IS DISTINCT FROM NEW.id;

  v_limit := CASE v_plan
    WHEN 'Free Plan'    THEN 3
    WHEN 'Premium Plan' THEN 10
    WHEN 'Pro Plan'     THEN 2147483647
    ELSE 3
  END;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Pet limit reached for plan "%": maximum % pets allowed', v_plan, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_pet_limit ON pets;
CREATE TRIGGER enforce_pet_limit
  BEFORE INSERT ON pets
  FOR EACH ROW EXECUTE FUNCTION public.check_pet_limit();

-- ── Backfill profiles for existing auth.users ─────────────────────────────
INSERT INTO public.profiles (id, email, full_name, avatar_url, plan_type)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', '') AS full_name,
  au.raw_user_meta_data->>'avatar_url' AS avatar_url,
  'Free Plan'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

-- ── Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

SELECT 'Triggers and functions created; PostgREST cache reloaded' AS status;
