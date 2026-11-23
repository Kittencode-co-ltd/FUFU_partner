-- Automatic reminders for customers who use the FUFU app (free for them, a selling point for clinics):
--   * vaccines recorded by the clinic (pet_vaccinations.next_due_date): 7 days before and on the due date by default
--   * confirmed appointments: the day before
-- Sent as in-app notifications to the pet's App account (pets.user_id). Customers without the app are skipped.
-- Runs every morning at 08:00 Bangkok (pg_cron). care_reminders records what was sent so nothing goes out twice.
-- Each store can switch these off or change the vaccine days (reminder_settings, owner only).

create extension if not exists pg_cron;

create table public.reminder_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  vaccine_enabled boolean not null default true,
  vaccine_days integer[] not null default '{7,0}' check (cardinality(vaccine_days) between 1 and 4 and 0 <= all(vaccine_days) and 60 >= all(vaccine_days)),
  appointment_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.reminder_settings enable row level security;
create policy reminder_settings_member_read on public.reminder_settings for select to authenticated using (public.is_store_member(store_id));

create table public.care_reminders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('vaccine','appointment')),
  ref_id uuid not null,
  pet_id uuid references public.pets(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_date date not null,
  days_before integer not null,
  sent_at timestamptz not null default now(),
  unique (kind, ref_id, days_before)
);
create index care_reminders_store_idx on public.care_reminders(store_id, sent_at desc);
alter table public.care_reminders enable row level security;
create policy care_reminders_read on public.care_reminders for select to authenticated
  using (user_id = auth.uid() or public.is_store_member(store_id));

-- "1 ธ.ค. 2569"
create or replace function public._thai_date(d date) returns text
language sql immutable set search_path = public as $$
  select extract(day from d)::int || ' ' ||
         (array['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'])[extract(month from d)::int] || ' ' ||
         (extract(year from d)::int + 543)
$$;

