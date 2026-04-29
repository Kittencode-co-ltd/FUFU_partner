-- ─── Inventory Migration ────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor before using the Inventory module

-- 1. Add missing columns to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category      TEXT DEFAULT 'medicine',
  ADD COLUMN IF NOT EXISTS unit          TEXT DEFAULT 'ชิ้น',
  ADD COLUMN IF NOT EXISTS cost_price    INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sell_price    INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icon          TEXT DEFAULT '📦',
  ADD COLUMN IF NOT EXISTS reorder_point INT  DEFAULT 10,
  ADD COLUMN IF NOT EXISTS reorder_qty   INT  DEFAULT 50,
  ADD COLUMN IF NOT EXISTS supplier_id   UUID;

-- 2. Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL,
  name       TEXT NOT NULL,
  contact    TEXT,
  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create inventory_batches table
CREATE TABLE IF NOT EXISTS inventory_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL,
  product_id    UUID NOT NULL REFERENCES products(id),
  lot_number    TEXT NOT NULL DEFAULT 'LOT-001',
  quantity      INT  NOT NULL DEFAULT 0,
  initial_qty   INT  NOT NULL DEFAULT 0,
  expiry_date   DATE,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cost_price    INT,
  supplier_id   UUID,
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_fefo
  ON inventory_batches (product_id, is_active, expiry_date ASC NULLS LAST);

-- 4. Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL,
  product_id     UUID NOT NULL REFERENCES products(id),
  batch_id       UUID REFERENCES inventory_batches(id),
  movement_type  TEXT NOT NULL,
  quantity       INT  NOT NULL,
  reference_type TEXT,
  reference_id   UUID,
  reason         TEXT,
  performed_by   TEXT DEFAULT 'staff',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';
