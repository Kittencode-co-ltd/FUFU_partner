-- Customers can send their pet's care details (feeding, medication, temperament, vaccines, emergency
-- contact / grooming style) with an App booking. The Portal copies them into the hotel care sheet or
-- the grooming notes when staff assign a room / add the booking to the schedule.
alter table public.appointments add column if not exists care_profile jsonb not null default '{}'::jsonb;
alter table public.appointments add constraint appointments_care_profile_chk
  check (jsonb_typeof(care_profile) = 'object' and octet_length(care_profile::text) <= 8000);

-- Same function as before plus p_care_profile (last, optional). Dropped first so there is one signature.
drop function if exists public.create_service_booking(uuid, uuid, uuid, text, text, timestamptz, text, text, date, date);

create function public.create_service_booking(
  p_store_id uuid, p_service_id uuid, p_pet_id uuid, p_pet_name text, p_category text, p_starts_at timestamptz,
  p_customer_notes text, p_idempotency_key text, p_check_in_date date default null, p_check_out_date date default null,
  p_care_profile jsonb default '{}'::jsonb
) returns public.appointments
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare v_service public.store_services; v_store public.stores; v_pet public.pets; v_result public.appointments;
  v_local timestamp; v_count integer; v_end timestamptz; v_dow integer; v_day date;
  v_care jsonb := coalesce(p_care_profile, '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required' using errcode='22023'; end if;
  if p_category not in ('Vet','Grooming','Hotel') then raise exception 'unsupported booking category' using errcode='22023'; end if;
  if jsonb_typeof(v_care) <> 'object' or octet_length(v_care::text) > 8000 then raise exception 'invalid care profile' using errcode='22023'; end if;
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
  insert into public.appointments(user_id,owner_id,pet_id,store_id,service_id,pet_name,category,services,appt_date,appt_time_slot,appt_time,status,notes,customer_notes,idempotency_key,starts_at,ends_at,check_in_date,check_out_date,care_profile)
  values(auth.uid(),v_pet.owner_id,p_pet_id,p_store_id,p_service_id,v_pet.name,p_category,array[v_service.name],v_local::date,to_char(v_local,'HH24:MI'),v_local::time,'requested',p_customer_notes,p_customer_notes,p_idempotency_key,
    case when p_category='Hotel' then (p_check_in_date + time '14:00') at time zone coalesce(v_store.timezone,'Asia/Bangkok') else p_starts_at end,v_end,p_check_in_date,p_check_out_date,v_care)
  returning * into v_result;
  insert into public.appointment_status_history(appointment_id,to_status,changed_by,reason,idempotency_key)
    values(v_result.id,'requested',auth.uid(),'booking requested',p_idempotency_key);
  return v_result;
end $function$;

revoke all on function public.create_service_booking(uuid, uuid, uuid, text, text, timestamptz, text, text, date, date, jsonb) from public, anon;
grant execute on function public.create_service_booking(uuid, uuid, uuid, text, text, timestamptz, text, text, date, date, jsonb) to authenticated;
