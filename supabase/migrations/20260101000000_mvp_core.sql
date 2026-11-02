-- FUFU MVP canonical schema.
-- This migration intentionally sorts before the legacy staff migration so a
-- fresh staging project can be created only from supabase/migrations.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  avatar_url text,
  locale text not null default 'th' check (locale in ('th', 'en')),
  plan_type text not null default 'Free Plan',
  is_partner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  owner_email text,
  name text not null check (char_length(trim(name)) between 2 and 160),
  category text not null default 'vet_clinic'
    check (category in ('vet_clinic', 'vet_hospital')),
  phone text,
  address text,
  province text,
  district text,
  description text,
  website text,
  logo_url text,
  location_lat double precision check (location_lat between -90 and 90),
  location_lng double precision check (location_lng between -180 and 180),
  business_hours jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  nickname text,
  email text,
  phone text,
  avatar_url text,
  role text not null default 'staff'
    check (role in ('owner','manager','veterinarian','receptionist','pharmacist','groomer','staff')),
  masking_level integer not null default 1 check (masking_level between 1 and 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_store_id_email_unique unique (store_id, email)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  color text default '#6B7280',
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  species text not null check (species in ('dog','cat','rabbit','bird','other')),
  breed text,
  dob date check (dob is null or dob <= current_date),
  age double precision check (age is null or age >= 0),
  weight_kg numeric(7,2) check (weight_kg is null or weight_kg > 0),
  gender text check (gender is null or gender in ('Male','Female','Neutered Male','Spayed Female','male','female','unknown')),
  microchip_no text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, microchip_no)
);

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  record_type text not null default 'Checkup'
    check (record_type in ('Vaccine','Checkup','Treatment','Surgery','Other')),
  title text not null check (char_length(trim(title)) between 1 and 200),
  date date not null default current_date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  vaccine_name text not null check (char_length(trim(vaccine_name)) between 1 and 200),
  date_administered timestamptz not null,
  next_due_date timestamptz,
  veterinarian text,
  location text,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (next_due_date is null or next_due_date >= date_administered)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  pet_name text not null,
  category text not null default 'Vet' check (category = 'Vet'),
  services text[] not null default '{}'::text[],
  appt_date date not null,
  appt_time_slot text not null,
  appt_time time,
  drop_off_method text check (drop_off_method is null or drop_off_method in ('At Shop','Store Pick-up')),
  status text not null default 'Pending'
    check (status in ('Pending','Confirmed','Rejected','Completed','Cancelled','NoShow')),
  notes text,
  reject_reason text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  body_part text not null,
  result text,
  diagnosis text,
  confidence double precision check (confidence is null or confidence between 0 and 1),
  status text not null default 'pending',
  image_url text,
  model_version text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','rejected')),
  request_id uuid not null default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_code text
);

create unique index if not exists account_deletion_one_open_request
  on public.account_deletion_requests (user_id)
  where status in ('pending','processing');
create index if not exists pets_user_id_idx on public.pets(user_id);
create index if not exists health_records_pet_date_idx on public.health_records(pet_id, date desc);
create index if not exists vaccinations_pet_due_idx on public.vaccinations(pet_id, next_due_date);
create index if not exists stores_discovery_idx on public.stores(is_active, is_verified, province, district);
create index if not exists appointments_user_date_idx on public.appointments(user_id, appt_date, status);
create index if not exists appointments_store_date_idx on public.appointments(store_id, appt_date, status);
create index if not exists scan_results_user_pet_idx on public.scan_results(user_id, pet_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','stores','staff','pets','health_records','vaccinations','appointments']
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
  end loop;
end $$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();
