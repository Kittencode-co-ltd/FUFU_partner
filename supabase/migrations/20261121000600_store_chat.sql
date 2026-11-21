-- Phase 6: customers chat with any FUFU store (clinic, shop, grooming, hotel) — text and photos.
--   chat_threads   one per (customer, store); unread counters for each side
--   chat_messages  sender is 'user' or 'store'; body and/or a photo in the private chat-images bucket
-- Customers always see the store's phone. Stores see the customer's phone only inside a chat the customer started
-- (that is the "related" rule: the customer contacted this store). All writes go through the functions below.
-- The recipient gets one in-app notification per run of unread messages, not one per message.

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_preview text,
  last_sender text check (last_sender in ('user','store')),
  user_unread integer not null default 0,
  store_unread integer not null default 0
);
create unique index chat_threads_user_store_uniq on public.chat_threads(user_id, store_id);
create index chat_threads_store_idx on public.chat_threads(store_id, last_message_at desc);
create index chat_threads_user_idx on public.chat_threads(user_id, last_message_at desc);
alter table public.chat_threads enable row level security;
create policy chat_threads_read on public.chat_threads for select to authenticated
  using (user_id = auth.uid() or public.is_store_member(store_id));

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender text not null check (sender in ('user','store')),
  sender_id uuid,
  body text check (body is null or length(body) <= 2000),
  image_path text check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  created_at timestamptz not null default now(),
  check (coalesce(length(trim(body)), 0) > 0 or image_path is not null)
);
create index chat_messages_thread_idx on public.chat_messages(thread_id, created_at desc);
alter table public.chat_messages enable row level security;
create policy chat_messages_read on public.chat_messages for select to authenticated
  using (exists (select 1 from public.chat_threads t where t.id = thread_id and (t.user_id = auth.uid() or public.is_store_member(t.store_id))));

-- ── Photos: private bucket, path = <thread id>/<uuid>.<ext>, only the two sides of the chat ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create or replace function public._chat_member(p_thread text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_threads t where t.id::text = p_thread and (t.user_id = auth.uid() or public.is_store_member(t.store_id)))
$$;
revoke all on function public._chat_member(text) from public, anon;
grant execute on function public._chat_member(text) to authenticated;

create policy chat_images_read on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and public._chat_member((storage.foldername(name))[1]));
create policy chat_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and public._chat_member((storage.foldername(name))[1]));

-- ── Functions ───────────────────────────────────────────────────────────────
-- Customer opens (or reopens) a chat with a store that is live on FUFU
create or replace function public.start_chat(p_store_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  if not exists (select 1 from stores where id = p_store_id and is_active and coalesce(is_verified, false)) then
    return jsonb_build_object('ok', false, 'code', 'store_unavailable'); end if;
  if public.is_store_member(p_store_id) then return jsonb_build_object('ok', false, 'code', 'own_store'); end if;
  insert into chat_threads(store_id, user_id) values (p_store_id, auth.uid())
  on conflict (user_id, store_id) do update set store_id = excluded.store_id
  returning id into v_id;
  return jsonb_build_object('ok', true, 'thread_id', v_id);
end $$;

create or replace function public.send_chat_message(p_thread_id uuid, p_body text, p_image_path text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t chat_threads; v_side text; v_body text := nullif(trim(coalesce(p_body, '')), ''); m chat_messages;
  v_preview text; v_store stores; v_name text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  select * into t from chat_threads where id = p_thread_id for update;
  if t.id is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  v_side := case when t.user_id = auth.uid() then 'user' when public.is_store_member(t.store_id) then 'store' end;
  if v_side is null then raise exception 'not part of this chat' using errcode = '42501'; end if;
  if v_body is null and p_image_path is null then return jsonb_build_object('ok', false, 'code', 'empty'); end if;
  if length(coalesce(v_body, '')) > 2000 then return jsonb_build_object('ok', false, 'code', 'too_long'); end if;
  if p_image_path is not null and split_part(p_image_path, '/', 1) <> t.id::text then return jsonb_build_object('ok', false, 'code', 'bad_image'); end if;
  if (select count(*) from chat_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'code', 'too_fast'); end if;

  insert into chat_messages(thread_id, sender, sender_id, body, image_path) values (t.id, v_side, auth.uid(), v_body, p_image_path) returning * into m;
  v_preview := coalesce(left(v_body, 120), '📷');
  update chat_threads set last_message_at = m.created_at, last_preview = v_preview, last_sender = v_side,
    user_unread = case when v_side = 'store' then user_unread + 1 else user_unread end,
    store_unread = case when v_side = 'user' then store_unread + 1 else store_unread end
  where id = t.id;

  -- First unread message → one notification for the other side
  select * into v_store from stores where id = t.store_id;
  if v_side = 'store' and t.user_unread = 0 then
    insert into notifications(user_id, title, body, category, event_type, store_id)
    values (t.user_id, v_store.name, v_preview, 'chat', 'chat_message', t.store_id);
  elsif v_side = 'user' and t.store_unread = 0 and v_store.owner_id is not null then
    select coalesce(nullif(trim(full_name), ''), split_part(email, '@', 1)) into v_name from profiles where id = t.user_id;
    insert into notifications(user_id, title, body, category, event_type, store_id)
    values (v_store.owner_id, 'ข้อความใหม่จาก ' || coalesce(v_name, 'ลูกค้า'), v_preview, 'chat', 'chat_message', t.store_id);
  end if;
  return jsonb_build_object('ok', true, 'message', to_jsonb(m));
end $$;

create or replace function public.mark_chat_read(p_thread_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t chat_threads;
begin
  select * into t from chat_threads where id = p_thread_id;
  if t.id is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if t.user_id = auth.uid() then update chat_threads set user_unread = 0 where id = t.id and user_unread <> 0;
  elsif public.is_store_member(t.store_id) then update chat_threads set store_unread = 0 where id = t.id and store_unread <> 0;
  else raise exception 'not part of this chat' using errcode = '42501'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Store inbox: customer name, avatar and phone (the customer started this chat, so the store may call them back)
create or replace function public.store_chat_threads(p_store_id uuid)
returns table(id uuid, user_id uuid, customer_name text, customer_phone text, avatar_url text, last_message_at timestamptz,
              last_preview text, last_sender text, unread integer, linked boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this store' using errcode = '42501'; end if;
  return query
    select t.id, t.user_id,
           coalesce(nullif(trim(p.full_name), ''), o.name, split_part(p.email, '@', 1)),
           coalesce(nullif(trim(p.phone), ''), o.phone),
           p.avatar_url, t.last_message_at, t.last_preview, t.last_sender, t.store_unread,
           exists (select 1 from clinic_links l where l.store_id = t.store_id and l.user_id = t.user_id and l.status = 'active')
    from chat_threads t
    left join profiles p on p.id = t.user_id
    left join lateral (select po.name, po.phone from pet_owners po where po.auth_user_id = t.user_id
                      and exists (select 1 from pets pt where pt.owner_id = po.id and pt.store_id = t.store_id) limit 1) o on true
    where t.store_id = p_store_id
    order by t.last_message_at desc
    limit 200;
end $$;

revoke all on function public.start_chat(uuid) from public, anon;
revoke all on function public.send_chat_message(uuid, text, text) from public, anon;
revoke all on function public.mark_chat_read(uuid) from public, anon;
revoke all on function public.store_chat_threads(uuid) from public, anon;
grant execute on function public.start_chat(uuid), public.send_chat_message(uuid, text, text), public.mark_chat_read(uuid),
  public.store_chat_threads(uuid) to authenticated;
