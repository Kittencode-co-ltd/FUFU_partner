-- Phase 2: customers link their App account to clinics (scan the clinic QR, type its code, or use a
-- one-time invite from staff that also attaches the clinic's existing customer record and pets).
-- Clinics only see WHO linked in this phase; health-data sharing by consent comes in phase 3.
-- All writes go through the functions below; tables have read-only RLS.

-- ── Links ───────────────────────────────────────────────────────────────────
create table public.clinic_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  owner_id uuid references public.pet_owners(id) on delete set null,   -- the clinic's customer record, when matched
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active','revoked')),
  linked_via text not null check (linked_via in ('store_code','invite','nearby')),
  consent jsonb not null default '{}'::jsonb check (jsonb_typeof(consent) = 'object'),  -- used from phase 3
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index clinic_links_user_store_uniq on public.clinic_links(user_id, store_id);
create unique index clinic_links_one_primary on public.clinic_links(user_id) where is_primary and status = 'active';
create index clinic_links_store_active_idx on public.clinic_links(store_id) where status = 'active';
alter table public.clinic_links enable row level security;
create policy clinic_links_self_read on public.clinic_links for select to authenticated using (user_id = auth.uid());
create policy clinic_links_store_read on public.clinic_links for select to authenticated using (public.is_store_member(store_id));

-- ── Codes ───────────────────────────────────────────────────────────────────
-- store: the clinic's permanent code (printed as a QR poster). invite: one-time, tied to a customer record, 7 days.
create table public.clinic_link_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null unique check (code ~ '^[2-9A-HJ-NP-Z]{6}$'),
  kind text not null check (kind in ('store','invite')),
  owner_id uuid references public.pet_owners(id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid,
  revoked_at timestamptz,
  check (kind = 'store' or (owner_id is not null and expires_at is not null))
);
create unique index clinic_link_codes_one_store_code on public.clinic_link_codes(store_id) where kind = 'store' and revoked_at is null;
alter table public.clinic_link_codes enable row level security;
create policy clinic_link_codes_store_read on public.clinic_link_codes for select to authenticated using (public.is_store_member(store_id));

-- Failed / successful code entries, for rate limiting guesses. No direct access.
create table public.clinic_link_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index clinic_link_attempts_user_time on public.clinic_link_attempts(user_id, created_at);
alter table public.clinic_link_attempts enable row level security;

-- A clinic pet merged into the customer's App pet points at it (and is deactivated).
alter table public.pets add column if not exists merged_into uuid references public.pets(id);

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public._clinic_new_code() returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 31), 1), '')
  from generate_series(1, 6)
$$;
revoke all on function public._clinic_new_code() from public, anon, authenticated;

create or replace function public._is_vet_store(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from stores s where s.id = p_store_id and s.is_active and s.is_verified
                 and lower(s.category) in ('vet_clinic','vet_hospital'))
$$;
revoke all on function public._is_vet_store(uuid) from public, anon;

