-- ============================================================
-- FUFU Database Rebuild — Step 3: Create clean schema
-- Run AFTER step 02 (drop). Tables created in dependency order.
-- ============================================================

-- ── Core user/auth tables ─────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text UNIQUE,
  full_name    text,
  phone        text,
  avatar_url   text,
  plan_type    text NOT NULL DEFAULT 'Free Plan'
                 CHECK (plan_type IN ('Free Plan','Premium Plan','Pro Plan')),
  is_partner   boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE public.stores (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid REFERENCES auth.users(id),
  owner_email           text,
  name                  text NOT NULL,
  category              text,
  partner_type          text DEFAULT 'vet_clinic'
                          CHECK (partner_type IN ('vet_clinic','pet_shop','pet_hotel','pet_grooming')),
  phone                 text,
  address               text,
  description           text,
  website               text,
  logo_url              text,
  theme_color           text DEFAULT '#0D9488',
  location_lat          double precision,
  location_lng          double precision,
  opening_hours         text,
  business_hours        jsonb DEFAULT '{"mon":{"open":"08:00","close":"17:00","closed":false},"tue":{"open":"08:00","close":"17:00","closed":false},"wed":{"open":"08:00","close":"17:00","closed":false},"thu":{"open":"08:00","close":"17:00","closed":false},"fri":{"open":"08:00","close":"17:00","closed":false},"sat":{"open":"08:00","close":"12:00","closed":false},"sun":{"open":null,"close":null,"closed":true}}'::jsonb,
  default_service_rates jsonb DEFAULT '{"general_exam":200,"vaccine":300,"blood_test":500,"dental":1500,"surgery":2000}'::jsonb,
  tax_id                text,
  receipt_header_note   text,
  total_revenue         numeric DEFAULT 0,
  is_verified           boolean DEFAULT false,
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE public.staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id),
  full_name     text NOT NULL,
  nickname      text,
  email         text,
  phone         text,
  role          text NOT NULL DEFAULT 'staff'
                  CHECK (role IN ('owner','manager','veterinarian','pharmacist','groomer','receptionist','staff')),
  masking_level integer NOT NULL DEFAULT 1 CHECK (masking_level BETWEEN 1 AND 3),
  avatar_url    text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text DEFAULT '#6B7280',
  permissions jsonb NOT NULL DEFAULT '{"ipd":["view"],"opd":["view"],"queue":["view"],"stock":[],"finance":[],"settings":[]}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.staff_roles (
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  role_id  uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, role_id)
);

CREATE TABLE public.staff_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  permission text NOT NULL,
  can_read   boolean DEFAULT true,
  can_write  boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.pet_owners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id),
  name         text NOT NULL,
  phone        text,
  email        text,
  line_id      text,
  address      text,
  push_token   text,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- pets: dual-ownership — mobile user (user_id) OR clinic patient (store_id)
