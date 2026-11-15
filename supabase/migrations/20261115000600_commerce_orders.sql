-- Commerce catalog and order workflow. Existing inventory/POS columns stay compatible.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text not null default 'product',
  sku text,
  barcode text,
  unit text not null default 'ชิ้น',
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  sell_price numeric(12,2) not null default 0 check (sell_price >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  reorder_point integer not null default 5,
  reorder_qty integer,
  is_active boolean not null default true,
  photo_url text,
  icon text default '📦',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products add column if not exists description text;
alter table public.products add column if not exists is_published boolean not null default false;
alter table public.products add column if not exists supports_pickup boolean not null default true;
alter table public.products add column if not exists supports_delivery boolean not null default true;
alter table public.products add column if not exists weight_grams integer check (weight_grams is null or weight_grams >= 0);
create index if not exists products_store_catalog_idx on public.products(store_id, name) where is_active and is_published;
do $$ begin
  if to_regclass('public.inventory_batches') is not null then
    execute $q$update public.products p set stock_qty=x.qty from (
      select product_id,sum(quantity)::integer as qty from public.inventory_batches where is_active and quantity>0 group by product_id
    ) x where x.product_id=p.id and p.stock_qty=0$q$;
  end if;
end $$;

alter table public.stores add column if not exists can_sell_products boolean not null default false;
alter table public.stores add column if not exists supports_pickup boolean not null default true;
alter table public.stores add column if not exists supports_delivery boolean not null default false;
alter table public.stores add column if not exists delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0);
update public.stores set can_sell_products=true where category='pet_shop' and is_active and is_verified and not can_sell_products;

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  idempotency_key text not null,
  fulfillment_method text not null check (fulfillment_method in ('pickup','delivery')),
  delivery_address jsonb,
  customer_phone text not null,
  customer_note text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  payment_method text not null default 'pay_on_fulfillment' check (payment_method in ('pay_on_fulfillment')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  status text not null default 'pending_store_confirmation' check (status in ('pending_store_confirmation','preparing','ready_for_pickup','handed_to_courier','delivered','completed','rejected','cancelled','delivery_failed','return_requested','returned','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key),
  check ((fulfillment_method = 'pickup' and delivery_address is null) or (fulfillment_method = 'delivery' and delivery_address is not null))
);
create index if not exists commerce_orders_customer_created_idx on public.commerce_orders(user_id, created_at desc);
create index if not exists commerce_orders_store_status_idx on public.commerce_orders(store_id, status, created_at desc);

create table if not exists public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index if not exists commerce_order_items_order_idx on public.commerce_order_items(order_id);

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history(order_id, created_at);

create table if not exists public.order_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.commerce_orders(id) on delete restrict,
  provider text,
  tracking_number text,
  proof_url text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 1000),
  evidence_url text,
  received_at timestamptz,
  resolution text check (resolution is null or resolution in ('returned','refunded','rejected')),
  created_at timestamptz not null default now()
);
create unique index if not exists order_returns_one_open_idx on public.order_returns(order_id) where resolution is null;

alter table public.notifications add column if not exists order_id uuid references public.commerce_orders(id) on delete cascade;
create index if not exists notifications_order_idx on public.notifications(order_id) where order_id is not null;

