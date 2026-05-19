/**
 * FUFU Mobile App Compatibility Fix
 *
 * Fixes two errors seen in FUFU Mobile (Flutter) logs:
 *
 *  1. "Could not find the table 'public.profiles' in the schema cache"
 *     → profiles was dropped as a zombie table, but mobile app uses it.
 *     → Fix: recreate profiles as a proper table synced from auth.users metadata,
 *            with a trigger that auto-populates on new user signup.
 *
 *  2. "infinite recursion detected in policy for relation 'store_staff'"
 *     → The store_staff RLS policy checks: store_id IN (SELECT store_id FROM store_staff ...)
 *     → This makes every query that touches store_staff recurse infinitely,
 *       including pets, appointments, etc. (because their policies join store_staff).
 *     → Fix: replace with a non-recursive policy that only references the stores table.
 *
 * Usage: node scripts/fix-mobile-compat.js <access_token>
 */

const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2];
if (!ACCESS_TOKEN) { console.error('Usage: node scripts/fix-mobile-compat.js <token>'); process.exit(1); }

async function sql(query, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    { method:'POST', headers:{'Authorization':`Bearer ${ACCESS_TOKEN}`,'Content-Type':'application/json'}, body:JSON.stringify({query}) }
  );
  const data = await res.json();
  if (!res.ok || data.error) { console.log(`  ❌ ${label||''}:`, data.error||data.message||JSON.stringify(data)); return null; }
  if (label) console.log(`  ✅ ${label}`);
  return data;
}

// ── Fix 1: Recreate profiles table ───────────────────────────────────────────
console.log('\n👤 Fix 1: Recreate profiles table for mobile app...');

await sql(`
  CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    phone       TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )
`, 'Create profiles table');

// Populate from existing auth.users who don't have a profile yet
await sql(`
  INSERT INTO public.profiles (id, full_name, phone, avatar_url, created_at)
  SELECT
    au.id,
    COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', '') AS full_name,
    au.raw_user_meta_data->>'phone'  AS phone,
    au.raw_user_meta_data->>'avatar_url' AS avatar_url,
    au.created_at
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
`, 'Backfill profiles from auth.users metadata');

// RLS: each user can only read/write their own profile
await sql(`
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY
`, 'Enable RLS on profiles');

await sql(`
  DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
  CREATE POLICY profiles_self_select ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid())
`, 'RLS: profiles — SELECT own row');

await sql(`
  DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
  CREATE POLICY profiles_self_insert ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid())
`, 'RLS: profiles — INSERT own row');

await sql(`
  DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
  CREATE POLICY profiles_self_update ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid())
`, 'RLS: profiles — UPDATE own row');

// Trigger: auto-create profile on new user signup
await sql(`
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
  $$
`, 'Create handle_new_user() function');

await sql(`
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
`, 'Create trigger: auto-create profile on signup');

// ── Fix 2: Repair store_staff RLS (infinite recursion) ───────────────────────
console.log('\n🔁 Fix 2: Replace recursive store_staff RLS policies...');

// Drop ALL existing store_staff policies (any name)
const existing = await sql(`
  SELECT policyname FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'store_staff'
`, null);

const existingPolicies = Array.isArray(existing) ? existing : [];
for (const { policyname } of existingPolicies) {
  await sql(
    `DROP POLICY IF EXISTS "${policyname}" ON public.store_staff`,
    `Drop store_staff."${policyname}"`
  );
}

// Recreate with non-recursive policies (only references `stores` table, not `store_staff`)
await sql(`
  CREATE POLICY store_staff_select ON public.store_staff
    FOR SELECT TO authenticated
    USING (
      -- Staff member can see their own record
      user_email = auth.email()
      -- Store owner can see all staff records for their store
      OR store_id IN (
        SELECT id FROM stores
        WHERE owner_email = auth.email() OR owner_id = auth.uid()
      )
    )
`, 'RLS store_staff: SELECT (non-recursive)');

await sql(`
  CREATE POLICY store_staff_write ON public.store_staff
    FOR ALL TO authenticated
    USING (
      store_id IN (
        SELECT id FROM stores
        WHERE owner_email = auth.email() OR owner_id = auth.uid()
      )
    )
    WITH CHECK (
      store_id IN (
        SELECT id FROM stores
        WHERE owner_email = auth.email() OR owner_id = auth.uid()
      )
    )
`, 'RLS store_staff: INSERT/UPDATE/DELETE (owner only)');

// ── Reload schema cache ───────────────────────────────────────────────────────
await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload PostgREST schema cache');

console.log(`
✅ Mobile compatibility fix complete!

Fix 1 — profiles table:
  • Recreated public.profiles (id, full_name, phone, avatar_url)
  • Backfilled from existing auth.users metadata
  • RLS: each user sees only their own row
  • Trigger: auto-creates profile on every new signup

Fix 2 — store_staff infinite recursion:
  • Dropped all old recursive policies
  • New policy uses only stores table reference (no self-join)
  • SELECT: staff sees own row + owner sees all store rows
  • WRITE: owner-only for insert/update/delete

Mobile app should now load pets, appointments, and user profile correctly.
`);
