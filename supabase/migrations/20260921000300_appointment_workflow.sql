-- Phase 5: concurrency-safe appointment workflow and immutable audit history.

create unique index if not exists appointments_one_active_slot
  on public.appointments (store_id, appt_date, appt_time_slot)
  where status in ('Pending', 'Confirmed');

alter table public.appointments
  drop constraint if exists appointments_time_slot_format;
alter table public.appointments
  add constraint appointments_time_slot_format
  check (appt_time_slot ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');

drop policy if exists appointments_owner_insert on public.appointments;
create policy appointments_owner_insert on public.appointments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'Pending'
    and (
      pet_id is null
      or exists (
        select 1 from public.pets p
        where p.id = pet_id and p.user_id = auth.uid()
      )
    )
    and exists (
      select 1 from public.stores s
      where s.id = store_id and s.is_active and s.is_verified
    )
  );

create table if not exists public.appointment_status_audit (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  old_status text,
  new_status text not null,
  changed_at timestamptz not null default now()
);

alter table public.appointment_status_audit enable row level security;
alter table public.appointment_status_audit force row level security;

drop policy if exists appointment_audit_owner_select on public.appointment_status_audit;
create policy appointment_audit_owner_select
  on public.appointment_status_audit for select to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and (a.user_id = auth.uid() or public.is_store_member(a.store_id))
    )
  );

grant select on public.appointment_status_audit to authenticated;

create or replace function public.audit_appointment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.appointment_status_audit(
      appointment_id, actor_user_id, old_status, new_status
    ) values (
      new.id,
      auth.uid(),
      case when tg_op = 'INSERT' then null else old.status end,
      new.status
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_appointment_status on public.appointments;
create trigger audit_appointment_status
after insert or update of status on public.appointments
for each row execute function public.audit_appointment_status();

create or replace function public.validate_new_appointment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.appt_date < (now() at time zone 'Asia/Bangkok')::date then
    raise exception 'appointment date cannot be in the past' using errcode = '23514';
  end if;
  if new.appt_date = (now() at time zone 'Asia/Bangkok')::date
     and new.appt_time_slot::time <
       ((now() at time zone 'Asia/Bangkok')::time + interval '60 minutes') then
    raise exception 'appointment requires at least 60 minutes lead time'
      using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.stores s
    where s.id = new.store_id
      and s.is_active = true
      and s.is_verified = true
  ) then
    raise exception 'clinic is unavailable for booking' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_new_appointment on public.appointments;
create trigger validate_new_appointment
before insert on public.appointments
for each row execute function public.validate_new_appointment();