create or replace function public.is_store_catalog_operator(p_store_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
  select exists(select 1 from public.stores s where s.id=p_store_id and (s.owner_id=auth.uid() or lower(coalesce(s.owner_email,''))=lower(coalesce(auth.jwt()->>'email',''))))
    or exists(select 1 from public.staff st where st.store_id=p_store_id and st.is_active
      and (st.user_id=auth.uid() or lower(coalesce(st.email,''))=lower(coalesce(auth.jwt()->>'email','')))
      and st.role in ('owner','manager','veterinarian','pharmacist','receptionist','staff','counter'));
$$;
revoke all on function public.is_store_catalog_operator(uuid) from public,anon;
grant execute on function public.is_store_catalog_operator(uuid) to authenticated;

create or replace function public.is_store_order_operator(p_store_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
  select exists(select 1 from public.stores s where s.id=p_store_id and (s.owner_id=auth.uid() or lower(coalesce(s.owner_email,''))=lower(coalesce(auth.jwt()->>'email',''))))
    or exists(select 1 from public.staff st where st.store_id=p_store_id and st.is_active
      and (st.user_id=auth.uid() or lower(coalesce(st.email,''))=lower(coalesce(auth.jwt()->>'email','')))
      and st.role in ('owner','manager','veterinarian','receptionist','staff','counter'));
$$;
revoke all on function public.is_store_order_operator(uuid) from public,anon;
grant execute on function public.is_store_order_operator(uuid) to authenticated;

alter table public.products enable row level security;
alter table public.products force row level security;
drop policy if exists products_public_store_discovery on public.products;
drop policy if exists products_iso on public.products;
create policy products_public_store_discovery on public.products for select to anon, authenticated
  using (is_active and is_published and stock_qty > 0 and exists(
    select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified and s.can_sell_products));
drop policy if exists products_partner_manage on public.products;
create policy products_partner_manage on public.products for all to authenticated
  using (public.is_store_catalog_operator(store_id)) with check (public.is_store_catalog_operator(store_id));
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

create or replace function public.adjust_product_sellable_stock(p_product_id uuid,p_delta integer)
returns integer language plpgsql security invoker set search_path=public as $$
declare v_qty integer;
begin
  if auth.uid() is null or p_delta=0 then raise exception 'invalid_stock_adjustment' using errcode='42501'; end if;
  update public.products set stock_qty=stock_qty+p_delta,updated_at=now()
    where id=p_product_id and public.is_store_catalog_operator(store_id) and stock_qty+p_delta>=0 returning stock_qty into v_qty;
  if v_qty is null then raise exception 'product_not_found_or_insufficient_stock' using errcode='23514'; end if;
  return v_qty;
end $$;
revoke all on function public.adjust_product_sellable_stock(uuid,integer) from public,anon;
grant execute on function public.adjust_product_sellable_stock(uuid,integer) to authenticated;
alter function public.adjust_product_sellable_stock(uuid,integer) security definer;
revoke insert,update,delete on public.products from anon,authenticated;
grant insert(store_id,name,category,unit,cost_price,sell_price,stock_qty,reorder_point,reorder_qty,is_active,description,photo_url,is_published,supports_pickup,supports_delivery) on public.products to authenticated;
grant update(name,category,unit,cost_price,sell_price,reorder_point,reorder_qty,is_active,description,photo_url,is_published,supports_pickup,supports_delivery) on public.products to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects for select to anon,authenticated using (bucket_id='product-images');
drop policy if exists product_images_partner_insert on storage.objects;
create policy product_images_partner_insert on storage.objects for insert to authenticated with check (bucket_id='product-images' and public.is_store_catalog_operator((storage.foldername(name))[1]::uuid));
drop policy if exists product_images_partner_update on storage.objects;
create policy product_images_partner_update on storage.objects for update to authenticated using (bucket_id='product-images' and public.is_store_catalog_operator((storage.foldername(name))[1]::uuid)) with check (bucket_id='product-images' and public.is_store_catalog_operator((storage.foldername(name))[1]::uuid));
drop policy if exists product_images_partner_delete on storage.objects;
create policy product_images_partner_delete on storage.objects for delete to authenticated using (bucket_id='product-images' and public.is_store_catalog_operator((storage.foldername(name))[1]::uuid));

alter table public.commerce_orders enable row level security;
alter table public.commerce_orders force row level security;
alter table public.commerce_order_items enable row level security;
alter table public.commerce_order_items force row level security;
alter table public.order_status_history enable row level security;
alter table public.order_status_history force row level security;
alter table public.order_deliveries enable row level security;
alter table public.order_deliveries force row level security;
alter table public.order_returns enable row level security;
alter table public.order_returns force row level security;
create policy commerce_orders_related_select on public.commerce_orders for select to authenticated using (user_id=auth.uid() or public.is_store_order_operator(store_id));
create policy commerce_order_items_related_select on public.commerce_order_items for select to authenticated using (exists(select 1 from public.commerce_orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_store_order_operator(o.store_id))));
create policy order_history_related_select on public.order_status_history for select to authenticated using (exists(select 1 from public.commerce_orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_store_order_operator(o.store_id))));
create policy order_deliveries_related_select on public.order_deliveries for select to authenticated using (exists(select 1 from public.commerce_orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_store_order_operator(o.store_id))));
create policy order_returns_related_select on public.order_returns for select to authenticated using (requested_by=auth.uid() or exists(select 1 from public.commerce_orders o where o.id=order_id and public.is_store_order_operator(o.store_id)));
grant select on public.commerce_orders, public.commerce_order_items, public.order_status_history, public.order_deliveries, public.order_returns to authenticated;
revoke insert, update, delete on public.commerce_orders, public.commerce_order_items, public.order_status_history, public.order_deliveries, public.order_returns from anon, authenticated;