CREATE TABLE public.pets (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid REFERENCES auth.users(id),
  owner_id     uuid REFERENCES public.pet_owners(id),
  store_id     uuid REFERENCES public.stores(id),
  name         text NOT NULL,
  species      text NOT NULL DEFAULT 'dog'
                 CHECK (species IN ('dog','cat','rabbit','bird','other')),
  breed        text,
  dob          date,
  age          double precision,
  weight_kg    numeric,
  gender       text,
  color        text,
  microchip_no text,
  is_neutered  boolean DEFAULT false,
  allergies    text,
  notes        text,
  avatar_url   text,
  hn           integer,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE public.customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  full_name       text NOT NULL,
  phone           text,
  email           text,
  address         text,
  province        text,
  membership_tier text DEFAULT 'none'
                    CHECK (membership_tier IN ('none','silver','gold','platinum')),
  total_spent     numeric DEFAULT 0,
  points          integer DEFAULT 0,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE public.notifications (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  icon       text,
  category   text DEFAULT 'System',
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ── Appointments & Queue ──────────────────────────────────────────────────

CREATE TABLE public.appointments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  owner_id          uuid REFERENCES public.pet_owners(id),
  pet_id            uuid REFERENCES public.pets(id),
  store_id          uuid REFERENCES public.stores(id),
  pet_name          text NOT NULL,
  category          text CHECK (category IN ('Vet','Grooming','Hotel','Shop')),
  services          text[],
  service_type      text DEFAULT 'ตรวจทั่วไป',
  appt_date         date NOT NULL,
  appt_time_slot    text NOT NULL,
  appt_time         time,
  drop_off_method   text CHECK (drop_off_method IN ('At Shop','Store Pick-up')),
  status            text DEFAULT 'Pending'
                      CHECK (status IN ('Pending','Confirmed','Cancelled','Completed')),
  queue_entry_id    uuid,
  notes             text,
  created_by        text,
  reminder_24h_sent boolean DEFAULT false,
  reminder_1h_sent  boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE public.queue_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  appointment_id    uuid REFERENCES public.appointments(id),
  customer_id       uuid REFERENCES public.customers(id),
  pet_id            uuid REFERENCES public.pets(id),
  queue_number      integer NOT NULL,
  queue_date        date DEFAULT CURRENT_DATE,
  service_type      text,
  priority          text DEFAULT 'normal' CHECK (priority IN ('normal','urgent','emergency')),
  source            text DEFAULT 'walk_in' CHECK (source IN ('walk_in','app_booking','phone')),
  status            text DEFAULT 'waiting'
                      CHECK (status IN ('waiting','called','in_progress','completed','no_show','cancelled')),
  assigned_staff_id uuid REFERENCES public.staff(id),
  estimated_time    integer DEFAULT 30,
  called_at         timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

-- Back-reference from appointments → queue_entries (circular; added after both tables exist)
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_queue_entry_id_fkey
  FOREIGN KEY (queue_entry_id) REFERENCES public.queue_entries(id);

-- ── Medical / Health ──────────────────────────────────────────────────────

CREATE TABLE public.medical_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  pet_id           uuid REFERENCES public.pets(id),
  owner_id         uuid REFERENCES public.pet_owners(id),
  customer_id      uuid REFERENCES public.customers(id),
  vet_staff_id     uuid REFERENCES public.staff(id),
  created_by       uuid REFERENCES public.staff(id),
  updated_by       uuid REFERENCES public.staff(id),
  deleted_by       uuid REFERENCES public.staff(id),
  record_type      text DEFAULT 'opd' CHECK (record_type IN ('opd','ipd','followup')),
  visit_date       timestamptz DEFAULT now(),
  pet_name         text,
  owner_name       text,
  species          text DEFAULT 'dog',
  subjective       text,
  objective        text,
  assessment       text,
  plan             text,
  weight_kg        numeric,
  temperature_c    numeric,
  heart_rate       integer,
  respiratory_rate integer,
  vitals           jsonb,
  diagnosis        text,
  treatment        text,
  prescriptions    jsonb DEFAULT '[]'::jsonb,
  lab_results      jsonb DEFAULT '[]'::jsonb,
  medical_images   jsonb DEFAULT '[]'::jsonb,
  body_map_data    jsonb DEFAULT '[]'::jsonb,
  next_appointment date,
  notes            text,
  status           text DEFAULT 'open'
                     CHECK (status IN ('open','in_progress','completed','cancelled')),
  deleted_at       timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- health_records: mobile user-entered health logs (was missing from old schema)
CREATE TABLE public.health_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id      uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  record_type text DEFAULT 'Checkup'
                CHECK (record_type IN ('Vaccine','Checkup','Treatment','Surgery','Other')),
  title       text NOT NULL,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- vaccinations: mobile user-entered vaccination log
CREATE TABLE public.vaccinations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id            uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name      text NOT NULL,
  date_administered timestamptz NOT NULL,
  next_due_date     timestamptz,
  veterinarian      text,
  location          text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- pet_vaccinations: clinic-recorded vaccinations with batch tracking
CREATE TABLE public.pet_vaccinations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id        uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  store_id      uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  vaccine_name  text NOT NULL,
  given_date    date NOT NULL DEFAULT CURRENT_DATE,
  next_due_date date,
  batch_no      text,
  vet_name      text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- scan_results: AI body scan results (mobile)
CREATE TABLE public.scan_results (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id     uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  body_part  text NOT NULL,
  diagnosis  text,
  confidence double precision,
  status     text DEFAULT 'pending',
  image_url  text,
  notes      text,
  created_at timestamptz DEFAULT now()
);

-- ── IPD (Hospitalization) ─────────────────────────────────────────────────

CREATE TABLE public.ipd_cages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cage_number text NOT NULL,
  cage_type   text DEFAULT 'standard'
                CHECK (cage_type IN ('standard','large','icu','isolation')),
  floor       integer DEFAULT 1,
  position_x  integer DEFAULT 0,
  position_y  integer DEFAULT 0,
  status      text DEFAULT 'available'
                CHECK (status IN ('available','occupied','maintenance','reserved')),
  daily_rate  numeric DEFAULT 0,
  qr_code     text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.ipd_admissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  medical_record_id uuid REFERENCES public.medical_records(id),
  cage_id           uuid REFERENCES public.ipd_cages(id),
  pet_id            uuid REFERENCES public.pets(id),
  customer_id       uuid REFERENCES public.customers(id),
  pet_name          text,
  owner_name        text,
  species           text DEFAULT 'dog',
  admission_reason  text,
  daily_rate        numeric DEFAULT 500,
  admitted_at       timestamptz DEFAULT now(),
  discharged_at     timestamptz,
  belongings_log    jsonb DEFAULT '[]'::jsonb,
  belongings_photos text[] DEFAULT '{}',
  daily_notes       text,
  total_cost        numeric DEFAULT 0,
  status            text DEFAULT 'admitted'
                      CHECK (status IN ('admitted','discharged','transferred')),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE public.ipd_treatments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id   uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  store_id       uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  treatment_time text NOT NULL,
  treatment_type text DEFAULT 'medication',
  description    text,
  dosage         text,
  status         text DEFAULT 'pending',
  completed_by   text,
  eat_status     text,
  poop_status    text,
  pee_status     text,
  notes          text,
  completed_at   timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE public.ipd_vitals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id     uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  store_id         uuid REFERENCES public.stores(id),
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  recorded_by      text,
  temperature      numeric,
  heart_rate       integer,
  respiratory_rate integer,
  weight_kg        numeric,
  pain_score       integer CHECK (pain_score BETWEEN 0 AND 10),
  notes            text,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE public.treatment_sheets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id   uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  staff_id       uuid REFERENCES public.staff(id),
  completed_by   uuid REFERENCES public.staff(id),
  treatment_time timestamptz NOT NULL,
  treatment_type text CHECK (treatment_type IN ('medication','feeding','vitals','observation','procedure')),
  description    text,
  dosage         text,
  eat_status     text CHECK (eat_status IN ('normal','poor','none',NULL)),
  poop_status    text CHECK (poop_status IN ('normal','diarrhea','none',NULL)),
  pee_status     text CHECK (pee_status IN ('normal','abnormal','none',NULL)),
  notes          text,
  completed      boolean DEFAULT false,
  completed_at   timestamptz,
  created_at     timestamptz DEFAULT now()
);

-- ── Hotel & Grooming ──────────────────────────────────────────────────────

CREATE TABLE public.hotel_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  room_type   text DEFAULT 'standard'
                CHECK (room_type IN ('standard','deluxe','suite','vip')),
  max_pets    integer DEFAULT 1,
  daily_rate  numeric DEFAULT 0,
  floor       integer DEFAULT 1,
  position_x  integer DEFAULT 0,
  position_y  integer DEFAULT 0,
  amenities   text[] DEFAULT '{}',
  status      text DEFAULT 'available'
                CHECK (status IN ('available','occupied','cleaning','maintenance')),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.hotel_bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  room_id             uuid REFERENCES public.hotel_rooms(id),
  pet_id              uuid REFERENCES public.pets(id),
  customer_id         uuid REFERENCES public.customers(id),
  created_by          uuid REFERENCES public.staff(id),
  pet_name            text,
  owner_name          text,
  owner_phone         text,
  species             text DEFAULT 'dog',
  check_in_date       date NOT NULL,
  check_out_date      date,
  actual_checkin_at   timestamptz,
  actual_checkout_at  timestamptz,
  nights              integer,
  belongings_log      jsonb DEFAULT '[]'::jsonb,
  belongings_photos   text[] DEFAULT '{}',
  feeding_schedule    jsonb DEFAULT '[]'::jsonb,
  special_instructions text,
  add_on_services     jsonb DEFAULT '[]'::jsonb,
  daily_notes         text[] DEFAULT '{}',
  deposit_amount      numeric DEFAULT 0,
  total_cost          numeric DEFAULT 0,
  total_amount        numeric,
  notes               text,
  status              text DEFAULT 'reserved'
                        CHECK (status IN ('reserved','checked_in','checked_out','cancelled')),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE public.grooming_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  pet_id            uuid REFERENCES public.pets(id),
  pet_name          text,
  owner_name        text,
  species           text DEFAULT 'dog',
  services          jsonb DEFAULT '[]'::jsonb,
  groomer_name      text,
  estimated_minutes integer DEFAULT 60,
  start_time        timestamptz,
  end_time          timestamptz,
  status            text DEFAULT 'waiting'
                      CHECK (status IN ('waiting','in_progress','done','cancelled')),
  progress          integer DEFAULT 0,
  health_report     jsonb,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE public.grooming_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  queue_entry_id   uuid REFERENCES public.queue_entries(id),
  pet_id           uuid REFERENCES public.pets(id),
  customer_id      uuid REFERENCES public.customers(id),
  groomer_id       uuid REFERENCES public.staff(id),
  services         text[] DEFAULT '{}',
  special_requests text,
  skin_condition   text,
  ear_condition    text,
  nail_condition   text,
  flea_tick_found  boolean DEFAULT false,
  health_notes     text,
  refer_to_vet     boolean DEFAULT false,
  referral_reason  text,
  before_photo_url text,
  after_photo_url  text,
  started_at       timestamptz,
  completed_at     timestamptz,
  status           text DEFAULT 'pending'
                     CHECK (status IN ('pending','in_progress','completed','cancelled')),
  created_at       timestamptz DEFAULT now()
);

