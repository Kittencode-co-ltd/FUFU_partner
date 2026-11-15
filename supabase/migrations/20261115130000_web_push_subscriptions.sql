-- Web Push (VAPID) for the customer App, the Partner Portal and the Admin console.
--
-- * push_subscriptions stores one row per user, browser endpoint and system.
-- * Database triggers queue a call to the `send-web-push` edge function through pg_net.
--   The function URL and shared secret come from Supabase Vault (names below), so no
--   secret lives in this file. Without those Vault entries the triggers do nothing.
-- * Push delivery never blocks or rolls back the booking, review or store write.

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  system text not null check (system in ('app','portal','admin')),
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) between 1 and 255),
  auth text not null check (char_length(auth) between 1 and 255),
  locale text not null default 'th' check (locale in ('th','en','zh','ja','ko')),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0,
  unique (user_id, endpoint, system)
);
create index if not exists push_subscriptions_target_idx on public.push_subscriptions(system, user_id);
create index if not exists push_subscriptions_endpoint_idx on public.push_subscriptions(endpoint);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

-- Users manage only their own rows. Admin rows are written by the Admin console's
-- server route (service role, after its ADMIN_EMAILS check), never from a browser.
drop policy if exists push_subscriptions_own_select on public.push_subscriptions;
drop policy if exists push_subscriptions_own_insert on public.push_subscriptions;
drop policy if exists push_subscriptions_own_update on public.push_subscriptions;
drop policy if exists push_subscriptions_own_delete on public.push_subscriptions;
create policy push_subscriptions_own_select on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid() and system in ('app','portal'));
create policy push_subscriptions_own_update on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and system in ('app','portal'));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Register (or refresh) the caller's subscription. A browser endpoint belongs to one
-- signed-in account per system, so a row left behind by a previous account on the same
-- browser is removed; otherwise that account would keep receiving pushes here.
create or replace function public.register_push_subscription(
  p_system text, p_endpoint text, p_p256dh text, p_auth text,
  p_locale text default 'th', p_user_agent text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_system not in ('app','portal') then raise exception 'unsupported push system' using errcode = '22023'; end if;
  delete from public.push_subscriptions
    where endpoint = p_endpoint and system = p_system and user_id <> auth.uid();
  insert into public.push_subscriptions(user_id, system, endpoint, p256dh, auth, locale, user_agent)
    values (auth.uid(), p_system, p_endpoint, p_p256dh, p_auth,
      case when p_locale in ('th','en','zh','ja','ko') then p_locale else 'th' end, left(p_user_agent, 512))
  on conflict (user_id, endpoint, system) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, locale = excluded.locale,
        user_agent = excluded.user_agent, failure_count = 0, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.register_push_subscription(text,text,text,text,text,text) from public, anon;
grant execute on function public.register_push_subscription(text,text,text,text,text,text) to authenticated;

-- Queue one push job. Reads Vault secrets `web_push_function_url` and
-- `web_push_webhook_secret`; skips quietly when either is missing.
create or replace function public.dispatch_web_push(p_kind text, p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'web_push_function_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'web_push_webhook_secret' limit 1;
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('kind', p_kind, 'id', p_id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'web push dispatch skipped (%): %', p_kind, sqlerrm;
end $$;
revoke all on function public.dispatch_web_push(text, uuid) from public, anon, authenticated;

create or replace function public.push_on_notification_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id is not null then perform public.dispatch_web_push('notification', new.id); end if;
  return new;
end $$;

create or replace function public.push_on_booking_request()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.store_id is not null and new.status in ('requested','Pending') then
    perform public.dispatch_web_push('booking_requested', new.id);
  end if;
  return new;
end $$;

create or replace function public.push_on_store_review()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'published' then perform public.dispatch_web_push('review_created', new.id); end if;
  return new;
end $$;

create or replace function public.push_on_store_pending()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.verification_status = 'pending'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'pending') then
    perform public.dispatch_web_push('store_pending', new.id);
  end if;
  return new;
end $$;

revoke all on function public.push_on_notification_insert() from public, anon, authenticated;
revoke all on function public.push_on_booking_request() from public, anon, authenticated;
revoke all on function public.push_on_store_review() from public, anon, authenticated;
revoke all on function public.push_on_store_pending() from public, anon, authenticated;

drop trigger if exists push_on_notification_insert on public.notifications;
create trigger push_on_notification_insert after insert on public.notifications
  for each row execute function public.push_on_notification_insert();

drop trigger if exists push_on_booking_request on public.appointments;
create trigger push_on_booking_request after insert on public.appointments
  for each row execute function public.push_on_booking_request();

drop trigger if exists push_on_store_review on public.store_reviews;
create trigger push_on_store_review after insert on public.store_reviews
  for each row execute function public.push_on_store_review();

drop trigger if exists push_on_store_pending on public.stores;
create trigger push_on_store_pending after insert or update of verification_status on public.stores
  for each row execute function public.push_on_store_pending();