create or replace function public.create_commerce_order(
  p_store_id uuid, p_items jsonb, p_fulfillment_method text, p_delivery_address jsonb,
  p_customer_phone text, p_customer_note text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_order public.commerce_orders; v_item jsonb; v_product public.products; v_batch record; v_item_row record; v_batch_stock integer; v_need integer; v_take integer; v_qty integer; v_subtotal numeric(12,2):=0; v_fee numeric(12,2):=0; v_line numeric(12,2);
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 12 and 100 then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
  select * into v_order from public.commerce_orders where user_id=auth.uid() and idempotency_key=p_idempotency_key;
  if found then return v_order.id; end if;
  if p_fulfillment_method not in ('pickup','delivery') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then raise exception 'invalid_order' using errcode='22023'; end if;
  if length(trim(coalesce(p_customer_phone,''))) not between 8 and 30 then raise exception 'customer_phone_required' using errcode='22023'; end if;
  select case when p_fulfillment_method='delivery' then delivery_fee else 0 end into v_fee from public.stores
    where id=p_store_id and is_active and is_verified and can_sell_products
      and (case when p_fulfillment_method='pickup' then supports_pickup else supports_delivery end) for share;
  if not found then raise exception 'store_unavailable_for_fulfillment' using errcode='23514'; end if;
  if p_fulfillment_method='delivery' and (p_delivery_address is null or length(trim(coalesce(p_delivery_address->>'address','')))<5) then raise exception 'delivery_address_required' using errcode='22023'; end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct value->>'product_id') from jsonb_array_elements(p_items)) then raise exception 'duplicate_order_item' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'product_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,1}$'
      or coalesce(v_item->>'expected_unit_price','') !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$' then raise exception 'invalid_order_item' using errcode='22023'; end if;
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and store_id=p_store_id and is_active and is_published for update;
    if not found or coalesce(v_product.stock_qty,0) < v_qty then raise exception 'product_unavailable_or_insufficient_stock' using errcode='23514'; end if;
    if to_regclass('public.inventory_batches') is not null then
      execute 'select coalesce(sum(quantity),0)::integer from public.inventory_batches where product_id=$1 and store_id=$2 and is_active and quantity>0 and (expiry_date is null or expiry_date>current_date)'
        into v_batch_stock using v_product.id,p_store_id;
      if v_batch_stock>0 and v_batch_stock<v_qty then raise exception 'product_batch_stock_unavailable' using errcode='23514'; end if;
    end if;
    if (p_fulfillment_method='pickup' and not v_product.supports_pickup) or (p_fulfillment_method='delivery' and not v_product.supports_delivery) then raise exception 'product_fulfillment_unavailable' using errcode='23514'; end if;
    if coalesce(v_product.sell_price,0)<>(v_item->>'expected_unit_price')::numeric then raise exception 'product_price_changed' using errcode='23514'; end if;
    v_line := coalesce(v_product.sell_price,0) * v_qty;
    v_subtotal := v_subtotal + v_line;
  end loop;
  insert into public.commerce_orders(user_id,store_id,idempotency_key,fulfillment_method,delivery_address,customer_phone,customer_note,subtotal,delivery_fee,total_amount)
    values(auth.uid(),p_store_id,p_idempotency_key,p_fulfillment_method,case when p_fulfillment_method='delivery' then p_delivery_address else null end,trim(p_customer_phone),nullif(trim(p_customer_note),''),v_subtotal,v_fee,v_subtotal+v_fee) returning * into v_order;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and store_id=p_store_id for update;
    v_line := coalesce(v_product.sell_price,0) * v_qty;
    insert into public.commerce_order_items(order_id,product_id,product_name,sku,quantity,unit_price,line_total) values(v_order.id,v_product.id,v_product.name,v_product.sku,v_qty,coalesce(v_product.sell_price,0),v_line);
    update public.products set stock_qty=coalesce(stock_qty,0)-v_qty,updated_at=now() where id=v_product.id;
    if to_regclass('public.stock_movements') is not null then
      execute 'insert into public.stock_movements(store_id,product_id,movement_type,quantity,reference_type,reference_id,reason,performed_by) values($1,$2,''OUT'',$3,''online_order'',$4,''Online order stock reserved'',auth.uid()::text)'
        using p_store_id,v_product.id,-v_qty,v_order.id;
    end if;
    if to_regclass('public.inventory_batches') is not null then
      execute 'select coalesce(sum(quantity),0)::integer from public.inventory_batches where product_id=$1 and store_id=$2 and is_active and quantity>0 and (expiry_date is null or expiry_date>current_date)'
        into v_batch_stock using v_product.id,p_store_id;
      if v_batch_stock>0 then
        v_need:=v_qty;
        for v_batch in execute 'select id,quantity from public.inventory_batches where product_id=$1 and store_id=$2 and is_active and quantity>0 and (expiry_date is null or expiry_date>current_date) order by expiry_date asc nulls last,created_at asc for update' using v_product.id,p_store_id loop
          exit when v_need<=0;
          v_take:=least(v_batch.quantity,v_need);
          execute 'update public.inventory_batches set quantity=$1,is_active=($1>0) where id=$2' using v_batch.quantity-v_take,v_batch.id;
          v_need:=v_need-v_take;
        end loop;
        if v_need>0 then raise exception 'product_batch_stock_unavailable' using errcode='23514'; end if;
      end if;
    end if;
  end loop;
  insert into public.order_status_history(order_id,to_status,changed_by,reason) values(v_order.id,v_order.status,auth.uid(),'Order placed');
  insert into public.notifications(user_id,store_id,order_id,event_type,title,body)
    select recipient.user_id,p_store_id,v_order.id,'order_created','คำสั่งซื้อใหม่','มีคำสั่งซื้อใหม่รอยืนยัน'
    from (select coalesce(s.owner_id,(select st.user_id from public.staff st where st.store_id=s.id and st.is_active and st.user_id is not null order by st.created_at limit 1)) as user_id
      from public.stores s where s.id=p_store_id) recipient
    where recipient.user_id is not null;
  return v_order.id;