-- The daily job. Safe to run more than once a day: care_reminders' unique key stops repeats.
create or replace function public.run_care_reminders() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Bangkok')::date; v_vacc int := 0; v_appt int := 0;
begin
  -- Vaccines due in N days (N from the store's settings), skipping shots already given again since
  with due as (
    select pv.id, pv.store_id, pv.pet_id, p.user_id, p.name as pet_name, pv.vaccine_name, pv.next_due_date, d.days, st.name as store_name
    from pet_vaccinations pv
    join pets p on p.id = pv.pet_id and p.user_id is not null and p.merged_into is null and coalesce(p.is_active, true)
    join stores st on st.id = pv.store_id and st.is_active
    left join reminder_settings rs on rs.store_id = pv.store_id
    cross join lateral unnest(coalesce(rs.vaccine_days, '{7,0}'::int[])) as d(days)
    where coalesce(rs.vaccine_enabled, true)
      and pv.next_due_date is not null
      and pv.next_due_date - d.days = v_today
      and not exists (select 1 from pet_vaccinations later where later.pet_id = pv.pet_id
                        and lower(later.vaccine_name) = lower(pv.vaccine_name) and later.given_date > coalesce(pv.given_date, '-infinity'::date))
  ), ins as (
    insert into care_reminders(store_id, kind, ref_id, pet_id, user_id, due_date, days_before)
    select store_id, 'vaccine', id, pet_id, user_id, next_due_date, days from due
    on conflict (kind, ref_id, days_before) do nothing
    returning ref_id, days_before
  ), note as (
    insert into notifications(user_id, title, body, category, event_type, store_id)
    select due.user_id,
           case when due.days = 0 then 'ถึงกำหนดวัคซีนวันนี้ · ' || due.pet_name else 'ใกล้ถึงกำหนดวัคซีน · ' || due.pet_name end,
           coalesce(nullif(trim(due.vaccine_name), ''), 'วัคซีน') || ' ครบกำหนด ' || public._thai_date(due.next_due_date) ||
             ' ที่ ' || due.store_name || ' จองนัดหรือแชทกับคลินิกได้ในแอป FUFU',
           'reminder', 'vaccine_due', due.store_id
    from ins join due on due.id = ins.ref_id and due.days = ins.days_before
    returning 1
  )
  select count(*) into v_vacc from note;

  -- Confirmed appointments tomorrow
  with due as (
    select a.id, a.store_id, a.pet_id, a.user_id, a.pet_name, a.appt_date, a.category,
           left(coalesce(a.appt_time::text, a.appt_time_slot, ''), 5) as appt_time, st.name as store_name
    from appointments a
    join stores st on st.id = a.store_id and st.is_active
    left join reminder_settings rs on rs.store_id = a.store_id
    where coalesce(rs.appointment_enabled, true)
      and a.user_id is not null and a.status = 'confirmed' and a.appt_date = v_today + 1
  ), ins as (
    insert into care_reminders(store_id, kind, ref_id, pet_id, user_id, due_date, days_before)
    select store_id, 'appointment', id, pet_id, user_id, appt_date, 1 from due
    on conflict (kind, ref_id, days_before) do nothing
    returning ref_id
  ), marked as (
    update appointments set reminder_24h_sent = true where id in (select ref_id from ins) returning id
  ), note as (
    insert into notifications(user_id, title, body, category, event_type, store_id, appointment_id)
    select due.user_id, 'พรุ่งนี้มีนัด · ' || coalesce(due.pet_name, 'สัตว์เลี้ยง'),
           'พรุ่งนี้' || case when due.appt_time <> '' then ' เวลา ' || due.appt_time || ' น.' else '' end || ' ที่ ' || due.store_name ||
             ' หากมาไม่ได้ แจ้งคลินิกผ่านแชทในแอป FUFU',
           'reminder', 'appointment_reminder', due.store_id, due.id
    from ins join due on due.id = ins.ref_id
    returning 1
  )
  select count(*) into v_appt from note;

  return jsonb_build_object('date', v_today, 'vaccine', v_vacc, 'appointment', v_appt);
end $$;
revoke all on function public.run_care_reminders() from public, anon, authenticated;

-- Portal: settings + vaccines due soon (overdue up to 14 days, next 30 days) with whether the owner gets app reminders
create or replace function public.store_reminder_overview(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rs reminder_settings; v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this store' using errcode = '42501'; end if;
  select * into rs from reminder_settings where store_id = p_store_id;
  return jsonb_build_object(
    'settings', jsonb_build_object('vaccine_enabled', coalesce(rs.vaccine_enabled, true), 'vaccine_days', to_jsonb(coalesce(rs.vaccine_days, '{7,0}'::int[])),
                                   'appointment_enabled', coalesce(rs.appointment_enabled, true)),
    'sent_30d', (select count(*) from care_reminders where store_id = p_store_id and sent_at > now() - interval '30 days'),
    'due', coalesce((select jsonb_agg(x order by x->>'due_date') from (
      select jsonb_build_object('id', pv.id, 'pet_name', p.name, 'species', p.species, 'owner_name', o.name, 'owner_phone', o.phone,
               'vaccine_name', pv.vaccine_name, 'due_date', pv.next_due_date, 'on_app', p.user_id is not null,
               'reminded_at', (select max(sent_at) from care_reminders cr where cr.kind = 'vaccine' and cr.ref_id = pv.id)) as x
      from pet_vaccinations pv
      join pets p on p.id = pv.pet_id and p.merged_into is null and coalesce(p.is_active, true)
      left join pet_owners o on o.id = p.owner_id
      where pv.store_id = p_store_id and pv.next_due_date between v_today - 14 and v_today + 30
        and not exists (select 1 from pet_vaccinations later where later.pet_id = pv.pet_id
                          and lower(later.vaccine_name) = lower(pv.vaccine_name) and later.given_date > coalesce(pv.given_date, '-infinity'::date))
      order by pv.next_due_date limit 100) t), '[]'::jsonb));
end $$;

create or replace function public.set_reminder_settings(p_store_id uuid, p_vaccine_enabled boolean, p_vaccine_days integer[], p_appointment_enabled boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_days integer[];
begin
  if auth.uid() is null or not exists (select 1 from stores where id = p_store_id and owner_id = auth.uid()) then
    raise exception 'only the store owner can change reminders' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct d order by d desc), '{}') into v_days from unnest(coalesce(p_vaccine_days, '{}')) d where d between 0 and 60;
  if cardinality(v_days) = 0 then v_days := '{7,0}'; end if;
  if cardinality(v_days) > 4 then return jsonb_build_object('ok', false, 'code', 'too_many_days'); end if;
  insert into reminder_settings(store_id, vaccine_enabled, vaccine_days, appointment_enabled, updated_at)
  values (p_store_id, coalesce(p_vaccine_enabled, true), v_days, coalesce(p_appointment_enabled, true), now())
  on conflict (store_id) do update set vaccine_enabled = excluded.vaccine_enabled, vaccine_days = excluded.vaccine_days,
    appointment_enabled = excluded.appointment_enabled, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.store_reminder_overview(uuid) from public, anon;
revoke all on function public.set_reminder_settings(uuid, boolean, integer[], boolean) from public, anon;
grant execute on function public.store_reminder_overview(uuid), public.set_reminder_settings(uuid, boolean, integer[], boolean) to authenticated;

-- Every day 08:00 Asia/Bangkok (01:00 UTC)
select cron.schedule('care-reminders-daily', '0 1 * * *', 'select public.run_care_reminders()');
