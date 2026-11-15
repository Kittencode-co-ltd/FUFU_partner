-- Keep anonymous catalog reads public-only; partner visibility is authenticated-only.
revoke execute on function public.is_store_catalog_operator(uuid) from anon;
drop policy if exists products_select_visible_or_manage on public.products;
drop policy if exists products_public_store_discovery on public.products;
create policy products_select_visible_or_manage on public.products for select to authenticated
  using (public.is_store_catalog_operator(store_id) or (is_active and is_published and stock_qty > 0 and exists(
    select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified and s.can_sell_products)));
create policy products_public_store_discovery on public.products for select to anon
  using (is_active and is_published and stock_qty > 0 and exists(
    select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified and s.can_sell_products));
notify pgrst, 'reload schema';