exception when unique_violation then
  select * into v_order from public.commerce_orders where user_id=auth.uid() and idempotency_key=p_idempotency_key;
  if v_order.id is not null then return v_order.id; end if; raise;
end $$;
revoke all on function public.create_commerce_order(uuid,jsonb,text,jsonb,text,text,text) from public,anon;
grant execute on function public.create_commerce_order(uuid,jsonb,text,jsonb,text,text,text) to authenticated;

create or replace function public.transition_commerce_order(p_order_id uuid,p_to_status text,p_reason text default null,p_provider text default null,p_tracking_number text default null,p_evidence_url text default null)
returns public.commerce_orders language plpgsql security definer set search_path=public,auth as $$
declare v public.commerce_orders; v_from text; v_allowed boolean:=false; v_item_row record;
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  select * into v from public.commerce_orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode='P0002'; end if;
  v_from:=v.status;
  if public.is_store_order_operator(v.store_id) then
    v_allowed := (v_from='pending_store_confirmation' and p_to_status in ('preparing','rejected'))
      or (v_from='preparing' and p_to_status in ('ready_for_pickup','handed_to_courier'))
      or (v_from='handed_to_courier' and p_to_status in ('delivered','delivery_failed'))
      or (v_from='delivery_failed' and p_to_status='handed_to_courier')
      or (v_from='return_requested' and p_to_status='returned');
  elsif v.user_id=auth.uid() then
    v_allowed := (v_from='pending_store_confirmation' and p_to_status='cancelled')
      or (v_from='ready_for_pickup' and p_to_status in ('completed','cancelled'))
      or (v_from='delivered' and p_to_status in ('completed','return_requested'))
      or (v_from='completed' and p_to_status='return_requested' and v.created_at >= now()-interval '7 days');
  end if;
  if not v_allowed then raise exception 'order_transition_denied' using errcode='42501'; end if;
  if p_to_status in ('rejected','delivery_failed') and length(trim(coalesce(p_reason,'')))<3 then raise exception 'transition_reason_required' using errcode='22023'; end if;
  if p_to_status='cancelled' and length(trim(coalesce(p_reason,'')))<3 then raise exception 'transition_reason_required' using errcode='22023'; end if;
  if p_to_status='handed_to_courier' and length(trim(coalesce(p_provider,'')))<2 then raise exception 'delivery_provider_required' using errcode='22023'; end if;
  if p_to_status='return_requested' then
    if length(trim(coalesce(p_reason,'')))<3 then raise exception 'return_reason_required' using errcode='22023'; end if;
    insert into public.order_returns(order_id,requested_by,reason,evidence_url) values(v.id,auth.uid(),trim(p_reason),p_evidence_url);
  end if;
  if p_to_status in ('handed_to_courier','delivered') then
    insert into public.order_deliveries(order_id,provider,tracking_number,proof_url,delivered_at) values(v.id,p_provider,p_tracking_number,p_evidence_url,case when p_to_status='delivered' then now() end)
      on conflict(order_id) do update set provider=coalesce(excluded.provider,order_deliveries.provider),tracking_number=coalesce(excluded.tracking_number,order_deliveries.tracking_number),proof_url=coalesce(excluded.proof_url,order_deliveries.proof_url),delivered_at=coalesce(excluded.delivered_at,order_deliveries.delivered_at);
  end if;
  update public.commerce_orders set status=p_to_status,updated_at=now() where id=v.id returning * into v;
  insert into public.order_status_history(order_id,from_status,to_status,changed_by,reason) values(v.id,v_from,p_to_status,auth.uid(),nullif(trim(p_reason),''));
  if p_to_status='returned' then update public.order_returns set resolution='returned',received_at=now() where order_id=v.id and resolution is null; end if;
  if p_to_status in ('rejected','cancelled','returned') then
    update public.products p set stock_qty=coalesce(p.stock_qty,0)+i.quantity,updated_at=now() from public.commerce_order_items i where i.order_id=v.id and i.product_id=p.id;
    if to_regclass('public.inventory_batches') is not null then
      for v_item_row in select product_id,quantity from public.commerce_order_items where order_id=v.id and product_id is not null loop
        execute 'insert into public.inventory_batches(store_id,product_id,lot_number,batch_number,quantity,initial_qty,is_active,received_date,notes) values($1,$2,$3,$3,$4,$4,true,current_date,$5)'
          using v.store_id,v_item_row.product_id,'RETURN-'||replace(v.id::text,'-','')||'-'||substr(v_item_row.product_id::text,1,8),v_item_row.quantity,'Returned/restocked from online order '||v.id;
        if to_regclass('public.stock_movements') is not null then
          execute 'insert into public.stock_movements(store_id,product_id,movement_type,quantity,reference_type,reference_id,reason,performed_by) values($1,$2,''IN'',$3,''online_order'',$4,$5,auth.uid()::text)'
            using v.store_id,v_item_row.product_id,v_item_row.quantity,v.id,'Online order stock released: '||p_to_status;
        end if;
      end loop;
    end if;
  end if;
  insert into public.notifications(user_id,store_id,order_id,event_type,title,body) values(v.user_id,v.store_id,v.id,'order_'||p_to_status,'อัปเดตคำสั่งซื้อ',coalesce(nullif(trim(p_reason),''),p_to_status));
  return v;
end $$;
revoke all on function public.transition_commerce_order(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.transition_commerce_order(uuid,text,text,text,text,text) to authenticated;
