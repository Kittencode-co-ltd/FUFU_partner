-- Phase 4: emergency sharing. At a clinic the customer has never linked (e.g. a 2 a.m. emergency), the customer
-- makes a 6-character code / QR in the App. Staff at any FUFU vet clinic enter it in the Portal and see the App data
-- (pet details, health notes, App vaccines, AI scans) for the chosen pets. Never another clinic's records.
--   * valid 72 hours or until the customer stops it; one active code per customer
--   * the first clinic that opens it claims it; no other clinic can use it after that
--   * staff guessing is rate limited; every view is logged (clinic_data_views.via = 'emergency')

-- ── Shares ──────────────────────────────────────────────────────────────────
create table public.emergency_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (code ~ '^[2-9A-HJ-NP-Z]{6}$'),
  pet_ids uuid[] not null check (cardinality(pet_ids) between 1 and 30),
  store_id uuid references public.stores(id) on delete set null,   -- the clinic that opened it
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '72 hours',
  revoked_at timestamptz
);
create unique index emergency_shares_code_active on public.emergency_shares(code) where revoked_at is null;
create index emergency_shares_user_idx on public.emergency_shares(user_id, created_at desc);
create index emergency_shares_store_idx on public.emergency_shares(store_id) where store_id is not null;
alter table public.emergency_shares enable row level security;
create policy emergency_shares_self_read on public.emergency_shares for select to authenticated using (user_id = auth.uid());
create policy emergency_shares_store_read on public.emergency_shares for select to authenticated
  using (store_id is not null and public.is_store_member(store_id));

create table public.emergency_share_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index emergency_share_attempts_user_idx on public.emergency_share_attempts(user_id, created_at desc);
alter table public.emergency_share_attempts enable row level security;   -- no policies: functions only

alter table public.clinic_data_views add column via text not null default 'link' check (via in ('link','emergency'));

-- ── Shared payload (used by linked-clinic sharing and emergency sharing) ────
create or replace function public._shared_payload(p_user uuid, p_pet_ids uuid[], c jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_pets jsonb; v_health jsonb := '[]'; v_vacc jsonb := '[]'; v_scans jsonb := '[]';
begin
  select coalesce(jsonb_agg(
           jsonb_build_object('id', p.id, 'name', p.name, 'species', p.species, 'breed', p.breed, 'hn', p.hn)
           || case when (c->>'profile')::boolean then jsonb_build_object(
                'dob', p.dob, 'age', p.age, 'weight_kg', p.weight_kg, 'gender', p.gender, 'color', p.color,
                'microchip_no', p.microchip_no, 'is_neutered', p.is_neutered, 'allergies', p.allergies,
                'notes', p.notes, 'avatar_url', p.avatar_url) else '{}'::jsonb end
           order by p.name), '[]'::jsonb)
    into v_pets from pets p where p.id = any(p_pet_ids);
  if (c->>'health')::boolean then
    select coalesce(jsonb_agg(to_jsonb(h) order by h.date desc nulls last), '[]'::jsonb) into v_health from (
      select id, pet_id, record_type, title, date, description from health_records
       where user_id = p_user and pet_id = any(p_pet_ids) order by date desc nulls last limit 100) h;
  end if;
  if (c->>'vaccines')::boolean then
    select coalesce(jsonb_agg(to_jsonb(v) order by v.date_administered desc nulls last), '[]'::jsonb) into v_vacc from (
      select id, pet_id, vaccine_name, date_administered, next_due_date, veterinarian, location, notes from vaccinations
       where user_id = p_user and pet_id = any(p_pet_ids) order by date_administered desc nulls last limit 100) v;
  end if;
  if (c->>'scans')::boolean then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.at desc), '[]'::jsonb) into v_scans from (
      select id, pet_id, body_part, diagnosis, confidence, triage_level, screening_status, notes,
             coalesce(scanned_at, created_at) as at from scan_results
       where user_id = p_user and pet_id = any(p_pet_ids) order by coalesce(scanned_at, created_at) desc limit 50) s;
  end if;
  return jsonb_build_object('pets', v_pets, 'health', v_health, 'vaccines', v_vacc, 'scans', v_scans);
end $$;
revoke all on function public._shared_payload(uuid, uuid[], jsonb) from public, anon, authenticated;

create or replace function public._log_data_view(p_store uuid, p_user uuid, p_cats text[], p_via text) returns void
language sql security definer set search_path = public as $$
  insert into clinic_data_views(store_id, user_id, viewer_id, categories, via)
  select p_store, p_user, auth.uid(), p_cats, p_via
   where not exists (select 1 from clinic_data_views where store_id = p_store and user_id = p_user and viewer_id = auth.uid()
                       and via = p_via and viewed_at > now() - interval '10 minutes');
$$;
revoke all on function public._log_data_view(uuid, uuid, text[], text) from public, anon, authenticated;

