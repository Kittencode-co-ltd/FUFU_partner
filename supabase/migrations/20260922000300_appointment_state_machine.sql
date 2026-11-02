-- P3: canonical appointment workflow, capacity locking and idempotency.

drop trigger if exists validate_new_appointment on public.appointments;
drop trigger if exists enforce_appointment_update on public.appointments;
drop trigger if exists audit_appointment_status on public.appointments;
drop index if exists public.appointments_one_active_slot;

alter table public.appointments drop constraint if exists appointments_status_check;
update public.appointments set status = case status
  when 'Pending' then 'requested' when 'Confirmed' then 'confirmed'
  when 'Rejected' then 'rejected' when 'Completed' then 'completed'
  when 'Cancelled' then 'cancelled' when 'NoShow' then 'no_show'
  else lower(status) end;
alter table public.appointments
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists reason text,
  add column if not exists customer_notes text,
  add column if not exists clinic_notes text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists proposed_starts_at timestamptz,
  add column if not exists proposed_ends_at timestamptz;
alter table public.appointments add constraint appointments_status_check check (status in (
  'requested','confirmed','checked_in','completed','cancelled','no_show','reschedule_proposed','rejected'
));

update public.appointments a set
  starts_at = ((a.appt_date::text || ' ' || a.appt_time_slot)::timestamp at time zone coalesce((select s.timezone from public.stores s where s.id=a.store_id),'Asia/Bangkok')),
  ends_at = ((a.appt_date::text || ' ' || a.appt_time_slot)::timestamp at time zone coalesce((select s.timezone from public.stores s where s.id=a.store_id),'Asia/Bangkok'))
    + make_interval(mins => coalesce((select sv.duration_minutes from public.store_services sv where sv.id=a.service_id),30))
where a.starts_at is null;

alter table public.appointments alter column starts_at set not null;
alter table public.appointments alter column ends_at set not null;
create index if not exists appointments_store_starts_idx on public.appointments(store_id,starts_at,status);

drop policy if exists appointments_owner_insert on public.appointments;
create policy appointments_owner_insert on public.appointments for insert to authenticated with check (
  user_id=auth.uid() and status='requested'
  and (pet_id is null or exists(select 1 from public.pets p where p.id=pet_id and p.user_id=auth.uid()))
  and exists(select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified and s.accepting_appointments)
);
drop policy if exists appointments_owner_cancel on public.appointments;
create policy appointments_owner_cancel on public.appointments for update to authenticated
  using(user_id=auth.uid() and status in ('requested','confirmed','reschedule_proposed'))
  with check(user_id=auth.uid() and status='cancelled');

