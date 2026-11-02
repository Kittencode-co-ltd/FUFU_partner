-- Phase P2: canonical clinic profile, hours, holidays and services.

alter table public.stores
  add column if not exists email text,
  add column if not exists timezone text not null default 'Asia/Bangkok',
  add column if not exists accepting_appointments boolean not null default true;

create table if not exists public.store_business_hours (
  store_id uuid not null references public.stores(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  primary key (store_id, day_of_week),
  check (is_closed or (opens_at is not null and closes_at is not null and opens_at < closes_at))
);

create table if not exists public.store_holidays (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  reason text check (reason is null or char_length(reason) <= 200),
  is_closed boolean not null default true,
  opens_at time,
  closes_at time,
  unique (store_id, date),
  check (is_closed or (opens_at is not null and closes_at is not null and opens_at < closes_at))
);

create table if not exists public.store_services (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  capacity_per_slot integer not null default 1 check (capacity_per_slot between 1 and 50),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, name)
);

alter table public.appointments
  add column if not exists service_id uuid references public.store_services(id) on delete restrict;

create index if not exists store_holidays_store_date_idx on public.store_holidays(store_id, date);
create index if not exists store_services_active_idx on public.store_services(store_id, is_active);

alter table public.store_business_hours enable row level security;
alter table public.store_holidays enable row level security;
alter table public.store_services enable row level security;
alter table public.store_business_hours force row level security;
alter table public.store_holidays force row level security;
alter table public.store_services force row level security;

create policy business_hours_public_read on public.store_business_hours for select to anon, authenticated
  using (exists (select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified));
create policy business_hours_owner_all on public.store_business_hours for all to authenticated
  using (store_id in (select id from public.stores where owner_id=auth.uid()))
  with check (store_id in (select id from public.stores where owner_id=auth.uid()));
create policy business_hours_member_read on public.store_business_hours for select to authenticated
  using (public.is_store_member(store_id));

create policy holidays_public_read on public.store_holidays for select to anon, authenticated
  using (exists (select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified));
create policy holidays_owner_all on public.store_holidays for all to authenticated
  using (store_id in (select id from public.stores where owner_id=auth.uid()))
  with check (store_id in (select id from public.stores where owner_id=auth.uid()));
create policy holidays_member_read on public.store_holidays for select to authenticated
  using (public.is_store_member(store_id));

create policy services_public_read on public.store_services for select to anon, authenticated
  using (is_active and exists (select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified));
create policy services_member_read on public.store_services for select to authenticated
  using (public.is_store_member(store_id));
create policy services_owner_all on public.store_services for all to authenticated
  using (store_id in (select id from public.stores where owner_id=auth.uid()))
  with check (store_id in (select id from public.stores where owner_id=auth.uid()));

drop trigger if exists set_store_services_updated_at on public.store_services;
create trigger set_store_services_updated_at before update on public.store_services
for each row execute function public.set_updated_at();

grant select on public.store_business_hours, public.store_holidays, public.store_services to anon;
grant select, insert, update, delete on public.store_business_hours, public.store_holidays, public.store_services to authenticated;

create or replace function public.public_slot_booking_counts(p_store_id uuid, p_service_id uuid, p_date date)
returns table(appt_time_slot text, booking_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select a.appt_time_slot, count(*)
  from public.appointments a
  where a.store_id=p_store_id and a.service_id=p_service_id and a.appt_date=p_date
    and a.status in ('Pending','Confirmed')
    and exists (select 1 from public.stores s where s.id=p_store_id and s.is_active and s.is_verified)
  group by a.appt_time_slot;
$$;
revoke all on function public.public_slot_booking_counts(uuid,uuid,date) from public;
grant execute on function public.public_slot_booking_counts(uuid,uuid,date) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinic-logos','clinic-logos',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy mvp_clinic_logo_read on storage.objects for select to anon, authenticated
  using (bucket_id='clinic-logos');
create policy mvp_clinic_logo_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id='clinic-logos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy mvp_clinic_logo_owner_update on storage.objects for update to authenticated
  using (bucket_id='clinic-logos' and (storage.foldername(name))[1]=auth.uid()::text)
  with check (bucket_id='clinic-logos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy mvp_clinic_logo_owner_delete on storage.objects for delete to authenticated
  using (bucket_id='clinic-logos' and (storage.foldername(name))[1]=auth.uid()::text);