-- Linked-clinic sharing now uses the shared payload (same behaviour as phase 3)
create or replace function public.clinic_shared_data(p_store_id uuid, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l clinic_links; c jsonb; v_cats text[]; v_pet_ids uuid[];
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then
    raise exception 'not a member of this clinic' using errcode = '42501';
  end if;
  select * into l from clinic_links where store_id = p_store_id and user_id = p_user_id and status = 'active';
  if not found then return jsonb_build_object('ok', false, 'code', 'not_linked'); end if;
  c := public._clinic_consent(l.consent);
  select coalesce(array_agg(k order by k), '{}') into v_cats from jsonb_each(c) e(k, v) where v = 'true'::jsonb;
  if cardinality(v_cats) = 0 then
    return jsonb_build_object('ok', true, 'consent', c, 'asked', l.consent ? 'updated_at', 'pets', '[]'::jsonb,
                              'health', '[]'::jsonb, 'vaccines', '[]'::jsonb, 'scans', '[]'::jsonb);
  end if;
  select coalesce(array_agg(id), '{}') into v_pet_ids from pets
   where user_id = p_user_id and merged_into is null and coalesce(is_active, true)
     and (store_id is null or store_id = p_store_id);
  perform public._log_data_view(p_store_id, p_user_id, v_cats, 'link');
  return jsonb_build_object('ok', true, 'consent', c, 'asked', true, 'shared_at', l.consent->'updated_at')
         || public._shared_payload(p_user_id, v_pet_ids, c);
end $$;

-- ── Customer: make / stop an emergency code ─────────────────────────────────
create or replace function public.create_emergency_share(p_pet_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_ids uuid[]; v_code text; s emergency_shares;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  select coalesce(array_agg(id), '{}') into v_ids from pets
   where id = any(coalesce(p_pet_ids, '{}')) and user_id = v_uid and merged_into is null and coalesce(is_active, true);
  if cardinality(v_ids) = 0 then return jsonb_build_object('ok', false, 'code', 'no_pets'); end if;
  if (select count(*) from emergency_shares where user_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'code', 'too_many'); end if;
  update emergency_shares set revoked_at = now() where user_id = v_uid and revoked_at is null;   -- one active code
  loop
    v_code := public._clinic_new_code();
    exit when not exists (select 1 from emergency_shares where code = v_code and revoked_at is null)
          and not exists (select 1 from clinic_link_codes where code = v_code and revoked_at is null);
  end loop;
  insert into emergency_shares(user_id, code, pet_ids) values (v_uid, v_code, v_ids) returning * into s;
  return jsonb_build_object('ok', true, 'id', s.id, 'code', s.code, 'expires_at', s.expires_at, 'pet_ids', to_jsonb(s.pet_ids));
end $$;

create or replace function public.revoke_emergency_share() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  update emergency_shares set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
  return jsonb_build_object('ok', true);
end $$;

-- ── Clinic: open an emergency code (or re-open one this clinic already claimed) ──
create or replace function public.open_emergency_share(p_store_id uuid, p_code text default null, p_share_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  s emergency_shares; v_ids uuid[]; pr profiles;
  c jsonb := '{"profile":true,"health":true,"vaccines":true,"scans":true}';
begin
  if v_uid is null or not public.is_store_member(p_store_id) then
    raise exception 'not a member of this clinic' using errcode = '42501';
  end if;
  if not public._is_vet_store(p_store_id) then return jsonb_build_object('ok', false, 'code', 'not_a_clinic'); end if;
  if p_share_id is null then
    if (select count(*) from emergency_share_attempts where user_id = v_uid and not ok and created_at > now() - interval '15 minutes') >= 10 then
      return jsonb_build_object('ok', false, 'code', 'too_many_attempts'); end if;
    select * into s from emergency_shares where code = v_code and revoked_at is null and expires_at > now()
      and (store_id is null or store_id = p_store_id) for update;
    if not found then
      insert into emergency_share_attempts(user_id, ok) values (v_uid, false);
      return jsonb_build_object('ok', false, 'code', 'invalid_code');
    end if;
    insert into emergency_share_attempts(user_id, ok) values (v_uid, true);
    if s.store_id is null then
      update emergency_shares set store_id = p_store_id, claimed_at = now() where id = s.id returning * into s;
    end if;
  else
    select * into s from emergency_shares where id = p_share_id and store_id = p_store_id and revoked_at is null and expires_at > now();
    if not found then return jsonb_build_object('ok', false, 'code', 'expired'); end if;
  end if;

  select coalesce(array_agg(id), '{}') into v_ids from pets
   where id = any(s.pet_ids) and user_id = s.user_id and merged_into is null and coalesce(is_active, true);
  select * into pr from profiles where id = s.user_id;
  perform public._log_data_view(p_store_id, s.user_id, array['health','profile','scans','vaccines'], 'emergency');
  return jsonb_build_object('ok', true, 'emergency', true, 'share_id', s.id, 'expires_at', s.expires_at, 'consent', c, 'asked', true,
                            'owner', jsonb_build_object('name', coalesce(nullif(trim(pr.full_name), ''), split_part(pr.email, '@', 1)), 'phone', pr.phone))
         || public._shared_payload(s.user_id, v_ids, c);
end $$;

-- ── Grants ─────────────────────────────────────────────────────────────────
revoke all on function public.clinic_shared_data(uuid, uuid) from public, anon;
revoke all on function public.create_emergency_share(uuid[]) from public, anon;
revoke all on function public.revoke_emergency_share() from public, anon;
revoke all on function public.open_emergency_share(uuid, text, uuid) from public, anon;
grant execute on function public.clinic_shared_data(uuid, uuid), public.create_emergency_share(uuid[]),
  public.revoke_emergency_share(), public.open_emergency_share(uuid, text, uuid) to authenticated;
