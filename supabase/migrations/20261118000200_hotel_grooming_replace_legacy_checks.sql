-- Older inline checks pre-date reservations / no-shows / pickup; the *_chk constraints from
-- 20261118000100_hotel_grooming_bookings are a superset of them, so the old ones are dropped.
alter table public.grooming_sessions drop constraint if exists grooming_sessions_status_check;
alter table public.hotel_bookings drop constraint if exists hotel_bookings_status_check;
alter table public.hotel_rooms drop constraint if exists hotel_rooms_status_check;
alter table public.hotel_rooms drop constraint if exists hotel_rooms_room_type_check;
alter table public.hotel_rooms
  add constraint hotel_rooms_room_type_chk check (room_type in ('standard','deluxe','suite','vip','cat','small','large'));
