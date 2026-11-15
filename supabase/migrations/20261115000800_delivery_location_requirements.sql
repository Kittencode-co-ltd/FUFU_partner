-- Delivery requires a routable origin and a complete, pinned recipient address.
-- Preserve existing shop settings but pause delivery for stores missing origin data.
update public.stores
set supports_delivery = false
where supports_delivery
  and (nullif(trim(address), '') is null or location_lat is null or location_lng is null);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='stores_location_coordinates_pair_check' and conrelid='public.stores'::regclass) then
    alter table public.stores add constraint stores_location_coordinates_pair_check
      check ((location_lat is null) = (location_lng is null)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='stores_delivery_location_required_check' and conrelid='public.stores'::regclass) then
    alter table public.stores add constraint stores_delivery_location_required_check
      check (not supports_delivery or (nullif(trim(address), '') is not null and location_lat is not null and location_lng is not null)) not valid;
  end if;
end $$;
alter table public.stores validate constraint stores_location_coordinates_pair_check;
alter table public.stores validate constraint stores_delivery_location_required_check;

alter table public.commerce_orders
  add constraint commerce_orders_recipient_phone_digits_check
    check (length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) between 8 and 15) not valid,
  add constraint commerce_orders_delivery_details_check
    check (case when fulfillment_method = 'pickup' then delivery_address is null else
      coalesce(jsonb_typeof(delivery_address) = 'object', false)
      and coalesce(length(trim(delivery_address->>'address')) between 5 and 1000, false)
      and coalesce(length(trim(delivery_address->>'details')) between 3 and 500, false)
      and case when coalesce(delivery_address->>'latitude','') ~ '^-?[0-9]{1,3}(\.[0-9]{1,8})?$'
        then (delivery_address->>'latitude')::numeric between -90 and 90 else false end
      and case when coalesce(delivery_address->>'longitude','') ~ '^-?[0-9]{1,3}(\.[0-9]{1,8})?$'
        then (delivery_address->>'longitude')::numeric between -180 and 180 else false end
    end) not valid;
alter table public.commerce_orders validate constraint commerce_orders_recipient_phone_digits_check;
alter table public.commerce_orders validate constraint commerce_orders_delivery_details_check;

-- Keep the original transactional order routine as an internal implementation;
-- the public RPC wrapper adds strict delivery validation before delegating.
alter function public.create_commerce_order(uuid,jsonb,text,jsonb,text,text,text)
  rename to create_commerce_order_internal;
revoke all on function public.create_commerce_order_internal(uuid,jsonb,text,jsonb,text,text,text) from public, anon, authenticated;

create function public.create_commerce_order(
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
      or coalesce(p_delivery_address->>'latitude','') !~ '^-?[0-9]{1,3}(\.[0-9]{1,8})?$'
      or coalesce(p_delivery_address->>'longitude','') !~ '^-?[0-9]{1,3}(\.[0-9]{1,8})?$' then
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
