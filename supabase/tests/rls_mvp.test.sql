begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@test.invalid', '', now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@test.invalid', '', now(), now()),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clinic-a@test.invalid', '', now(), now()),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clinic-b@test.invalid', '', now(), now());

insert into public.stores (id, owner_id, name, category, is_verified, is_active)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'Clinic A', 'vet_clinic', true, true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'Clinic B', 'vet_clinic', true, true);

insert into public.pets (id, user_id, name, species)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Pet A', 'dog'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Pet B', 'cat');

insert into public.health_records (id,user_id,pet_id,title,date)
values
  ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','A record',current_date),
  ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','B record',current_date);

insert into public.vaccinations (id,user_id,pet_id,vaccine_name,date_administered)
values
  ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','A vaccine',now()),
  ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','B vaccine',now());

insert into public.appointments (id,user_id,pet_id,store_id,pet_name,appt_date,appt_time_slot,status,starts_at,ends_at)
values
  ('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Pet A',current_date + 1,'09:00','requested',now()+interval '1 day',now()+interval '1 day 30 minutes'),
  ('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Pet B',current_date + 1,'10:00','requested',now()+interval '1 day 1 hour',now()+interval '1 day 1 hour 30 minutes');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);

select results_eq('select name from public.pets order by name', array['Pet A'], 'owner sees only own pets');
select results_eq('select title from public.health_records order by title', array['A record'], 'owner sees only own health records');
select results_eq('select vaccine_name from public.vaccinations order by vaccine_name', array['A vaccine'], 'owner sees only own vaccinations');
select results_eq('select pet_name from public.appointments order by pet_name', array['Pet A'], 'owner sees only own appointments');
select results_eq($$update public.pets set name='stolen' where id='40000000-0000-4000-8000-000000000002' returning name$$, array[]::text[], 'owner cannot update another pet');
select results_eq($$delete from public.health_records where id='50000000-0000-4000-8000-000000000002' returning title$$, array[]::text[], 'owner cannot delete another health record');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select results_eq('select pet_name from public.appointments order by pet_name', array['Pet A'], 'clinic sees only its appointments');
select results_eq($$update public.appointments set status='confirmed' where id='70000000-0000-4000-8000-000000000002' returning pet_name$$, array[]::text[], 'clinic cannot update another clinic appointment');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
select results_eq('select pet_name from public.appointments order by pet_name', array['Pet B'], 'second clinic remains isolated');
select results_eq($$delete from public.pets where id='40000000-0000-4000-8000-000000000001' returning name$$, array[]::text[], 'clinic cannot delete customer pets');

select * from finish();
rollback;