-- ── Inventory & Finance ───────────────────────────────────────────────────

CREATE TABLE public.suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name       text NOT NULL,
  contact    text,
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name          text NOT NULL,
  category      text DEFAULT 'product'
                  CHECK (category IN ('product','medicine','vaccine','service','grooming','hotel','food','accessory')),
  sku           text,
  barcode       text,
  unit          text DEFAULT 'ชิ้น',
  cost_price    numeric DEFAULT 0,
  sell_price    numeric DEFAULT 0,
  stock_qty     integer DEFAULT 0,
  reorder_point integer DEFAULT 5,
  reorder_qty   integer,
  is_active     boolean DEFAULT true,
  photo_url     text,
  icon          text DEFAULT '📦',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE public.inventory_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id       uuid REFERENCES public.suppliers(id),
  lot_number        text NOT NULL DEFAULT 'LOT-000',
  batch_number      text,
  quantity          integer NOT NULL DEFAULT 0,
  initial_qty       integer NOT NULL DEFAULT 0,
  manufactured_date date,
  expiry_date       date,
  cost_per_unit     numeric DEFAULT 0,
  received_date     date DEFAULT CURRENT_DATE,
  supplier          text,
  is_active         boolean DEFAULT true,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE public.stock_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES public.products(id),
  batch_id       uuid REFERENCES public.inventory_batches(id),
  movement_type  text NOT NULL,
  quantity       integer NOT NULL,
  reference_type text,
  reference_id   uuid,
  reason         text,
  performed_by   text DEFAULT 'staff',
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE public.service_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name       text NOT NULL,
  category   text NOT NULL DEFAULT 'other',
  price      numeric DEFAULT 0,
  unit       text DEFAULT 'ครั้ง',
  is_active  boolean DEFAULT true,
  is_default boolean DEFAULT false,
  use_count  integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- orders: mobile e-commerce orders; store_id nullable (mobile-only orders have no store)
