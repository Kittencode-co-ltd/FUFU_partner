-- Index commerce foreign keys used for joins and row deletion checks.
create index if not exists commerce_order_items_product_idx on public.commerce_order_items(product_id) where product_id is not null;
create index if not exists order_returns_requested_by_idx on public.order_returns(requested_by);
create index if not exists order_returns_order_idx on public.order_returns(order_id);
create index if not exists stores_owner_id_idx on public.stores(owner_id) where owner_id is not null;

-- Merge public catalog visibility and partner read access into one SELECT policy.
-- The helper returns false for anon callers, so granting it is safe for policy evaluation.
grant execute on function public.is_store_catalog_operator(uuid) to anon;
drop policy if exists products_partner_manage on public.products;
drop policy if exists products_public_store_discovery on public.products;
drop policy if exists products_select_visible_or_manage on public.products;
drop policy if exists products_partner_insert on public.products;
drop policy if exists products_partner_update on public.products;
drop policy if exists products_partner_delete on public.products;
create policy products_select_visible_or_manage on public.products for select to anon, authenticated
  using (public.is_store_catalog_operator(store_id) or (is_active and is_published and stock_qty > 0 and exists(
    select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified and s.can_sell_products)));
create policy products_partner_insert on public.products for insert to authenticated
  with check (public.is_store_catalog_operator(store_id));
create policy products_partner_update on public.products for update to authenticated
  using (public.is_store_catalog_operator(store_id)) with check (public.is_store_catalog_operator(store_id));
create policy products_partner_delete on public.products for delete to authenticated
  using (public.is_store_catalog_operator(store_id));

-- Evaluate caller identity once per statement in related-order policies.
drop policy if exists commerce_orders_related_select on public.commerce_orders;
create policy commerce_orders_related_select on public.commerce_orders for select to authenticated
  using (user_id=(select auth.uid()) or public.is_store_order_operator(store_id));
drop policy if exists commerce_order_items_related_select on public.commerce_order_items;
create policy commerce_order_items_related_select on public.commerce_order_items for select to authenticated
  using (exists(select 1 from public.commerce_orders o where o.id=order_id and (o.user_id=(select auth.uid()) or public.is_store_order_operator(o.store_id))));
drop policy if exists order_history_related_select on public.order_status_history;
create policy order_history_related_select on public.order_status_history for select to authenticated
  using (exists(select 1 from public.commerce_orders o where o.id=order_id and (o.user_id=(select auth.uid()) or public.is_store_order_operator(o.store_id))));
drop policy if exists order_deliveries_related_select on public.order_deliveries;
create policy order_deliveries_related_select on public.order_deliveries for select to authenticated
  using (exists(select 1 from public.commerce_orders o where o.id=order_id and (o.user_id=(select auth.uid()) or public.is_store_order_operator(o.store_id))));
drop policy if exists order_returns_related_select on public.order_returns;
create policy order_returns_related_select on public.order_returns for select to authenticated
  using (requested_by=(select auth.uid()) or exists(select 1 from public.commerce_orders o where o.id=order_id and public.is_store_order_operator(o.store_id)));
notify pgrst, 'reload schema';