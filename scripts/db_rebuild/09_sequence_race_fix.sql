-- ============================================================
-- FUFU Database — Step 9: Sequence Race-Condition Fix
-- Adds DB-level uniqueness for per-store running numbers so two
-- concurrent inserts can never produce a duplicate.
--
--   pets.hn                 — per-store running Hospital Number
--   queue_entries.queue_number — per-store, per-day running queue number
--
-- Both are generated app-side as `MAX(...) + 1`, which is not atomic:
-- two requests can read the same MAX and insert the same number. The
-- unique constraints below make that physically impossible — the second
-- insert fails with SQLSTATE 23505, and the API layer retries with a
-- freshly-read MAX (see server/routes/pets.js and queue.js).
--
-- Idempotent: safe to re-run. Run AFTER step 08.
-- ============================================================

-- ── 1. Resolve any pre-existing duplicates ────────────────────────────────────
-- Adding a UNIQUE constraint fails if duplicate rows already exist, so we first
-- renumber collisions. We keep the earliest-created row's number and push the
-- duplicates to the end of that store's sequence, preserving creation order.

-- 1a. pets.hn — renumber duplicate HNs within each store
WITH ranked AS (
  SELECT id,
         store_id,
         hn,
         ROW_NUMBER() OVER (PARTITION BY store_id, hn
                            ORDER BY created_at, id) AS rn
  FROM public.pets
  WHERE hn IS NOT NULL
),
dupes AS (
  SELECT id, store_id FROM ranked WHERE rn > 1
),
store_max AS (
  SELECT store_id, COALESCE(MAX(hn), 0) AS max_hn
  FROM public.pets
  WHERE hn IS NOT NULL
  GROUP BY store_id
),
reassigned AS (
  SELECT d.id,
         sm.max_hn
           + ROW_NUMBER() OVER (PARTITION BY d.store_id ORDER BY d.id) AS new_hn
  FROM dupes d
  JOIN store_max sm ON sm.store_id = d.store_id
)
UPDATE public.pets p
SET    hn = r.new_hn,
       updated_at = now()
FROM   reassigned r
WHERE  p.id = r.id;

-- 1b. queue_entries.queue_number — renumber duplicates within each store+day
WITH ranked AS (
  SELECT id,
         store_id,
         queue_date,
         queue_number,
         ROW_NUMBER() OVER (PARTITION BY store_id, queue_date, queue_number
                            ORDER BY created_at, id) AS rn
  FROM public.queue_entries
),
dupes AS (
  SELECT id, store_id, queue_date FROM ranked WHERE rn > 1
),
day_max AS (
  SELECT store_id, queue_date, MAX(queue_number) AS max_num
  FROM public.queue_entries
  GROUP BY store_id, queue_date
),
reassigned AS (
  SELECT d.id,
         dm.max_num
           + ROW_NUMBER() OVER (PARTITION BY d.store_id, d.queue_date ORDER BY d.id) AS new_num
  FROM dupes d
  JOIN day_max dm ON dm.store_id = d.store_id AND dm.queue_date = d.queue_date
)
UPDATE public.queue_entries q
SET    queue_number = r.new_num
FROM   reassigned r
WHERE  q.id = r.id;

-- ── 2. Add the unique constraints ─────────────────────────────────────────────
-- NULL hn (mobile-app pets that never visited a clinic) is allowed to repeat,
-- since SQL treats NULLs as distinct in a UNIQUE constraint.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pets_store_hn_unique'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT pets_store_hn_unique UNIQUE (store_id, hn);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'queue_entries_store_date_number_unique'
  ) THEN
    ALTER TABLE public.queue_entries
      ADD CONSTRAINT queue_entries_store_date_number_unique
      UNIQUE (store_id, queue_date, queue_number);
  END IF;
END $$;

-- ── 3. Reload PostgREST schema cache ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

SELECT 'Sequence race-condition guards installed (pets.hn, queue_entries.queue_number)' AS status;
