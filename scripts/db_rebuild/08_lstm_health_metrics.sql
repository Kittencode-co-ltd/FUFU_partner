-- ============================================================
-- FUFU Database — Step 8: LSTM Health Forecast Tables
-- Creates daily_health_metrics and health_forecasts
-- Run AFTER step 07 (rewards).
-- ============================================================

-- ── daily_health_metrics ─────────────────────────────────────────────────────
-- Stores one health snapshot per pet per day.
-- Written by Flutter each time the user opens the Health Screen.

CREATE TABLE public.daily_health_metrics (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id        uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_date date NOT NULL,

  -- Final weighted score (0–100)
  health_score        int NOT NULL CHECK (health_score BETWEEN 0 AND 100),

  -- Raw factor scores used as LSTM input features (0–100 each)
  scan_score          int NOT NULL CHECK (scan_score BETWEEN 0 AND 100),
  vaccination_score   int NOT NULL CHECK (vaccination_score BETWEEN 0 AND 100),
  recency_score       int NOT NULL CHECK (recency_score BETWEEN 0 AND 100),

  -- Supporting signals
  days_since_last_scan     int,        -- NULL if never scanned
  overdue_vaccines_count   int NOT NULL DEFAULT 0,
  scan_confidence          float CHECK (scan_confidence BETWEEN 0.0 AND 1.0),
  scan_status              text CHECK (scan_status IN ('healthy','pending','treatment_needed','resolved')),
  has_appointment_upcoming boolean NOT NULL DEFAULT false,

  created_at timestamptz DEFAULT now(),

  -- One row per pet per day only
  UNIQUE (pet_id, recorded_date)
);

ALTER TABLE public.daily_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only" ON public.daily_health_metrics
  FOR ALL USING (auth.uid() = user_id);

-- Fast time-series lookup: latest N days for a pet
CREATE INDEX idx_dhm_pet_date
  ON public.daily_health_metrics (pet_id, recorded_date DESC);


-- ── health_forecasts ──────────────────────────────────────────────────────────
-- Caches the LSTM forecast API response per pet (24-hour TTL enforced in app).
-- One row per pet — overwritten on each refresh.

CREATE TABLE public.health_forecasts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id       uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),

  -- Full API response cached as JSON
  -- Shape:
  -- {
  --   "dates":      ["2026-05-23", ..., "2026-06-21"],  -- 30 days
  --   "scores":     [72, 70, 68, ..., 55],              -- predicted 0–100
  --   "trend":      "down",                             -- "up"|"down"|"stable"
  --   "delta":      -17,                                -- scores[29] - scores[0]
  --   "confidence": 0.84,                               -- model confidence 0–1
  --   "insight":    "Vaccination overdue soon may lower score"
  -- }
  forecast_json jsonb NOT NULL,

  -- One cached row per pet
  UNIQUE (pet_id)
);

ALTER TABLE public.health_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only" ON public.health_forecasts
  FOR ALL USING (auth.uid() = user_id);
