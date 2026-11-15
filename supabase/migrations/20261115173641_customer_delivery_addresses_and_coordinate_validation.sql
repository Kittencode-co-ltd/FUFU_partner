-- Customer-owned delivery address book and high-precision map coordinates.
create table if not exists public.customer_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'บ้าน' check (char_length(trim(label)) between 1 and 60),
  phone text not null check (length(regexp_replace(phone, '[^0-9]', '', 'g')) between 8 and 15),
  address text not null check (char_length(trim(address)) between 5 and 1000),
  details text not null check (char_length(trim(details)) between 3 and 500),
  latitude numeric(12,9) not null check (latitude between -90 and 90),
  longitude numeric(12,9) not null check (longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_delivery_addresses_user_created_idx
  on public.customer_delivery_addresses(user_id, created_at desc);
create unique index if not exists customer_delivery_addresses_one_default_idx
  on public.customer_delivery_addresses(user_id) where is_default;

alter table public.customer_delivery_addresses enable row level security;
alter table public.customer_delivery_addresses force row level security;
drop policy if exists customer_delivery_addresses_select_own on public.customer_delivery_addresses;
create policy customer_delivery_addresses_select_own on public.customer_delivery_addresses
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists customer_delivery_addresses_insert_own on public.customer_delivery_addresses;
create policy customer_delivery_addresses_insert_own on public.customer_delivery_addresses
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists customer_delivery_addresses_update_own on public.customer_delivery_addresses;
create policy customer_delivery_addresses_update_own on public.customer_delivery_addresses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists customer_delivery_addresses_delete_own on public.customer_delivery_addresses;
create policy customer_delivery_addresses_delete_own on public.customer_delivery_addresses
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.customer_delivery_addresses from anon, public;
grant select, insert, update, delete on public.customer_delivery_addresses to authenticated;

create or replace function public.save_customer_delivery_address(
  p_label text,
  p_phone text,
  p_address text,
  p_details text,
  p_latitude numeric,
  p_longitude numeric,
  p_is_default boolean default false
) returns public.customer_delivery_addresses
language plpgsql security invoker set search_path=public,auth as $$
declare
  v_user_id uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  v_result public.customer_delivery_addresses;
  v_is_default boolean := coalesce(p_is_default,false);
begin
  if v_user_id is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if length(v_digits) not between 8 and 15
    or char_length(trim(coalesce(p_label,''))) not between 1 and 60
    or char_length(trim(coalesce(p_address,''))) not between 5 and 1000
    or char_length(trim(coalesce(p_details,''))) not between 3 and 500
    or p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'invalid_delivery_address' using errcode='22023';
  end if;

  if v_is_default or not exists (
    select 1 from public.customer_delivery_addresses where user_id=v_user_id
  ) then
    update public.customer_delivery_addresses set is_default=false
      where user_id=v_user_id and is_default;
    v_is_default := true;
  end if;

  insert into public.customer_delivery_addresses(user_id,label,phone,address,details,latitude,longitude,is_default)
  values(v_user_id,trim(p_label),trim(p_phone),trim(p_address),trim(p_details),p_latitude,p_longitude,v_is_default)
  returning * into v_result;
  return v_result;
end $$;
revoke all on function public.save_customer_delivery_address(text,text,text,text,numeric,numeric,boolean) from public,anon;
grant execute on function public.save_customer_delivery_address(text,text,text,text,numeric,numeric,boolean) to authenticated;

-- Map APIs can return more than eight decimal places (or scientific notation).
-- JSONB has already parsed the values as numbers, so validate their JSON type and
-- numeric range instead of rejecting valid coordinates by textual formatting.
create or replace function public.create_commerce_order(
  p_store_id uuid, p_items jsonb, p_fulfillment_method text, p_delivery_address jsonb,
  p_customer_phone text, p_customer_note text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public,auth as $$
declare
  v_digits text := regexp_replace(coalesce(p_customer_phone,''), '[^0-9]', '', 'g');
  v_lat numeric;
  v_lng numeric;
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if length(v_digits) not between 8 and 15 then raise exception 'invalid_customer_phone' using errcode='22023'; end if;
  if p_fulfillment_method not in ('pickup','delivery') then raise exception 'invalid_fulfillment_method' using errcode='22023'; end if;
  if p_fulfillment_method='delivery' then
    if p_delivery_address is null or jsonb_typeof(p_delivery_address)<>'object'
      or length(trim(coalesce(p_delivery_address->>'address',''))) not between 5 and 1000
      or length(trim(coalesce(p_delivery_address->>'details',''))) not between 3 and 500
      or jsonb_typeof(p_delivery_address->'latitude') is distinct from 'number'
      or jsonb_typeof(p_delivery_address->'longitude') is distinct from 'number' then
      raise exception 'delivery_address_details_and_pin_required' using errcode='22023';
    end if;
    v_lat := (p_delivery_address->>'latitude')::numeric;
    v_lng := (p_delivery_address->>'longitude')::numeric;
    if v_lat not between -90 and 90 or v_lng not between -180 and 180 then raise exception 'invalid_delivery_coordinates' using errcode='22023'; end if;
    perform 1 from public.stores s where s.id=p_store_id and s.is_active and s.is_verified and s.can_sell_products
      and s.supports_delivery and nullif(trim(s.address),'') is not null and s.location_lat is not null and s.location_lng is not null for share;
    if not found then raise exception 'store_delivery_location_incomplete' using errcode='23514'; end if;
  end if;
  return public.create_commerce_order_internal(p_store_id,p_items,p_fulfillment_method,p_delivery_address,p_customer_phone,p_customer_note,p_idempotency_key);
end $$;
revoke all on function public.create_commerce_order(uuid,jsonb,text,jsonb,text,text,text) from public, anon;
grant execute on function public.create_commerce_order(uuid,jsonb,text,jsonb,text,text,text) to authenticated;
notify pgrst, 'reload schema';
