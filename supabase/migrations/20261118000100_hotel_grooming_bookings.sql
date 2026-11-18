-- Pet Hotel + Grooming: reservations, per-pet care sheet, link to App bookings, no double booking.
-- All three tables were empty when this was written; every change is additive.

-- ── Hotel rooms ─────────────────────────────────────────────────────────────
alter table public.hotel_rooms
  add constraint hotel_rooms_status_chk check (status in ('available','occupied','cleaning','maintenance')),
  add constraint hotel_rooms_max_pets_chk check (max_pets between 1 and 20),
  add constraint hotel_rooms_daily_rate_chk check (daily_rate >= 0);
create unique index if not exists hotel_rooms_store_number_uniq on public.hotel_rooms(store_id, lower(room_number));

-- ── Hotel bookings ──────────────────────────────────────────────────────────
alter table public.hotel_bookings
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  -- medications, temperament, vaccines checked, vet + emergency contacts (per stay)
  add column if not exists care_profile jsonb not null default '{}'::jsonb,
  add column if not exists room_rate numeric not null default 0,
  add column if not exists cancelled_reason text;
alter table public.hotel_bookings
  add constraint hotel_bookings_status_chk check (status in ('reserved','checked_in','checked_out','cancelled','no_show')),
  add constraint hotel_bookings_dates_chk check (check_out_date is not null and check_out_date > check_in_date);
create unique index if not exists hotel_bookings_appointment_uniq
  on public.hotel_bookings(appointment_id) where appointment_id is not null and status not in ('cancelled','no_show');
create index if not exists hotel_bookings_room_stay_idx
  on public.hotel_bookings(room_id, check_in_date, check_out_date) where status in ('reserved','checked_in');
create index if not exists hotel_bookings_store_dates_idx on public.hotel_bookings(store_id, check_in_date, check_out_date);

-- ── Grooming sessions ───────────────────────────────────────────────────────
alter table public.grooming_sessions
  add column if not exists scheduled_at timestamptz,
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists owner_phone text,
  add column if not exists care_profile jsonb not null default '{}'::jsonb,
  add column if not exists total_amount numeric not null default 0,
  add column if not exists picked_up_at timestamptz,
  add column if not exists cancelled_reason text;
alter table public.grooming_sessions
  add constraint grooming_sessions_status_chk check (status in ('booked','waiting','in_progress','done','picked_up','cancelled','no_show')),
  add constraint grooming_sessions_progress_chk check (progress between 0 and 100),
  add constraint grooming_sessions_minutes_chk check (estimated_minutes between 5 and 600);
create unique index if not exists grooming_sessions_appointment_uniq
  on public.grooming_sessions(appointment_id) where appointment_id is not null and status not in ('cancelled','no_show');
create index if not exists grooming_sessions_store_schedule_idx on public.grooming_sessions(store_id, scheduled_at);

-- ── Reserve / move a hotel stay without double booking ─────────────────────
-- Runs as the caller (RLS still decides which store they may touch). A per-room advisory lock
-- serialises concurrent reservations, then every night of the stay is checked against max_pets.
create or replace function public.reserve_hotel_room(
  p_store_id uuid, p_room_id uuid, p_check_in date, p_check_out date,
  p_details jsonb default '{}'::jsonb, p_booking_id uuid default null
) returns public.hotel_bookings
language plpgsql security invoker set search_path = public as $$
declare
  v_room public.hotel_rooms;
  v_day date;
  v_taken int;
  v_row public.hotel_bookings;
  v_nights int;
  v_status text := coalesce(p_details->>'status', 'reserved');
begin
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'check-out must be after check-in' using errcode = '22023', hint = 'invalid_dates';
  end if;
  if p_check_out - p_check_in > 90 then
    raise exception 'stay too long' using errcode = '22023', hint = 'stay_too_long';
  end if;
  if v_status not in ('reserved','checked_in') then
    raise exception 'invalid status' using errcode = '22023', hint = 'invalid_status';
  end if;

  select * into v_room from public.hotel_rooms where id = p_room_id and store_id = p_store_id;
  if not found then raise exception 'room not found' using errcode = 'P0002', hint = 'room_not_found'; end if;
  if v_room.status = 'maintenance' then raise exception 'room under maintenance' using errcode = 'P0001', hint = 'room_maintenance'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));

  for v_day in select d::date from generate_series(p_check_in, p_check_out - 1, interval '1 day') d loop
    select count(*) into v_taken from public.hotel_bookings b
     where b.room_id = p_room_id and b.status in ('reserved','checked_in')
       and (p_booking_id is null or b.id <> p_booking_id)
       and b.check_in_date <= v_day and b.check_out_date > v_day;
    if v_taken >= v_room.max_pets then
      raise exception 'room is full on %', v_day using errcode = 'P0001', hint = 'room_full', detail = v_day::text;
    end if;
  end loop;

  v_nights := p_check_out - p_check_in;

  if p_booking_id is not null then
    update public.hotel_bookings set
      room_id = p_room_id, check_in_date = p_check_in, check_out_date = p_check_out,
      nights = v_nights, room_rate = v_room.daily_rate,
      total_amount = v_nights * v_room.daily_rate, total_cost = v_nights * v_room.daily_rate,
      updated_at = now()
    where id = p_booking_id and store_id = p_store_id and status in ('reserved','checked_in')
    returning * into v_row;
    if not found then raise exception 'booking not found' using errcode = 'P0002', hint = 'booking_not_found'; end if;
    return v_row;
  end if;

  insert into public.hotel_bookings(
    store_id, room_id, pet_id, customer_id, created_by, appointment_id, pet_name, owner_name, owner_phone, species,
    check_in_date, check_out_date, nights, room_rate, total_amount, total_cost, deposit_amount,
    feeding_schedule, special_instructions, add_on_services, belongings_log, care_profile, notes,
    status, actual_checkin_at
  ) values (
    -- created_by references staff(id) and customer_id references customers(id), not auth users: left empty;
    -- the App customer is reachable through appointment_id.
    p_store_id, p_room_id, nullif(p_details->>'pet_id','')::uuid, null, null,
    nullif(p_details->>'appointment_id','')::uuid,
    left(p_details->>'pet_name', 120), left(p_details->>'owner_name', 120), left(p_details->>'owner_phone', 30),
    coalesce(nullif(p_details->>'species',''), 'dog'),
    p_check_in, p_check_out, v_nights, v_room.daily_rate, v_nights * v_room.daily_rate, v_nights * v_room.daily_rate,
    greatest(coalesce((p_details->>'deposit_amount')::numeric, 0), 0),
    coalesce(p_details->'feeding_schedule', '[]'::jsonb), left(p_details->>'special_instructions', 2000),
    coalesce(p_details->'add_on_services', '[]'::jsonb), coalesce(p_details->'belongings_log', '[]'::jsonb),
    coalesce(p_details->'care_profile', '{}'::jsonb), left(p_details->>'notes', 2000),
    v_status, case when v_status = 'checked_in' then now() end
  ) returning * into v_row;

  if v_status = 'checked_in' then
    update public.hotel_rooms set status = 'occupied' where id = p_room_id;
  end if;
  return v_row;
end $$;

revoke all on function public.reserve_hotel_room(uuid, uuid, date, date, jsonb, uuid) from public, anon;
grant execute on function public.reserve_hotel_room(uuid, uuid, date, date, jsonb, uuid) to authenticated;