-- ── Staff: clinic code and customer invites ────────────────────────────────
create or replace function public.clinic_store_code(p_store_id uuid, p_rotate boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this clinic' using errcode = '42501'; end if;
  if not exists (select 1 from stores where id = p_store_id and lower(category) in ('vet_clinic','vet_hospital')) then
    raise exception 'only clinics have link codes' using errcode = '22023'; end if;
  if p_rotate then update clinic_link_codes set revoked_at = now() where store_id = p_store_id and kind = 'store' and revoked_at is null; end if;
  select code into v_code from clinic_link_codes where store_id = p_store_id and kind = 'store' and revoked_at is null;
  while v_code is null loop
    begin
      insert into clinic_link_codes(store_id, code, kind) values (p_store_id, public._clinic_new_code(), 'store') returning code into v_code;
    exception when unique_violation then v_code := null; end;
  end loop;
  return v_code;
end $$;

create or replace function public.clinic_invite_code(p_store_id uuid, p_owner_id uuid)
returns table(code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_code text; v_exp timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this clinic' using errcode = '42501'; end if;
  if not exists (select 1 from pets where owner_id = p_owner_id and store_id = p_store_id) then
    raise exception 'customer not found at this clinic' using errcode = 'P0002'; end if;
  update clinic_link_codes set revoked_at = now() where store_id = p_store_id and owner_id = p_owner_id and kind = 'invite' and used_at is null and revoked_at is null;
  loop
    begin
      insert into clinic_link_codes(store_id, code, kind, owner_id, expires_at) values (p_store_id, public._clinic_new_code(), 'invite', p_owner_id, v_exp) returning clinic_link_codes.code into v_code;
      exit;
    exception when unique_violation then null; end;
  end loop;
  return query select v_code, v_exp;
end $$;

-- Linked customers for the Portal (name only in this phase)
create or replace function public.clinic_linked_customers(p_store_id uuid)
returns table(link_id uuid, user_id uuid, full_name text, owner_id uuid, owner_name text, linked_via text, is_primary boolean, linked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this clinic' using errcode = '42501'; end if;
  return query
    select l.id, l.user_id, coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)), l.owner_id, o.name, l.linked_via, l.is_primary, l.created_at
    from clinic_links l
    left join profiles p on p.id = l.user_id
    left join pet_owners o on o.id = l.owner_id
    where l.store_id = p_store_id and l.status = 'active'
    order by l.created_at desc;
end $$;

-- ── Customer: link, choose primary, unlink, merge ──────────────────────────
create or replace function public._link_upsert(p_user uuid, p_store uuid, p_owner uuid, p_via text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_primary boolean := not exists (select 1 from clinic_links where user_id = p_user and is_primary and status = 'active' and store_id <> p_store);
begin
  insert into clinic_links(user_id, store_id, owner_id, linked_via, is_primary)
  values (p_user, p_store, p_owner, p_via, v_primary)
  on conflict (user_id, store_id) do update set
    status = 'active', revoked_at = null, updated_at = now(),
    owner_id = coalesce(excluded.owner_id, clinic_links.owner_id),
    linked_via = case when clinic_links.status = 'revoked' then excluded.linked_via else clinic_links.linked_via end,
    is_primary = clinic_links.is_primary or excluded.is_primary;
  return (select is_primary from clinic_links where user_id = p_user and store_id = p_store);
end $$;
revoke all on function public._link_upsert(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.link_clinic_by_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  c clinic_link_codes;
  v_store stores;
  v_owner pet_owners;
  v_primary boolean;
  v_pets int := 0;
  v_dupes jsonb := '[]'::jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  if (select count(*) from clinic_link_attempts where user_id = v_uid and not ok and created_at > now() - interval '15 minutes') >= 10 then
    return jsonb_build_object('ok', false, 'code', 'too_many_attempts');
  end if;
  select * into c from clinic_link_codes
   where code = v_code and revoked_at is null and (expires_at is null or expires_at > now()) and (kind = 'store' or used_at is null);
  if not found then
    insert into clinic_link_attempts(user_id, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'code', 'invalid_code');
  end if;
  select * into v_store from stores where id = c.store_id;
  if not public._is_vet_store(c.store_id) then return jsonb_build_object('ok', false, 'code', 'clinic_unavailable'); end if;

  if c.kind = 'invite' then
    select * into v_owner from pet_owners where id = c.owner_id for update;
    if v_owner.auth_user_id is not null and v_owner.auth_user_id <> v_uid then
      return jsonb_build_object('ok', false, 'code', 'invite_taken');
    end if;
    update pet_owners set auth_user_id = v_uid, updated_at = now() where id = c.owner_id;
    -- The clinic's pets for this customer now show in their App
    update pets set user_id = v_uid where owner_id = c.owner_id and user_id is null and merged_into is null and coalesce(is_active, true);
    get diagnostics v_pets = row_count;
    update clinic_link_codes set used_at = now(), used_by = v_uid where id = c.id;
    -- Same name + species already in the App: ask the customer whether it is the same pet
    select coalesce(jsonb_agg(jsonb_build_object('clinic_pet_id', cp.id, 'app_pet_id', ap.id, 'name', cp.name, 'species', cp.species)), '[]'::jsonb)
      into v_dupes
      from pets cp
      join pets ap on ap.user_id = v_uid and ap.id <> cp.id and ap.merged_into is null and coalesce(ap.is_active, true)
                  and lower(trim(ap.name)) = lower(trim(cp.name)) and lower(ap.species) = lower(cp.species)
                  and (ap.owner_id is distinct from c.owner_id)
     where cp.owner_id = c.owner_id and cp.user_id = v_uid and cp.merged_into is null and coalesce(cp.is_active, true);
  end if;

  v_primary := public._link_upsert(v_uid, c.store_id, case when c.kind = 'invite' then c.owner_id end, case when c.kind = 'invite' then 'invite' else 'store_code' end);
  insert into clinic_link_attempts(user_id, ok) values (v_uid, true);
  return jsonb_build_object('ok', true, 'store_id', v_store.id, 'store_name', v_store.name, 'is_primary', v_primary,
                            'kind', c.kind, 'linked_pets', v_pets, 'duplicates', v_dupes);
end $$;

create or replace function public.link_clinic(p_store_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_primary boolean;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  if not public._is_vet_store(p_store_id) then return jsonb_build_object('ok', false, 'code', 'clinic_unavailable'); end if;
  v_primary := public._link_upsert(auth.uid(), p_store_id, null, 'nearby');
  return jsonb_build_object('ok', true, 'store_id', p_store_id, 'is_primary', v_primary);
end $$;

create or replace function public.set_primary_clinic(p_store_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  if not exists (select 1 from clinic_links where user_id = auth.uid() and store_id = p_store_id and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'not_linked'); end if;
  update clinic_links set is_primary = false, updated_at = now() where user_id = auth.uid() and is_primary and store_id <> p_store_id;
  update clinic_links set is_primary = true, updated_at = now() where user_id = auth.uid() and store_id = p_store_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.unlink_clinic(p_store_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  update clinic_links set status = 'revoked', is_primary = false, revoked_at = now(), updated_at = now()
   where user_id = auth.uid() and store_id = p_store_id and status = 'active';
  if not found then return jsonb_build_object('ok', false, 'code', 'not_linked'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Customer confirms "the clinic's Mochi is my Mochi": the App pet keeps its id; the clinic's history moves onto it.
create or replace function public.merge_clinic_pet(p_clinic_pet uuid, p_app_pet uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); cp pets; ap pets;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  select * into cp from pets where id = p_clinic_pet for update;
  select * into ap from pets where id = p_app_pet for update;
  if cp.id is null or ap.id is null or cp.id = ap.id
     or cp.user_id is distinct from v_uid or ap.user_id is distinct from v_uid
     or cp.store_id is null or cp.owner_id is null or cp.merged_into is not null or ap.merged_into is not null
     or not exists (select 1 from pet_owners where id = cp.owner_id and auth_user_id = v_uid) then
    return jsonb_build_object('ok', false, 'code', 'cannot_merge');
  end if;
  if lower(cp.species) <> lower(ap.species) then return jsonb_build_object('ok', false, 'code', 'species_differ'); end if;
  if ap.store_id is not null and ap.store_id <> cp.store_id then return jsonb_build_object('ok', false, 'code', 'pet_in_other_clinic'); end if;

  update appointments      set pet_id = ap.id where pet_id = cp.id;
  update queue_entries     set pet_id = ap.id where pet_id = cp.id;
  update medical_records   set pet_id = ap.id where pet_id = cp.id;
  update pet_vaccinations  set pet_id = ap.id where pet_id = cp.id;
  update ipd_admissions    set pet_id = ap.id where pet_id = cp.id;
  update hotel_bookings    set pet_id = ap.id where pet_id = cp.id;
  update grooming_sessions set pet_id = ap.id where pet_id = cp.id;
  update grooming_records  set pet_id = ap.id where pet_id = cp.id;
  update health_records    set pet_id = ap.id where pet_id = cp.id;
  update vaccinations      set pet_id = ap.id where pet_id = cp.id;
  update scan_results      set pet_id = ap.id where pet_id = cp.id;

  update pets set
    store_id = cp.store_id, owner_id = coalesce(ap.owner_id, cp.owner_id), hn = coalesce(ap.hn, cp.hn),
    breed = coalesce(nullif(trim(ap.breed), ''), cp.breed), dob = coalesce(ap.dob, cp.dob), age = coalesce(ap.age, cp.age),
    weight_kg = coalesce(ap.weight_kg, cp.weight_kg), gender = coalesce(nullif(ap.gender, ''), cp.gender),
    color = coalesce(nullif(ap.color, ''), cp.color), microchip_no = coalesce(nullif(ap.microchip_no, ''), cp.microchip_no),
    is_neutered = coalesce(ap.is_neutered, false) or coalesce(cp.is_neutered, false),
    allergies = coalesce(nullif(trim(ap.allergies), ''), cp.allergies), updated_at = now()
  where id = ap.id;
  update pets set is_active = false, merged_into = ap.id, user_id = null, hn = null, updated_at = now() where id = cp.id;
  return jsonb_build_object('ok', true, 'pet_id', ap.id);
end $$;

-- ── Grants ─────────────────────────────────────────────────────────────────
revoke all on function public.clinic_store_code(uuid, boolean) from public, anon;
revoke all on function public.clinic_invite_code(uuid, uuid) from public, anon;
revoke all on function public.clinic_linked_customers(uuid) from public, anon;
revoke all on function public.link_clinic_by_code(text) from public, anon;
revoke all on function public.link_clinic(uuid) from public, anon;
revoke all on function public.set_primary_clinic(uuid) from public, anon;
revoke all on function public.unlink_clinic(uuid) from public, anon;
revoke all on function public.merge_clinic_pet(uuid, uuid) from public, anon;
grant execute on function public.clinic_store_code(uuid, boolean), public.clinic_invite_code(uuid, uuid), public.clinic_linked_customers(uuid),
  public.link_clinic_by_code(text), public.link_clinic(uuid), public.set_primary_clinic(uuid), public.unlink_clinic(uuid),
  public.merge_clinic_pet(uuid, uuid) to authenticated;
