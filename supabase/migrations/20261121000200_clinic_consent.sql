-- Phase 3: the customer chooses, per linked clinic, which App data that clinic may see.
--   clinic_links.consent = {"profile":bool,"health":bool,"vaccines":bool,"scans":bool,"updated_at":timestamptz}
--   '{}' means "not asked yet" and shares nothing. Unlinking clears it, so re-linking asks again.
-- Clinics read shared data only through clinic_shared_data(), which checks consent on every call and
-- records the view; the customer can see when each clinic last looked.
-- The clinic's own records (pets with its store_id, medical_records, pet_vaccinations) are unaffected.

-- ── View log ────────────────────────────────────────────────────────────────
create table public.clinic_data_views (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete set null,
  categories text[] not null default '{}',
  viewed_at timestamptz not null default now()
);
create index clinic_data_views_user_idx on public.clinic_data_views(user_id, viewed_at desc);
create index clinic_data_views_store_user_idx on public.clinic_data_views(store_id, user_id, viewed_at desc);
alter table public.clinic_data_views enable row level security;
create policy clinic_data_views_self_read on public.clinic_data_views for select to authenticated using (user_id = auth.uid());
create policy clinic_data_views_store_read on public.clinic_data_views for select to authenticated using (public.is_store_member(store_id));

-- Only true booleans count; anything else is "not shared".
create or replace function public._clinic_consent(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'profile',  coalesce(p->'profile'  = 'true'::jsonb, false),
    'health',   coalesce(p->'health'   = 'true'::jsonb, false),
    'vaccines', coalesce(p->'vaccines' = 'true'::jsonb, false),
    'scans',    coalesce(p->'scans'    = 'true'::jsonb, false))
$$;

