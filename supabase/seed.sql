-- Staging/development only. Never run this file against production.

-- Review login: review@fufu.local / Fufu2026!
-- Deterministic IDs keep repeated `supabase db reset` runs idempotent.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'review@fufu.local',
  crypt('Fufu2026!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"FUFU Reviewer","is_partner":true}'::jsonb,
  now(), now(), '', '', '', ''
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  updated_at = now();

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  '90000000-0000-4000-8000-000000000001',
  'review@fufu.local',
  '90000000-0000-4000-8000-000000000001',
  '{"sub":"90000000-0000-4000-8000-000000000001","email":"review@fufu.local","email_verified":true}'::jsonb,
  'email', now(), now(), now()
)
on conflict (provider_id, provider) do update set updated_at = now();

-- Role and tenant fixtures for API authorization checks.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000002','authenticated','authenticated','vet@fufu.local',crypt('Fufu2026!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Review Vet"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000003','authenticated','authenticated','reception@fufu.local',crypt('Fufu2026!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Review Reception"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000004','authenticated','authenticated','otherowner@fufu.local',crypt('Fufu2026!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Clinic Owner"}'::jsonb,now(),now(),'','','','')
on conflict (id) do update set
  email=excluded.email, encrypted_password=excluded.encrypted_password,
  email_confirmed_at=excluded.email_confirmed_at, updated_at=now();

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  ('90000000-0000-4000-8000-000000000002','vet@fufu.local','90000000-0000-4000-8000-000000000002','{"sub":"90000000-0000-4000-8000-000000000002","email":"vet@fufu.local","email_verified":true}'::jsonb,'email',now(),now(),now()),
  ('90000000-0000-4000-8000-000000000003','reception@fufu.local','90000000-0000-4000-8000-000000000003','{"sub":"90000000-0000-4000-8000-000000000003","email":"reception@fufu.local","email_verified":true}'::jsonb,'email',now(),now(),now()),
  ('90000000-0000-4000-8000-000000000004','otherowner@fufu.local','90000000-0000-4000-8000-000000000004','{"sub":"90000000-0000-4000-8000-000000000004","email":"otherowner@fufu.local","email_verified":true}'::jsonb,'email',now(),now(),now())
on conflict (provider_id, provider) do update set updated_at=now();

insert into public.stores (
  id, owner_id, owner_email, name, category, phone, address, province, district,
  location_lat, location_lng, business_hours, is_verified, is_active, is_test
) values
  ('10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'review@fufu.local', '[TEST] FUFU Clinic Bangkok', 'vet_clinic', '020000001', 'Test address 1', 'กรุงเทพมหานคร', 'วัฒนา', 13.7367, 100.5231, '{"mon":{"open":"09:00","close":"18:00"}}', true, true, true),
  ('10000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000004', 'otherowner@fufu.local', '[TEST] FUFU Animal Hospital', 'vet_hospital', '020000002', 'Test address 2', 'กรุงเทพมหานคร', 'จตุจักร', 13.7998, 100.5500, '{"mon":{"open":"00:00","close":"23:59"}}', true, true, true)
on conflict (id) do update set
  owner_id=excluded.owner_id, owner_email=excluded.owner_email,
  name=excluded.name, business_hours=excluded.business_hours, is_test=true;

insert into public.staff (id, store_id, user_id, full_name, email, role, is_active)
values
  ('91000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','Review Vet','vet@fufu.local','vet',true),
  ('91000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','Review Reception','reception@fufu.local','reception',true)
on conflict (store_id, email) do update set
  user_id=excluded.user_id, full_name=excluded.full_name, role=excluded.role, is_active=true, updated_at=now();

insert into public.store_business_hours (store_id,day_of_week,opens_at,closes_at,is_closed)
select '10000000-0000-4000-8000-000000000001', day, '09:00', '12:00', false
from generate_series(0,6) as day
on conflict (store_id,day_of_week) do update set opens_at=excluded.opens_at, closes_at=excluded.closes_at, is_closed=false;

insert into public.store_services (id,store_id,name,description,duration_minutes,capacity_per_slot,is_active)
values ('92000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','ตรวจสุขภาพทั่วไป','บริการตรวจรับสำหรับ automated tests',30,2,true)
on conflict (id) do update set duration_minutes=30,capacity_per_slot=2,is_active=true;

insert into public.store_holidays (id,store_id,date,reason,is_closed)
values ('92000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',current_date+2,'วันหยุดทดสอบ',true)
on conflict (store_id,date) do update set reason=excluded.reason,is_closed=true;

insert into public.pets (id,user_id,name,species)
values ('93000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Mochi','dog')
on conflict (id) do update set name=excluded.name;

insert into public.appointments (id,user_id,pet_id,store_id,service_id,pet_name,category,appt_date,appt_time_slot,status,idempotency_key,starts_at,ends_at)
values ('94000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Mochi','Vet',current_date+1,'09:00','confirmed','seed-review-appointment',((current_date+1)::text||' 09:00')::timestamp at time zone 'Asia/Bangkok',((current_date+1)::text||' 09:30')::timestamp at time zone 'Asia/Bangkok')
on conflict (id) do update set appt_date=current_date+1,appt_time_slot='09:00',status='confirmed',starts_at=excluded.starts_at,ends_at=excluded.ends_at;

insert into public.appointment_data_consents(appointment_id,user_id,store_id,allow_pet_profile,allow_health_records,allow_vaccinations,allow_scan_images)
values('94000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true,true,true,true)
on conflict(appointment_id) do update set allow_pet_profile=true,allow_health_records=true,allow_vaccinations=true,allow_scan_images=true,revoked_at=null;
