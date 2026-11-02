/**
 * FUFU — Subscription System Migration
 * Creates: user_subscriptions, subscription_events
 * Usage: node scripts/migrate-subscriptions.js
 *   (reads access_token from .env automatically)
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envText  = readFileSync(join(__dirname, '../.env'), 'utf8');
const envToken = (envText.match(/^access_token\s*=\s*(.+)$/m) ?? [])[1]?.trim() ?? '';

const PROJECT_REF  = 'crcgsnzhetwkpiwdvmau';
const ACCESS_TOKEN = process.argv[2] || envToken;

if (!ACCESS_TOKEN) {
  console.error('❌  No access_token. Pass it as argument or set access_token= in .env');
  process.exit(1);
}

async function sql(query, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
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

// ─── 1. user_subscriptions ────────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    user_id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    plan                   TEXT        NOT NULL DEFAULT 'essential',
    platform               TEXT,
    store_product_id       TEXT,
    revenuecat_customer_id TEXT,
    status                 TEXT        NOT NULL DEFAULT 'active'
                                       CHECK (status IN ('active','cancelled','expired','grace_period')),
    current_period_start   TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    cancel_at_period_end   BOOLEAN     DEFAULT FALSE,
    ai_chat_sessions_used  INT         NOT NULL DEFAULT 0,
    ai_chat_reset_at       DATE,
    updated_at             TIMESTAMPTZ DEFAULT now()
  )
`, 'CREATE user_subscriptions');

await sql(`ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY`, 'RLS user_subscriptions');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='user_subscriptions'
        AND policyname='user_subscriptions_owner_all'
    ) THEN
      CREATE POLICY user_subscriptions_owner_all ON public.user_subscriptions
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$
`, 'RLS policy user_subscriptions');

// ─── 2. subscription_events ───────────────────────────────────────────────────

await sql(`
  CREATE TABLE IF NOT EXISTS public.subscription_events (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type     TEXT        NOT NULL,
    platform       TEXT,
    product_id     TEXT,
    price_in_thb   NUMERIC(10,2),
    store_fee_rate NUMERIC(5,4),
    net_revenue    NUMERIC(10,2),
    raw_payload    JSONB,
    created_at     TIMESTAMPTZ DEFAULT now()
  )
`, 'CREATE subscription_events');

await sql(`ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY`, 'RLS subscription_events');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='subscription_events'
        AND policyname='subscription_events_owner_select'
    ) THEN
      CREATE POLICY subscription_events_owner_select ON public.subscription_events
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END $$
`, 'RLS policy subscription_events SELECT');

await sql(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='subscription_events'
        AND policyname='subscription_events_owner_insert'
    ) THEN
      CREATE POLICY subscription_events_owner_insert ON public.subscription_events
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$
`, 'RLS policy subscription_events INSERT');

// ─── 3. Reload schema ─────────────────────────────────────────────────────────

await sql(`NOTIFY pgrst, 'reload schema'`, 'Reload schema cache');

console.log('\n🎉  Subscription migration complete!');
console.log('    Tables: user_subscriptions · subscription_events');