create table if not exists public.appointment_status_history (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique(appointment_id,idempotency_key)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.appointment_status_history enable row level security;
alter table public.appointment_status_history force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
create policy appointment_history_related_select on public.appointment_status_history for select to authenticated using (
  exists(select 1 from public.appointments a where a.id=appointment_id and (a.user_id=auth.uid() or public.is_store_member(a.store_id)))
);
create policy appointment_history_related_insert on public.appointment_status_history for insert to authenticated with check (
  changed_by=auth.uid() and exists(select 1 from public.appointments a where a.id=appointment_id and (a.user_id=auth.uid() or public.is_store_member(a.store_id)))
);
create policy notifications_related_select on public.notifications for select to authenticated using (
  user_id=auth.uid() or (store_id is not null and public.is_store_member(store_id))
);
create policy notifications_related_insert on public.notifications for insert to authenticated with check (
  (user_id=auth.uid()) or (store_id is not null and public.is_store_member(store_id)) or exists(select 1 from public.appointments a where a.id=appointment_id and a.user_id=auth.uid())
);
grant select,insert on public.appointment_status_history,public.notifications to authenticated;

create or replace function public.public_slot_booking_counts(p_store_id uuid,p_service_id uuid,p_date date)
returns table(appt_time_slot text,booking_count bigint) language sql stable security definer set search_path=public as $$
 select a.appt_time_slot,count(*) from public.appointments a where a.store_id=p_store_id and a.service_id=p_service_id and a.appt_date=p_date and a.status in ('requested','confirmed','checked_in','reschedule_proposed') group by a.appt_time_slot
$$;

create or replace function public.enforce_appointment_update()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if auth.role()='service_role' then return new; end if;
  if (new.user_id,new.pet_id,new.store_id,new.service_id) is distinct from (old.user_id,old.pet_id,old.store_id,old.service_id) then
    raise exception 'appointment identity is immutable' using errcode='42501';
  end if;
  if new.status is distinct from old.status and not (
    (old.status='requested' and new.status in ('confirmed','reschedule_proposed','rejected','cancelled')) or
    (old.status='reschedule_proposed' and new.status in ('confirmed','rejected','cancelled')) or
    (old.status='confirmed' and new.status in ('checked_in','cancelled','no_show')) or
    (old.status='checked_in' and new.status in ('completed','cancelled'))
  ) then raise exception 'invalid appointment transition' using errcode='23514'; end if;
  if auth.uid()=old.user_id and new.status<>'cancelled' then
    raise exception 'customer may only cancel an active appointment' using errcode='42501';
  elsif auth.uid()<>old.user_id and not public.is_store_member(old.store_id) then
    raise exception 'appointment update denied' using errcode='42501';
  end if;
  return new;
end $$;
create trigger enforce_appointment_update before update on public.appointments
for each row execute function public.enforce_appointment_update();

create or replace function public.create_appointment(
  p_store_id uuid,p_service_id uuid,p_pet_id uuid,p_pet_name text,p_starts_at timestamptz,
  p_customer_notes text,p_idempotency_key text
) returns public.appointments language plpgsql security invoker set search_path=public as $$
declare v_service public.store_services; v_store public.stores; v_result public.appointments; v_count integer; v_local timestamp; v_day integer;
begin
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required' using errcode='22023'; end if;
  select * into v_result from public.appointments where user_id=auth.uid() and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_store from public.stores where id=p_store_id and is_active and is_verified and accepting_appointments;
  select * into v_service from public.store_services where id=p_service_id and store_id=p_store_id and is_active;
  if v_store.id is null or v_service.id is null then raise exception 'clinic or service unavailable' using errcode='23514'; end if;
  v_local := p_starts_at at time zone v_store.timezone; v_day := extract(dow from v_local);
  if p_starts_at<=now() or exists(select 1 from public.store_holidays h where h.store_id=p_store_id and h.date=v_local::date and h.is_closed)
    or not exists(select 1 from public.store_business_hours h where h.store_id=p_store_id and h.day_of_week=v_day and not h.is_closed and v_local::time>=h.opens_at and (v_local::time+make_interval(mins=>v_service.duration_minutes))<=h.closes_at)
  then raise exception 'requested time unavailable' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||p_service_id::text||p_starts_at::text,0));
  select count(*) into v_count from public.appointments where store_id=p_store_id and service_id=p_service_id and starts_at=p_starts_at and status in ('requested','confirmed','checked_in','reschedule_proposed');
  if v_count>=v_service.capacity_per_slot then raise exception 'slot capacity reached' using errcode='23505'; end if;
  insert into public.appointments(user_id,pet_id,store_id,service_id,pet_name,category,services,appt_date,appt_time_slot,appt_time,status,notes,customer_notes,idempotency_key,starts_at,ends_at)
  values(auth.uid(),p_pet_id,p_store_id,p_service_id,trim(p_pet_name),'Vet',array[v_service.name],v_local::date,to_char(v_local,'HH24:MI'),v_local::time,'requested',p_customer_notes,p_customer_notes,p_idempotency_key,p_starts_at,p_starts_at+make_interval(mins=>v_service.duration_minutes)) returning * into v_result;
  insert into public.appointment_status_history(appointment_id,to_status,changed_by,reason,idempotency_key) values(v_result.id,'requested',auth.uid(),'appointment created',p_idempotency_key);
  insert into public.notifications(store_id,appointment_id,event_type,title,body) values(p_store_id,v_result.id,'appointment_requested','มีคำขอนัดใหม่',trim(p_pet_name));
  return v_result;
exception when unique_violation then
  select * into v_result from public.appointments where user_id=auth.uid() and idempotency_key=p_idempotency_key;
  if v_result.id is not null then return v_result; end if; raise;
end $$;

create or replace function public.transition_appointment(p_appointment_id uuid,p_to_status text,p_reason text,p_idempotency_key text,p_proposed_starts_at timestamptz default null)
returns public.appointments language plpgsql security invoker set search_path=public as $$
declare v public.appointments; v_existing bigint; v_from text;
begin
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required' using errcode='22023'; end if;
  select * into v from public.appointments where id=p_appointment_id for update;
  if v.id is null then raise exception 'appointment not found' using errcode='P0002'; end if;
  select id into v_existing from public.appointment_status_history where appointment_id=v.id and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v; end if;
  v_from := v.status;
  update public.appointments set status=p_to_status,reason=coalesce(p_reason,reason),clinic_notes=case when public.is_store_member(store_id) then coalesce(p_reason,clinic_notes) else clinic_notes end,
    proposed_starts_at=case when p_to_status='reschedule_proposed' then p_proposed_starts_at else proposed_starts_at end,
    proposed_ends_at=case when p_to_status='reschedule_proposed' then p_proposed_starts_at+(ends_at-starts_at) else proposed_ends_at end,
    starts_at=case when status='reschedule_proposed' and p_to_status='confirmed' and proposed_starts_at is not null then proposed_starts_at else starts_at end,
    ends_at=case when status='reschedule_proposed' and p_to_status='confirmed' and proposed_ends_at is not null then proposed_ends_at else ends_at end,
    cancelled_at=case when p_to_status='cancelled' then now() else cancelled_at end,
    cancelled_by=case when p_to_status='cancelled' then auth.uid() else cancelled_by end,
    cancellation_reason=case when p_to_status='cancelled' then p_reason else cancellation_reason end
  where id=v.id returning * into v;
  insert into public.appointment_status_history(appointment_id,from_status,to_status,changed_by,reason,idempotency_key) values(v.id,v_from,p_to_status,auth.uid(),p_reason,p_idempotency_key);
  insert into public.notifications(user_id,store_id,appointment_id,event_type,title,body) values(v.user_id,v.store_id,v.id,'appointment_'||p_to_status,'สถานะนัดหมาย: '||p_to_status,p_reason);
  return v;
end $$;
grant execute on function public.create_appointment(uuid,uuid,uuid,text,timestamptz,text,text) to authenticated;
grant execute on function public.transition_appointment(uuid,text,text,text,timestamptz) to authenticated;
