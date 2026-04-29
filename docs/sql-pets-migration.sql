-- ─── Pet Profile Migration ──────────────────────────────────────────────────
-- Designed to support both Partner Portal and future Mobile App
-- Run in Supabase SQL Editor

-- 1. Pet Owners (เจ้าของสัตว์เลี้ยง)
-- Separate from Supabase Auth users — owners don't need a login on partner portal
-- Mobile app will link owner_id to auth.users later
CREATE TABLE IF NOT EXISTS pet_owners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  line_id       TEXT,
  address       TEXT,
  notes         TEXT,
  -- Mobile app fields (populated when owner registers on app)
  auth_user_id  UUID,             -- links to auth.users when owner has app account
  push_token    TEXT,             -- FCM/APNS token for notifications
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_owners_phone ON pet_owners(phone);
CREATE INDEX IF NOT EXISTS idx_pet_owners_email ON pet_owners(email);

-- 2. Pets (สัตว์เลี้ยง) — global, not store-specific
CREATE TABLE IF NOT EXISTS pets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES pet_owners(id),
  name          TEXT NOT NULL,
  species       TEXT NOT NULL DEFAULT 'dog',  -- dog|cat|rabbit|bird|other
  breed         TEXT,
  gender        TEXT DEFAULT 'unknown',        -- male|female|unknown
  dob           DATE,                          -- วันเกิด
  color         TEXT,
  weight_kg     NUMERIC,                       -- น้ำหนักล่าสุด (updated each visit)
  microchip_no  TEXT,
  is_neutered   BOOLEAN DEFAULT FALSE,
  allergies     TEXT,                          -- แพ้ยา/อาหาร
  notes         TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pets_owner_id ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_pets_name     ON pets(name);

-- 3. Vaccinations (ประวัติวัคซีน)
CREATE TABLE IF NOT EXISTS pet_vaccinations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id        UUID NOT NULL REFERENCES pets(id),
  store_id      UUID NOT NULL,
  vaccine_name  TEXT NOT NULL,
  given_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_date DATE,                          -- วันนัดฉีดครั้งหน้า
  batch_no      TEXT,                          -- batch ของวัคซีน
  vet_name      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Appointments (นัดหมาย)
CREATE TABLE IF NOT EXISTS appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id          UUID REFERENCES pets(id),
  store_id        UUID NOT NULL,
  appt_date       DATE NOT NULL,
  appt_time       TIME,
  service_type    TEXT DEFAULT 'ตรวจทั่วไป',
  status          TEXT DEFAULT 'scheduled',    -- scheduled|confirmed|arrived|completed|cancelled|no_show
  notes           TEXT,
  -- Links
  queue_entry_id  UUID,                        -- set when patient checks in → queue created
  medical_record_id UUID,                      -- set after OPD completed
  -- Notification tracking (for mobile app)
  reminder_24h_sent  BOOLEAN DEFAULT FALSE,
  reminder_1h_sent   BOOLEAN DEFAULT FALSE,
  created_by      TEXT,                        -- 'staff' | 'owner_app'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_store_date ON appointments(store_id, appt_date);
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id     ON appointments(pet_id);

-- 5. Link medical_records to pet_id (add column)
ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS pet_id   UUID REFERENCES pets(id),
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES pet_owners(id);

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
