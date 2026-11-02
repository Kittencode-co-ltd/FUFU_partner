/**
 * FUFU — Reward System Migration
 * Creates: user_coins, coin_transactions, user_streaks, reward_redemptions
 * Usage: node scripts/migrate-rewards.js <access_token>
 *   OR:  node scripts/migrate-rewards.js   (reads access_token from .env)
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv needed for a simple key=value file)
const envPath = join(__dirname, '../.env');
let envToken  = '';
try {
  const envText = readFileSync(envPath, 'utf8');
  const match   = envText.match(/^access_token\s*=\s*(.+)$/m);
  if (match) envToken = match[1].trim();
} catch (_) {}

const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2] || envToken;

if (!ACCESS_TOKEN) {
  console.error('❌  No access_token found. Pass it as argument or set access_token= in .env');
  process.exit(1);
}

async function sql(query, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    console.error(`❌  ${label}: ${data.error || data.message || JSON.stringify(data)}`);
    return false;
  }
  console.log(`✅  ${label}`);
  return true;
}

// ─── 1. user_coins ────────────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS public.user_coins (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance    INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMPTZ DEFAULT now()
  )
`, 'CREATE user_coins');

await sql(`ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY`, 'RLS user_coins');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'user_coins'
        AND policyname = 'user_coins_owner_all'
    ) THEN
      CREATE POLICY user_coins_owner_all ON public.user_coins
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$
`, 'RLS policy user_coins');

// ─── 2. coin_transactions ─────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type       TEXT        NOT NULL CHECK (type IN ('checkin','weekly_spin','ad_spin','redeem')),
    amount     INT         NOT NULL,
    ref_id     TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`, 'CREATE coin_transactions');

await sql(`ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY`, 'RLS coin_transactions');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'coin_transactions'
        AND policyname = 'coin_tx_owner_select'
    ) THEN
      CREATE POLICY coin_tx_owner_select ON public.coin_transactions
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END $$
`, 'RLS policy coin_transactions SELECT');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'coin_transactions'
        AND policyname = 'coin_tx_owner_insert'
    ) THEN
      CREATE POLICY coin_tx_owner_insert ON public.coin_transactions
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$
`, 'RLS policy coin_transactions INSERT');

// ─── 3. user_streaks ──────────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id             UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak      INT     NOT NULL DEFAULT 0,
    last_checkin_date   DATE,
    weekly_spin_ready   BOOLEAN DEFAULT FALSE,
    ad_spins_today      INT     NOT NULL DEFAULT 0,
    ad_spins_reset_at   DATE
  )
`, 'CREATE user_streaks');

await sql(`ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY`, 'RLS user_streaks');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'user_streaks'
        AND policyname = 'user_streaks_owner_all'
    ) THEN
      CREATE POLICY user_streaks_owner_all ON public.user_streaks
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$
`, 'RLS policy user_streaks');

// ─── 4. reward_redemptions ────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS public.reward_redemptions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reward_type TEXT        NOT NULL,
    coins_spent INT         NOT NULL,
    status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','applied','expired')),
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now()
  )
`, 'CREATE reward_redemptions');

await sql(`ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY`, 'RLS reward_redemptions');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reward_redemptions'
        AND policyname = 'reward_redemptions_owner_all'
    ) THEN
      CREATE POLICY reward_redemptions_owner_all ON public.reward_redemptions
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$
`, 'RLS policy reward_redemptions');

// ─── Reload PostgREST schema cache ────────────────────────────────────────────

await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload schema cache');

console.log('\n🎉  Reward system migration complete!');
console.log('    Tables created: user_coins · coin_transactions · user_streaks · reward_redemptions');