-- ── Customer: choose what to share ──────────────────────────────────────────
create or replace function public.set_clinic_consent(p_store_id uuid, p_consent jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  if p_consent is null or jsonb_typeof(p_consent) <> 'object' then return jsonb_build_object('ok', false, 'code', 'invalid'); end if;
  v := public._clinic_consent(p_consent) || jsonb_build_object('updated_at', now());
  update clinic_links set consent = v, updated_at = now()
   where user_id = auth.uid() and store_id = p_store_id and status = 'active';
  if not found then return jsonb_build_object('ok', false, 'code', 'not_linked'); end if;
  return jsonb_build_object('ok', true, 'consent', v);
end $$;

-- Unlinking also stops sharing (re-linking later starts from "not asked").
create or replace function public.unlink_clinic(p_store_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'auth'); end if;
  update clinic_links set status = 'revoked', is_primary = false, consent = '{}'::jsonb, revoked_at = now(), updated_at = now()
   where user_id = auth.uid() and store_id = p_store_id and status = 'active';
  if not found then return jsonb_build_object('ok', false, 'code', 'not_linked'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── Clinic: read what this customer shares ──────────────────────────────────
-- Pets: the customer's own App pets and this clinic's pets for them (never another clinic's records).
create or replace function public.clinic_shared_data(p_store_id uuid, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l clinic_links;
  c jsonb;
  v_cats text[];
  v_pet_ids uuid[];
  v_pets jsonb := '[]'::jsonb;
  v_health jsonb := '[]'::jsonb;
  v_vacc jsonb := '[]'::jsonb;
  v_scans jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then
    raise exception 'not a member of this clinic' using errcode = '42501';
  end if;
  select * into l from clinic_links where store_id = p_store_id and user_id = p_user_id and status = 'active';
  if not found then return jsonb_build_object('ok', false, 'code', 'not_linked'); end if;

  c := public._clinic_consent(l.consent);
  select coalesce(array_agg(k order by k), '{}') into v_cats from jsonb_each(c) e(k, v) where v = 'true'::jsonb;
  if cardinality(v_cats) = 0 then
    return jsonb_build_object('ok', true, 'consent', c, 'asked', l.consent ? 'updated_at', 'pets', v_pets,
                              'health', v_health, 'vaccines', v_vacc, 'scans', v_scans);
  end if;

  select coalesce(array_agg(id), '{}') into v_pet_ids from pets
   where user_id = p_user_id and merged_into is null and coalesce(is_active, true)
     and (store_id is null or store_id = p_store_id);

  select coalesce(jsonb_agg(
           jsonb_build_object('id', p.id, 'name', p.name, 'species', p.species, 'breed', p.breed, 'hn', p.hn)
           || case when (c->>'profile')::boolean then jsonb_build_object(
                'dob', p.dob, 'age', p.age, 'weight_kg', p.weight_kg, 'gender', p.gender, 'color', p.color,
                'microchip_no', p.microchip_no, 'is_neutered', p.is_neutered, 'allergies', p.allergies,
                'notes', p.notes, 'avatar_url', p.avatar_url) else '{}'::jsonb end
           order by p.name), '[]'::jsonb)
    into v_pets from pets p where p.id = any(v_pet_ids);

  if (c->>'health')::boolean then
    select coalesce(jsonb_agg(to_jsonb(h) order by h.date desc nulls last), '[]'::jsonb) into v_health from (
      select id, pet_id, record_type, title, date, description from health_records
       where user_id = p_user_id and pet_id = any(v_pet_ids) order by date desc nulls last limit 100) h;
  end if;
  if (c->>'vaccines')::boolean then
    select coalesce(jsonb_agg(to_jsonb(v) order by v.date_administered desc nulls last), '[]'::jsonb) into v_vacc from (
      select id, pet_id, vaccine_name, date_administered, next_due_date, veterinarian, location, notes from vaccinations
       where user_id = p_user_id and pet_id = any(v_pet_ids) order by date_administered desc nulls last limit 100) v;
  end if;
  if (c->>'scans')::boolean then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.at desc), '[]'::jsonb) into v_scans from (
      select id, pet_id, body_part, diagnosis, confidence, triage_level, screening_status, notes,
             coalesce(scanned_at, created_at) as at from scan_results
       where user_id = p_user_id and pet_id = any(v_pet_ids) order by coalesce(scanned_at, created_at) desc limit 50) s;
  end if;

  -- One log row per staff member per customer per 10 minutes
  if not exists (select 1 from clinic_data_views where store_id = p_store_id and user_id = p_user_id
                   and viewer_id = auth.uid() and viewed_at > now() - interval '10 minutes') then
    insert into clinic_data_views(store_id, user_id, viewer_id, categories) values (p_store_id, p_user_id, auth.uid(), v_cats);
  end if;

  return jsonb_build_object('ok', true, 'consent', c, 'asked', true, 'shared_at', l.consent->'updated_at',
                            'pets', v_pets, 'health', v_health, 'vaccines', v_vacc, 'scans', v_scans);
end $$;

-- Linked customers now also report what each one shares (return type changes, so drop first).
drop function if exists public.clinic_linked_customers(uuid);
create function public.clinic_linked_customers(p_store_id uuid)
returns table(link_id uuid, user_id uuid, full_name text, owner_id uuid, owner_name text, linked_via text, is_primary boolean,
              linked_at timestamptz, consent jsonb, consent_asked boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this clinic' using errcode = '42501'; end if;
  return query
    select l.id, l.user_id, coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)), l.owner_id, o.name, l.linked_via, l.is_primary,
           l.created_at, public._clinic_consent(l.consent), l.consent ? 'updated_at'
    from clinic_links l
    left join profiles p on p.id = l.user_id
    left join pet_owners o on o.id = l.owner_id
    where l.store_id = p_store_id and l.status = 'active'
    order by l.created_at desc;
end $$;

-- ── Grants ─────────────────────────────────────────────────────────────────
revoke all on function public._clinic_consent(jsonb) from public, anon;
revoke all on function public.set_clinic_consent(uuid, jsonb) from public, anon;
revoke all on function public.unlink_clinic(uuid) from public, anon;
revoke all on function public.clinic_shared_data(uuid, uuid) from public, anon;
revoke all on function public.clinic_linked_customers(uuid) from public, anon;
grant execute on function public._clinic_consent(jsonb), public.set_clinic_consent(uuid, jsonb), public.unlink_clinic(uuid),
  public.clinic_shared_data(uuid, uuid), public.clinic_linked_customers(uuid) to authenticated;
