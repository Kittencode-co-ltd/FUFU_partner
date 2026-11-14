-- Booking foundation compatible with the live legacy appointments and notifications tables.
-- Keep historical rows and legacy Shop/category/status values intact.

alter table public.appointments
  add column if not exists customer_notes text,
  add column if not exists clinic_notes text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists idempotency_key text,
  add column if not exists rejection_reason text,
  add column if not exists check_in_date date,
  add column if not exists check_out_date date,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text;

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('Pending','Confirmed','Cancelled','Completed','scheduled',
    'requested','confirmed','rejected','cancelled','completed','checked_in','reschedule_proposed'));
alter table public.appointments drop constraint if exists appointments_rejection_reason_check;
alter table public.appointments add constraint appointments_rejection_reason_check
  check (status <> 'rejected' or nullif(trim(rejection_reason), '') is not null);

create unique index if not exists appointments_user_idempotency_idx
  on public.appointments(user_id, idempotency_key)
  where user_id is not null and idempotency_key is not null;
create index if not exists appointments_hotel_stay_idx
  on public.appointments(store_id, service_id, check_in_date, check_out_date)
  where category = 'Hotel' and status in ('requested','confirmed','checked_in');

create table if not exists public.appointment_status_history (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid,
  reason text,
  idempotency_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists appointment_history_idempotency_idx
  on public.appointment_status_history(appointment_id,idempotency_key)
  where idempotency_key is not null;
alter table public.appointment_status_history enable row level security;

-- Existing hours were stored as JSON on stores. Copy them only into empty availability rows.
insert into public.store_business_hours(store_id,day_of_week,opens_at,closes_at,is_closed)
select s.id,d.dow,
  case when coalesce((s.business_hours->d.key->>'closed')::boolean,false) then null
       else nullif(s.business_hours->d.key->>'open','')::time end,
  case when coalesce((s.business_hours->d.key->>'closed')::boolean,false) then null
       else nullif(s.business_hours->d.key->>'close','')::time end,
  coalesce((s.business_hours->d.key->>'closed')::boolean,false)
from public.stores s
cross join (values ('sun',0),('mon',1),('tue',2),('wed',3),('thu',4),('fri',5),('sat',6)) d(key,dow)
where s.business_hours ? d.key
on conflict (store_id,day_of_week) do nothing;

-- Legacy mobile clients keep using is_read; newer web clients can use read_at.
alter table public.notifications
  add column if not exists store_id uuid references public.stores(id) on delete set null,
  add column if not exists appointment_id uuid references public.appointments(id) on delete cascade,
  add column if not exists event_type text not null default 'general',
  add column if not exists read_at timestamptz;
update public.notifications set read_at=created_at where is_read is true and read_at is null;

create or replace function public.sync_notification_read_state()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op='INSERT' then
    if new.read_at is not null then new.is_read:=true;
    elsif new.is_read then new.read_at:=coalesce(new.read_at,now()); end if;
  elsif new.read_at is distinct from old.read_at then new.is_read:=new.read_at is not null;
  elsif new.is_read is distinct from old.is_read then
    new.read_at:=case when new.is_read then coalesce(new.read_at,now()) else null end;
  end if;
  return new;
end $$;
drop trigger if exists sync_notification_read_state on public.notifications;
create trigger sync_notification_read_state before insert or update on public.notifications
for each row execute function public.sync_notification_read_state();

create or replace function public.create_service_booking(
  p_store_id uuid,p_service_id uuid,p_pet_id uuid,p_pet_name text,p_category text,
  p_starts_at timestamptz,p_customer_notes text,p_idempotency_key text,
  p_check_in_date date default null,p_check_out_date date default null
) returns public.appointments
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_service public.store_services; v_store public.stores; v_pet public.pets; v_result public.appointments;
  v_local timestamp; v_count integer; v_end timestamptz; v_dow integer; v_day date;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required' using errcode='22023'; end if;
  if p_category not in ('Vet','Grooming','Hotel') then raise exception 'unsupported booking category' using errcode='22023'; end if;
  select * into v_result from public.appointments where user_id=auth.uid() and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_store from public.stores where id=p_store_id and is_active and is_verified and accepting_appointments;
  select * into v_service from public.store_services where id=p_service_id and store_id=p_store_id and is_active;
  if v_store.id is null or v_service.id is null then raise exception 'store or service unavailable' using errcode='23514'; end if;
  select p.* into v_pet from public.pets p where p.id=p_pet_id and coalesce(p.is_active,true) and
      (p.user_id=auth.uid() or exists(select 1 from public.pet_owners po where po.id=p.owner_id and po.auth_user_id=auth.uid()));
  if p_pet_id is null or not found then
    raise exception 'pet does not belong to current user' using errcode='42501';
  end if;
  if (p_category='Vet' and lower(v_store.category) not in ('vet_clinic','vet_hospital'))
    or (p_category='Grooming' and lower(v_store.category)<>'pet_grooming')
    or (p_category='Hotel' and lower(v_store.category)<>'pet_hotel') then
    raise exception 'booking category does not match store' using errcode='23514';
  end if;
  if p_category='Hotel' then
    if p_check_in_date is null or p_check_out_date is null or p_check_out_date<=p_check_in_date then
      raise exception 'valid check-in and check-out dates are required' using errcode='22023'; end if;
    if p_check_in_date < (now() at time zone coalesce(v_store.timezone,'Asia/Bangkok'))::date then
      raise exception 'check-in date cannot be in the past' using errcode='23514'; end if;
    v_local:=p_check_in_date + time '14:00';
    v_end:=(p_check_out_date + time '12:00') at time zone coalesce(v_store.timezone,'Asia/Bangkok');
    for v_day in select d::date from generate_series(p_check_in_date::timestamp,(p_check_out_date-1)::timestamp,interval '1 day') d loop
      perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||p_service_id::text||v_day::text,0));
    end loop;
    select count(*) into v_count from public.appointments a where a.store_id=p_store_id and a.service_id=p_service_id
      and a.category='Hotel' and a.status in ('requested','confirmed','checked_in')
      and a.check_in_date<p_check_out_date and a.check_out_date>p_check_in_date;
  else
    if p_starts_at is null or p_starts_at<=now() then raise exception 'booking time must be in the future' using errcode='23514'; end if;
    v_local:=p_starts_at at time zone coalesce(v_store.timezone,'Asia/Bangkok'); v_dow:=extract(dow from v_local);
    v_end:=p_starts_at+make_interval(mins=>v_service.duration_minutes);
    if exists(select 1 from public.store_holidays h where h.store_id=p_store_id and h.date=v_local::date and h.is_closed)
      or not exists(select 1 from public.store_business_hours h where h.store_id=p_store_id and h.day_of_week=v_dow
        and not h.is_closed and v_local::time>=h.opens_at and (v_local::time+make_interval(mins=>v_service.duration_minutes))<=h.closes_at) then
      raise exception 'requested time unavailable' using errcode='23514'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||p_service_id::text||v_local::date::text,0));
    select count(*) into v_count from public.appointments a where a.store_id=p_store_id and a.service_id=p_service_id
      and a.starts_at<v_end and a.ends_at>p_starts_at and a.status in ('requested','confirmed','checked_in','reschedule_proposed');
  end if;
  if v_count>=v_service.capacity_per_slot then raise exception 'service capacity reached' using errcode='23505'; end if;
  insert into public.appointments(user_id,owner_id,pet_id,store_id,service_id,pet_name,category,services,appt_date,appt_time_slot,appt_time,status,notes,customer_notes,idempotency_key,starts_at,ends_at,check_in_date,check_out_date)
  values(auth.uid(),v_pet.owner_id,p_pet_id,p_store_id,p_service_id,v_pet.name,p_category,array[v_service.name],v_local::date,to_char(v_local,'HH24:MI'),v_local::time,'requested',p_customer_notes,p_customer_notes,p_idempotency_key,
    case when p_category='Hotel' then (p_check_in_date + time '14:00') at time zone coalesce(v_store.timezone,'Asia/Bangkok') else p_starts_at end,v_end,p_check_in_date,p_check_out_date)
  returning * into v_result;
  insert into public.appointment_status_history(appointment_id,to_status,changed_by,reason,idempotency_key)
    values(v_result.id,'requested',auth.uid(),'booking requested',p_idempotency_key);
  return v_result;
