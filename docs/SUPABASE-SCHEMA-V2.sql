-- ===================================================
-- FUFU Partner Platform – Supabase Schema V2
-- Complete DDL with tables, RLS policies, indexes
-- ===================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================
-- 1. PARTNERS (Business entities registered on FUFU)
-- ===================================================
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('vet_clinic', 'pet_shop', 'pet_hotel', 'pet_grooming', 'other')),
  tax_id TEXT,
  branch_no TEXT DEFAULT 'สำนักงานใหญ่',
  phone TEXT,
  email TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  logo_url TEXT,
  rating NUMERIC(2,1) DEFAULT 0.0,
  review_count INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  working_hours JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 2. STORES (Physical locations under a partner)
-- ===================================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 3. USERS (Staff accounts within a partner)
-- ===================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE, -- Links to Supabase Auth
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'vet', 'reception', 'staff', 'accountant', 'admin')),
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 4. PET OWNERS (Public users / customers)
-- ===================================================
CREATE TABLE IF NOT EXISTS pet_owners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  line_id TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 5. PETS
-- ===================================================
CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES pet_owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT DEFAULT 'dog' CHECK (species IN ('dog', 'cat', 'rabbit', 'bird', 'hamster', 'reptile', 'other')),
  breed TEXT,
  color TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'unknown')),
  date_of_birth DATE,
  weight NUMERIC(6,2),
  microchip_id TEXT,
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 6. APPOINTMENTS / QUEUE
-- ===================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES pet_owners(id) ON DELETE SET NULL,
  queue_number TEXT,
  service_type TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'vip', 'emergency')),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'done', 'cancelled', 'noshow')),
  notes TEXT,
  estimated_duration_min INT DEFAULT 30,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 7. MEDICAL RECORDS
-- ===================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  record_type TEXT DEFAULT 'OPD' CHECK (record_type IN ('OPD', 'IPD')),
  symptoms TEXT,
  diagnosis TEXT,
  treatment TEXT,
  medications TEXT,
  lab_results JSONB DEFAULT '{}',
  attachments TEXT[], -- URLs to uploaded files
  vet_id UUID REFERENCES users(id),
  admit_date DATE,
  discharge_date DATE,
  cost NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'completed', 'admitted', 'discharged')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 8. VACCINATIONS
-- ===================================================
CREATE TABLE IF NOT EXISTS vaccinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  dose_number INT DEFAULT 1,
  dose_date DATE NOT NULL,
  next_due_date DATE,
  lot_number TEXT,
  manufacturer TEXT,
  vet_id UUID REFERENCES users(id),
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 9. PRODUCTS / SERVICES
-- ===================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'medicine', 'vaccine', 'supply', 'lab', 'service', 'grooming', 'room'
  sku TEXT,
  cost_price NUMERIC(10,2) DEFAULT 0,
  sell_price NUMERIC(10,2) NOT NULL,
  unit TEXT DEFAULT 'ชิ้น',
  stock INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  expiry_date DATE,
  supplier_id UUID REFERENCES suppliers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 10. SUPPLIERS
-- ===================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 11. INVENTORY MOVEMENTS (Stock log)
-- ===================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUST', 'EXPIRED', 'AUDIT')),
  quantity INT NOT NULL,
  reason TEXT,
  reference_id TEXT, -- PO number, appointment ID, etc.
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 12. TRANSACTIONS / PAYMENTS
-- ===================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id),
  owner_id UUID REFERENCES pet_owners(id),
  invoice_number TEXT,
  description TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  vat_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'promptpay', 'card', 'transfer', 'voucher', 'mixed')),
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'deposit', 'refunded', 'cancelled', 'partial')),
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  refund_reason TEXT,
  commission_rate NUMERIC(4,3) DEFAULT 0.08,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  processed_by UUID REFERENCES users(id),
  paid_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 13. INVOICES (Thai tax invoice/receipt records)
-- ===================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  invoice_type TEXT DEFAULT 'invoice' CHECK (invoice_type IN ('invoice', 'receipt', 'tax_invoice', 'credit_note')),
  invoice_number TEXT NOT NULL,
  seller_info JSONB NOT NULL,
  buyer_info JSONB NOT NULL,
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2),
  vat_amount NUMERIC(10,2),
  total NUMERIC(10,2),
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 14. ROOMS (Pet hotel rooms)
-- ===================================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_type TEXT DEFAULT 'standard' CHECK (room_type IN ('standard', 'deluxe', 'suite', 'play_area')),
  price_per_night NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning')),
  current_pet_id UUID REFERENCES pets(id),
  current_booking_id UUID REFERENCES appointments(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 15. CARE LOGS (Daily care for hotel stays)
-- ===================================================
CREATE TABLE IF NOT EXISTS care_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  feeding_notes TEXT,
  behavior_notes TEXT,
  health_notes TEXT,
  photo_urls TEXT[],
  logged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- 16. REVIEWS
-- ===================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES pet_owners(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================================
-- INDEXES
-- ===================================================
CREATE INDEX idx_stores_partner ON stores(partner_id);
CREATE INDEX idx_users_partner ON users(partner_id);
CREATE INDEX idx_users_store ON users(store_id);
CREATE INDEX idx_appointments_store ON appointments(store_id);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_medical_records_pet ON medical_records(pet_id);
CREATE INDEX idx_medical_records_store ON medical_records(store_id);
CREATE INDEX idx_vaccinations_pet ON vaccinations(pet_id);
CREATE INDEX idx_vaccinations_next_due ON vaccinations(next_due_date);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_transactions_store ON transactions(store_id);
CREATE INDEX idx_transactions_paid ON transactions(paid_at);
CREATE INDEX idx_rooms_store ON rooms(store_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_reviews_partner ON reviews(partner_id);
CREATE INDEX idx_pets_owner ON pets(owner_id);

-- ===================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===================================================
-- Enable RLS on all tables
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Partner staff can only see their own partner's data
CREATE POLICY "Users can view own partner" ON partners
  FOR SELECT USING (
    id IN (SELECT partner_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Staff can view stores in their partner
CREATE POLICY "Staff can view partner stores" ON stores
  FOR SELECT USING (
    partner_id IN (SELECT partner_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Staff can view appointments in their store
CREATE POLICY "Staff can view store appointments" ON appointments
  FOR SELECT USING (
    store_id IN (SELECT store_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Staff can insert appointments in their store
CREATE POLICY "Staff can create appointments" ON appointments
  FOR INSERT WITH CHECK (
    store_id IN (SELECT store_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Vets and owners can view medical records in their store
CREATE POLICY "Staff can view store records" ON medical_records
  FOR SELECT USING (
    store_id IN (SELECT store_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Staff can view products in their store
CREATE POLICY "Staff can view store products" ON products
  FOR SELECT USING (
    store_id IN (SELECT store_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Staff can view transactions in their store
CREATE POLICY "Staff can view store transactions" ON transactions
  FOR SELECT USING (
    store_id IN (SELECT store_id FROM users WHERE auth_user_id = auth.uid())
  );

-- ===================================================
-- TRIGGERS (auto-update timestamps)
-- ===================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_partners_updated BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pets_updated BEFORE UPDATE ON pets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_medical_records_updated BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