CREATE TABLE public.orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id         uuid REFERENCES public.stores(id),
  delivery_method  text CHECK (delivery_method IN ('Store Pick-up','Home Delivery')),
  delivery_address text,
  total_amount     numeric NOT NULL,
  delivery_fee     numeric DEFAULT 0,
  status           text DEFAULT 'Preparing',
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE public.order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity     integer DEFAULT 1,
  price        numeric NOT NULL
);

CREATE TABLE public.invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  queue_entry_id    uuid REFERENCES public.queue_entries(id),
  medical_record_id uuid REFERENCES public.medical_records(id),
  pet_name          text,
  owner_name        text,
  invoice_number    text,
  line_items        jsonb DEFAULT '[]'::jsonb,
  subtotal          numeric DEFAULT 0,
  discount          numeric DEFAULT 0,
  discount_type     text NOT NULL DEFAULT 'amount' CHECK (discount_type IN ('amount','percent')),
  vat_rate          integer NOT NULL DEFAULT 0,
  vat_amount        numeric NOT NULL DEFAULT 0,
  total             numeric DEFAULT 0,
  payment_method    text DEFAULT 'cash',
  payment_reference text,
  status            text DEFAULT 'paid' CHECK (status IN ('paid','draft','voided')),
  created_by        text,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE public.transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id       uuid REFERENCES public.customers(id),
  medical_record_id uuid REFERENCES public.medical_records(id),
  created_by        uuid REFERENCES public.staff(id),
  invoice_number    text,
  items             jsonb DEFAULT '[]'::jsonb,
  subtotal          numeric DEFAULT 0,
  discount          numeric DEFAULT 0,
  vat_rate          integer NOT NULL DEFAULT 0,
  vat_amount        numeric NOT NULL DEFAULT 0,
  total             numeric DEFAULT 0,
  payment_method    text DEFAULT 'cash'
                      CHECK (payment_method IN ('cash','promptpay','card','transfer','voucher','app')),
  payment_status    text DEFAULT 'pending'
                      CHECK (payment_status IN ('pending','paid','partial','refunded','cancelled')),
  deposit_amount    numeric DEFAULT 0,
  commission_rate   numeric DEFAULT 0.05,
  commission_amount numeric DEFAULT 0,
  receipt_url       text,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE public.expenses (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id               uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  expense_date           date NOT NULL DEFAULT CURRENT_DATE,
  category               text NOT NULL DEFAULT 'other',
  amount                 numeric NOT NULL CHECK (amount >= 0),
  description            text,
  receipt_note           text,
  created_by             text,
  withholding_tax_rate   numeric DEFAULT 0,
  withholding_tax_amount numeric DEFAULT 0,
  vat_included           boolean DEFAULT false,
  vat_amount             numeric DEFAULT 0,
  tax_document_id        text,
  payee_name             text,
  payee_tax_id           text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- ── Documents, Templates, Tasks ───────────────────────────────────────────

CREATE TABLE public.soap_templates (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id             uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  category             text NOT NULL DEFAULT 'disease',
  subjective_template  text,
  objective_template   text,
  assessment_template  text,
  plan_template        text,
  preset_prescriptions jsonb DEFAULT '[]'::jsonb,
  use_count            integer NOT NULL DEFAULT 0,
  is_active            boolean NOT NULL DEFAULT true,
  created_by           text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE TABLE public.documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  medical_record_id uuid REFERENCES public.medical_records(id),
  customer_id       uuid REFERENCES public.customers(id),
  created_by        uuid REFERENCES public.staff(id),
  doc_type          text NOT NULL
                      CHECK (doc_type IN ('consent','lab_report','referral','receipt','tax_invoice','prescription','certificate')),
  doc_number        text,
  title             text,
  content           jsonb DEFAULT '{}'::jsonb,
  template_theme    text DEFAULT 'navy',
  signature_url     text,
  pdf_url           text,
  status            text DEFAULT 'draft'
                      CHECK (status IN ('draft','signed','finalized','voided')),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.staff(id),
  created_by  uuid REFERENCES public.staff(id),
  title       text NOT NULL,
  description text,
  status      text DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority    text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_date    date,
  tags        text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- audit_logs: INSERT-ONLY — never UPDATE or DELETE rows
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid REFERENCES public.stores(id),
  staff_id    uuid REFERENCES public.staff(id),
  action      text NOT NULL
                CHECK (action IN ('create','update','delete','view_sensitive','login','logout','export','unmask')),
  entity_type text NOT NULL,
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  reason      text,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz DEFAULT now()
);

SELECT 'Schema created successfully — ' || COUNT(*) || ' tables' AS status
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
