-- Shared customer reviews, partner replies, moderation state, and store rating summary.
alter table public.stores
  add column if not exists review_average numeric(2,1) not null default 0,
  add column if not exists review_count integer not null default 0;

create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating numeric(2,1) not null check (rating >= 0 and rating <= 5 and rating = trunc(rating)),
  comment text not null default '' check (char_length(comment) <= 1200),
  status text not null default 'published' check (status in ('published','hidden')),
  partner_reply text check (partner_reply is null or char_length(partner_reply) <= 1200),
  partner_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, user_id)
);
create index if not exists store_reviews_public_idx on public.store_reviews(store_id, created_at desc) where status = 'published';
create index if not exists store_reviews_admin_idx on public.store_reviews(created_at desc, status);

create table if not exists public.store_review_audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  review_id uuid not null references public.store_reviews(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('partner_reply','hidden','published')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists store_review_audit_logs_created_idx on public.store_review_audit_logs(created_at desc);

alter table public.store_reviews enable row level security;
alter table public.store_reviews force row level security;
alter table public.store_review_audit_logs enable row level security;
alter table public.store_review_audit_logs force row level security;
create policy store_reviews_public_read on public.store_reviews for select to anon, authenticated using (status = 'published');
create policy store_reviews_author_read on public.store_reviews for select to authenticated using (user_id = auth.uid());
create policy store_reviews_author_insert on public.store_reviews for insert to authenticated
  with check (user_id = auth.uid() and status = 'published' and partner_reply is null and exists(select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified));
create policy store_reviews_author_update on public.store_reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy store_reviews_partner_read on public.store_reviews for select to authenticated using (public.is_store_member(store_id));
create policy store_reviews_partner_update on public.store_reviews for update to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

create policy store_review_audit_partner_read on public.store_review_audit_logs for select to authenticated using (public.is_store_member(store_id));
create policy store_review_audit_partner_insert on public.store_review_audit_logs for insert to authenticated
  with check (actor_user_id = auth.uid() and action='partner_reply' and public.is_store_member(store_id)
    and exists(select 1 from public.store_reviews r where r.id=store_review_audit_logs.review_id and r.store_id=store_review_audit_logs.store_id));

create or replace function public.guard_store_review_update()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then return new; end if;
  if auth.uid() = old.user_id then
    if (new.store_id,new.user_id,new.status,new.partner_reply,new.partner_replied_at,new.created_at)
       is distinct from (old.store_id,old.user_id,old.status,old.partner_reply,old.partner_replied_at,old.created_at) then
      raise exception 'review author may only edit rating and comment' using errcode='42501';
    end if;
  elsif public.is_store_member(old.store_id) then
    if (new.store_id,new.user_id,new.rating,new.comment,new.status,new.created_at)
       is distinct from (old.store_id,old.user_id,old.rating,old.comment,old.status,old.created_at) then
      raise exception 'partner may only edit reply' using errcode='42501';
    end if;
    new.partner_replied_at := case when new.partner_reply is distinct from old.partner_reply then now() else old.partner_replied_at end;
  else
    raise exception 'review update denied' using errcode='42501';
  end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger guard_store_review_update before update on public.store_reviews for each row execute function public.guard_store_review_update();

create or replace function public.refresh_store_review_summary(target_store uuid)
returns void language sql security definer set search_path=public as $$
  update public.stores s set
    review_count = coalesce((select count(*) from public.store_reviews r where r.store_id=target_store and r.status='published'),0)::integer,
    review_average = coalesce((select round(avg(r.rating),1) from public.store_reviews r where r.store_id=target_store and r.status='published'),0)
  where s.id=target_store;
$$;
revoke all on function public.refresh_store_review_summary(uuid) from public, anon, authenticated;

create or replace function public.update_store_review_summary_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_store_review_summary(coalesce(new.store_id,old.store_id));
  if tg_op='UPDATE' and new.store_id is distinct from old.store_id then perform public.refresh_store_review_summary(old.store_id); end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
revoke all on function public.update_store_review_summary_trigger() from public, anon, authenticated;
create trigger update_store_review_summary after insert or update or delete on public.store_reviews for each row execute function public.update_store_review_summary_trigger();

create or replace function public.submit_store_review(p_store_id uuid, p_rating integer, p_comment text default '')
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid := auth.uid(); v_review public.store_reviews;
begin
  if v_user_id is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 then raise exception 'invalid_rating' using errcode='22023'; end if;
  if char_length(coalesce(p_comment,'')) > 1200 then raise exception 'comment_too_long' using errcode='22023'; end if;
  if not exists(select 1 from public.stores s where s.id=p_store_id and s.is_active and s.is_verified) then raise exception 'store_unavailable' using errcode='42501'; end if;
  insert into public.store_reviews(store_id,user_id,rating,comment)
    values(p_store_id,v_user_id,p_rating,coalesce(p_comment,''))
    on conflict(store_id,user_id) do update set rating=excluded.rating,comment=excluded.comment,updated_at=now()
      where public.store_reviews.status='published'
    returning * into v_review;
  if not found then raise exception 'review_hidden' using errcode='42501'; end if;
  return jsonb_build_object('id',v_review.id,'rating',v_review.rating,'comment',v_review.comment,'created_at',v_review.created_at,'updated_at',v_review.updated_at);
end; $$;
revoke all on function public.submit_store_review(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.submit_store_review(uuid,integer,text) to authenticated;

create or replace function public.get_my_store_review(p_store_id uuid)
returns jsonb language sql stable security definer set search_path=public,auth as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object('rating',r.rating,'comment',r.comment)
    from public.store_reviews r where r.store_id=p_store_id and r.user_id=auth.uid()
  ) end;
$$;
revoke all on function public.get_my_store_review(uuid) from public,anon,authenticated;
grant execute on function public.get_my_store_review(uuid) to authenticated;

revoke all on public.store_reviews from public, anon, authenticated;
revoke all on public.store_review_audit_logs from public, anon, authenticated;
grant select(id,store_id,rating,comment,status,partner_reply,partner_replied_at,created_at,updated_at) on public.store_reviews to anon, authenticated;
grant update(partner_reply) on public.store_reviews to authenticated;
grant select, insert on public.store_review_audit_logs to authenticated;
grant select, insert, update on public.store_reviews to service_role;
grant select, insert on public.store_review_audit_logs to service_role;
grant select (review_average,review_count) on public.stores to anon, authenticated;

-- The shared tenant helper is required by review RLS; constrain its definer context and remove anon RPC access.
alter function public.is_store_member(uuid) set search_path=public,auth;
revoke all on function public.is_store_member(uuid) from public,anon;
grant execute on function public.is_store_member(uuid) to authenticated;

-- Product catalog is optional in fresh deployments; expose only in-stock listings for discovery when present.
do $$ begin
  if to_regclass('public.products') is not null then
    alter table public.products enable row level security;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_public_store_discovery') then
      create policy products_public_store_discovery on public.products for select to anon, authenticated
        using (is_active = true and coalesce(stock_qty,0) > 0 and exists(select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified));
    end if;
    grant select on public.products to anon, authenticated;
  end if;
end $$;

-- Keep the summary current when applying this migration to a database with pre-existing review data.
do $$ declare s record; begin for s in select id from public.stores loop perform public.refresh_store_review_summary(s.id); end loop; end $$;
