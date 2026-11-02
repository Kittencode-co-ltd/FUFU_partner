-- ============================================================
-- 07_rewards.sql — FUFU Reward System tables
-- Run in Supabase SQL editor (or via migrate.js)
-- ============================================================

-- 1. user_coins: stores current coin balance per user
CREATE TABLE IF NOT EXISTS public.user_coins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_coins: owner full access"
  ON public.user_coins
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. coin_transactions: immutable audit trail for every earn/spend
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('checkin','weekly_spin','ad_spin','redeem')),
  amount     INT         NOT NULL,   -- positive = earned, negative = spent
  ref_id     TEXT,                   -- reward_type or redemption id
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coin_transactions: owner read"
  ON public.coin_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "coin_transactions: owner insert"
  ON public.coin_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. user_streaks: tracks daily check-in streak and spin availability
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id             UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak      INT     NOT NULL DEFAULT 0,
  last_checkin_date   DATE,
  weekly_spin_ready   BOOLEAN DEFAULT FALSE,
  ad_spins_today      INT     NOT NULL DEFAULT 0,
  ad_spins_reset_at   DATE
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_streaks: owner full access"
  ON public.user_streaks
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. reward_redemptions: records every item a user redeems
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT        NOT NULL,
  coins_spent INT         NOT NULL,
  status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','applied','expired')),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_redemptions: owner full access"
  ON public.reward_redemptions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