end $$;

create or replace function public.transition_appointment(
  p_appointment_id uuid,p_to_status text,p_reason text,p_idempotency_key text,p_proposed_starts_at timestamptz default null
) returns public.appointments
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.appointments; v_from text; v_store_member boolean;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required' using errcode='22023'; end if;
  if p_to_status not in ('confirmed','rejected','cancelled','completed','checked_in','reschedule_proposed') then raise exception 'invalid status' using errcode='22023'; end if;
  if p_to_status='rejected' and nullif(trim(p_reason),'') is null then raise exception 'rejection reason required' using errcode='22023'; end if;
  select * into v from public.appointments where id=p_appointment_id for update;
  if v.id is null then raise exception 'appointment not found' using errcode='P0002'; end if;
  v_store_member:=public.is_store_member(v.store_id);
  if not v_store_member and auth.uid() is distinct from v.user_id then raise exception 'appointment access denied' using errcode='42501'; end if;
  if exists(select 1 from public.appointment_status_history where appointment_id=v.id and idempotency_key=p_idempotency_key) then return v; end if;
  v_from:=case v.status when 'Pending' then 'requested' when 'Confirmed' then 'confirmed' when 'Cancelled' then 'cancelled' when 'Completed' then 'completed' when 'scheduled' then 'confirmed' else v.status end;
  if p_to_status='rejected' and not v_store_member then raise exception 'only store staff can reject' using errcode='42501'; end if;
  if p_to_status='confirmed' and not v_store_member then raise exception 'only store staff can confirm' using errcode='42501'; end if;
  if p_to_status='cancelled' and v_store_member=false and auth.uid() is distinct from v.user_id then raise exception 'access denied' using errcode='42501'; end if;
  if v_from not in ('requested','confirmed','checked_in','reschedule_proposed') then raise exception 'booking is not actionable' using errcode='23514'; end if;
  if p_to_status='reschedule_proposed' and (not v_store_member or p_proposed_starts_at is null) then raise exception 'valid proposed time required' using errcode='22023'; end if;
  update public.appointments set status=p_to_status,
    rejection_reason=case when p_to_status='rejected' then trim(p_reason) else rejection_reason end,
    clinic_notes=case when v_store_member and p_reason is not null then p_reason else clinic_notes end,
    cancelled_at=case when p_to_status='cancelled' then now() else cancelled_at end,
    cancelled_by=case when p_to_status='cancelled' then auth.uid() else cancelled_by end,
    cancellation_reason=case when p_to_status='cancelled' then p_reason else cancellation_reason end,
    updated_at=now()
    where id=v.id returning * into v;
  insert into public.appointment_status_history(appointment_id,from_status,to_status,changed_by,reason,idempotency_key)
    values(v.id,v_from,p_to_status,auth.uid(),p_reason,p_idempotency_key);
  if v.user_id is not null then
    insert into public.notifications(user_id,store_id,appointment_id,event_type,title,body,category,icon)
    values(v.user_id,v.store_id,v.id,'appointment_'||p_to_status,
      case p_to_status when 'confirmed' then 'ยืนยันการจองแล้ว' when 'rejected' then 'ร้านปฏิเสธการจอง' else 'อัปเดตสถานะการจอง' end,
      case when p_to_status='rejected' then 'เหตุผล: '||trim(p_reason) else coalesce(nullif(trim(p_reason),''),'สถานะการจองของคุณมีการเปลี่ยนแปลง') end,'Health','calendar');
  end if;
  return v;
end $$;

revoke all on function public.create_service_booking(uuid,uuid,uuid,text,text,timestamptz,text,text,date,date) from public,anon;
revoke all on function public.transition_appointment(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.create_service_booking(uuid,uuid,uuid,text,text,timestamptz,text,text,date,date) to authenticated;
grant execute on function public.transition_appointment(uuid,text,text,text,timestamptz) to authenticated;
