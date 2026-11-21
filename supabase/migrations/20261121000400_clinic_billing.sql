-- Phase 5: clinics pay FUFU (manual invoicing). Shops, grooming and hotels are not affected.
--   clinic_plans               packages FUFU sells (managed in Admin)
--   clinic_subscriptions       one row per clinic: plan, trial / paid-until date, status
--   clinic_billing_invoices    invoices FUFU issues to clinics (separate from `invoices`, the clinics' own POS bills)
-- Rule: App features (customers linking, staff invites, reading shared App data) stay on until the paid/trial end
-- date + 14 days grace, or until Admin suspends the clinic. The Portal itself and emergency sharing (customer-driven,
-- for the pet's safety) are never paused. Existing clinics start a 3-month free trial from today.
-- Writes happen only from the Admin server (service role) through the admin_* functions below.

-- ── Plans ───────────────────────────────────────────────────────────────────
create table public.clinic_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,32}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  description text,
  price_monthly numeric(12,2) not null default 0 check (price_monthly >= 0),
  price_yearly numeric(12,2) not null default 0 check (price_yearly >= 0),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clinic_plans enable row level security;
create policy clinic_plans_read on public.clinic_plans for select to authenticated using (is_active);

-- ── Subscriptions ───────────────────────────────────────────────────────────
create table public.clinic_subscriptions (
  store_id uuid primary key references public.stores(id) on delete cascade,
  plan_id uuid references public.clinic_plans(id) on delete set null,
  status text not null default 'trial' check (status in ('trial','active','suspended','cancelled')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','yearly')),
  trial_ends_at timestamptz,
  paid_until timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clinic_subscriptions enable row level security;
create policy clinic_subscriptions_member_read on public.clinic_subscriptions for select to authenticated using (public.is_store_member(store_id));

-- ── Invoices FUFU → clinic ──────────────────────────────────────────────────
create sequence public.clinic_invoice_seq;
create table public.clinic_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique default ('FUFU-' || to_char(now() at time zone 'Asia/Bangkok', 'YYYY') || '-' || lpad(nextval('public.clinic_invoice_seq')::text, 5, '0')),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_id uuid references public.clinic_plans(id) on delete set null,
  plan_name text not null,
  billing_cycle text not null check (billing_cycle in ('monthly','yearly')),
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'issued' check (status in ('issued','paid','void')),
  due_date date not null,
  payment_note text,
  payment_ref text,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  voided_at timestamptz,
  created_by text
);
create index clinic_billing_invoices_store_idx on public.clinic_billing_invoices(store_id, issued_at desc);
alter table public.clinic_billing_invoices enable row level security;
create policy clinic_billing_invoices_member_read on public.clinic_billing_invoices for select to authenticated using (public.is_store_member(store_id));

-- Existing clinics: 3-month free trial from today
insert into public.clinic_subscriptions(store_id, status, trial_ends_at)
select id, 'trial', now() + interval '3 months' from public.stores where lower(category) in ('vet_clinic','vet_hospital')
on conflict do nothing;

-- ── State ───────────────────────────────────────────────────────────────────
-- New clinics get their 3-month trial the first time anyone asks.
create or replace function public._clinic_subscription(p_store_id uuid) returns public.clinic_subscriptions
language plpgsql security definer set search_path = public as $$
declare s clinic_subscriptions;
begin
  select * into s from clinic_subscriptions where store_id = p_store_id;
  if not found and exists (select 1 from stores where id = p_store_id and lower(category) in ('vet_clinic','vet_hospital')) then
    insert into clinic_subscriptions(store_id, status, trial_ends_at) values (p_store_id, 'trial', now() + interval '3 months')
    on conflict (store_id) do nothing;
    select * into s from clinic_subscriptions where store_id = p_store_id;
  end if;
  return s;
end $$;
revoke all on function public._clinic_subscription(uuid) from public, anon, authenticated;

create or replace function public._clinic_state(s public.clinic_subscriptions) returns jsonb
language sql stable set search_path = public as $$
  with x as (
    select case when s.status = 'trial' then s.trial_ends_at else s.paid_until end as ends_at
  )
  select jsonb_build_object(
    'status', s.status,
    'ends_at', x.ends_at,
    'grace_ends_at', x.ends_at + interval '14 days',
    'phase', case
      when s.store_id is null then 'none'
      when s.status in ('suspended','cancelled') then 'paused'
      when x.ends_at is null then 'paused'
      when now() <= x.ends_at then 'ok'
      when now() <= x.ends_at + interval '14 days' then 'grace'
      else 'paused' end)
  from x
$$;
revoke all on function public._clinic_state(public.clinic_subscriptions) from public, anon, authenticated;

create or replace function public._clinic_app_enabled(p_store_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  return coalesce(public._clinic_state(public._clinic_subscription(p_store_id))->>'phase', 'paused') in ('ok','grace');
end $$;
revoke all on function public._clinic_app_enabled(uuid) from public, anon, authenticated;

-- Portal: my clinic's package, state and invoices
create or replace function public.clinic_billing_status(p_store_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s clinic_subscriptions; p clinic_plans;
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this clinic' using errcode = '42501'; end if;
  s := public._clinic_subscription(p_store_id);
  if s.store_id is null then return jsonb_build_object('ok', true, 'applies', false); end if;
  select * into p from clinic_plans where id = s.plan_id;
  return jsonb_build_object('ok', true, 'applies', true, 'billing_cycle', s.billing_cycle,
           'plan', case when p.id is null then null else jsonb_build_object('name', p.name, 'description', p.description,
                   'price_monthly', p.price_monthly, 'price_yearly', p.price_yearly, 'features', p.features) end)
         || public._clinic_state(s)
         || jsonb_build_object('invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'invoice_no', i.invoice_no, 'plan_name', i.plan_name,
                 'billing_cycle', i.billing_cycle, 'period_start', i.period_start, 'period_end', i.period_end, 'amount', i.amount,
                 'status', i.status, 'due_date', i.due_date, 'payment_note', i.payment_note, 'issued_at', i.issued_at, 'paid_at', i.paid_at)
                 order by i.issued_at desc) from (select * from clinic_billing_invoices where store_id = p_store_id and status <> 'void' order by issued_at desc limit 24) i), '[]'::jsonb));
end $$;

-- ── Admin (service role only) ───────────────────────────────────────────────
create or replace function public.admin_clinic_billing_overview() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row order by row->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('store_id', st.id, 'name', st.name, 'category', st.category, 'owner_email', st.owner_email, 'phone', st.phone,
             'is_active', st.is_active, 'plan_id', s.plan_id, 'plan_name', p.name, 'billing_cycle', s.billing_cycle, 'note', s.note,
             'trial_ends_at', s.trial_ends_at, 'paid_until', s.paid_until,
             'linked_customers', (select count(*) from clinic_links l where l.store_id = st.id and l.status = 'active'),
             'open_invoices', (select count(*) from clinic_billing_invoices i where i.store_id = st.id and i.status = 'issued'),
             'open_amount', (select coalesce(sum(amount), 0) from clinic_billing_invoices i where i.store_id = st.id and i.status = 'issued'))
           || public._clinic_state(public._clinic_subscription(st.id)) as row
    from stores st
    left join clinic_subscriptions s on s.store_id = st.id
    left join clinic_plans p on p.id = s.plan_id
    where lower(st.category) in ('vet_clinic','vet_hospital')) t
$$;

-- Issue an invoice for the next period (starts when the current paid/trial period ends, or today)
create or replace function public.admin_issue_clinic_invoice(p_store_id uuid, p_plan_id uuid, p_cycle text, p_due_days integer, p_payment_note text, p_admin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s clinic_subscriptions; p clinic_plans; v_start timestamptz; v_end timestamptz; i clinic_billing_invoices;
begin
  if p_cycle not in ('monthly','yearly') then return jsonb_build_object('ok', false, 'code', 'invalid_cycle'); end if;
  s := public._clinic_subscription(p_store_id);
  if s.store_id is null then return jsonb_build_object('ok', false, 'code', 'not_a_clinic'); end if;
  select * into p from clinic_plans where id = p_plan_id;
  if p.id is null then return jsonb_build_object('ok', false, 'code', 'invalid_plan'); end if;
  v_start := greatest(now(), coalesce(case when s.status = 'trial' then s.trial_ends_at else s.paid_until end, now()));
  v_end := v_start + case when p_cycle = 'yearly' then interval '1 year' else interval '1 month' end;
  insert into clinic_billing_invoices(store_id, plan_id, plan_name, billing_cycle, period_start, period_end, amount, due_date, payment_note, created_by)
  values (p_store_id, p.id, p.name, p_cycle, v_start, v_end, case when p_cycle = 'yearly' then p.price_yearly else p.price_monthly end,
          (now() at time zone 'Asia/Bangkok')::date + greatest(coalesce(p_due_days, 7), 0), nullif(trim(p_payment_note), ''), p_admin)
  returning * into i;
  update clinic_subscriptions set plan_id = p.id, billing_cycle = p_cycle, updated_at = now() where store_id = p_store_id;
  return jsonb_build_object('ok', true, 'invoice', to_jsonb(i));
end $$;

-- Payment received: the invoice's period becomes paid time
create or replace function public.admin_mark_clinic_invoice_paid(p_invoice_id uuid, p_payment_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i clinic_billing_invoices;
begin
  select * into i from clinic_billing_invoices where id = p_invoice_id for update;
  if i.id is null or i.status <> 'issued' then return jsonb_build_object('ok', false, 'code', 'not_open'); end if;
  update clinic_billing_invoices set status = 'paid', paid_at = now(), payment_ref = nullif(trim(p_payment_ref), '') where id = i.id;
  update clinic_subscriptions set status = case when status = 'cancelled' then status else 'active' end,
         paid_until = greatest(coalesce(paid_until, i.period_end), i.period_end), updated_at = now()
   where store_id = i.store_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_void_clinic_invoice(p_invoice_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update clinic_billing_invoices set status = 'void', voided_at = now() where id = p_invoice_id and status = 'issued';
  if not found then return jsonb_build_object('ok', false, 'code', 'not_open'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Change a clinic's plan, extend the trial, suspend/resume, or leave a note
create or replace function public.admin_update_clinic_subscription(p_store_id uuid, p_plan_id uuid, p_status text, p_trial_days integer, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s clinic_subscriptions;
begin
  s := public._clinic_subscription(p_store_id);
  if s.store_id is null then return jsonb_build_object('ok', false, 'code', 'not_a_clinic'); end if;
  if p_status is not null and p_status not in ('trial','active','suspended','cancelled') then return jsonb_build_object('ok', false, 'code', 'invalid_status'); end if;
  if p_plan_id is not null and not exists (select 1 from clinic_plans where id = p_plan_id) then return jsonb_build_object('ok', false, 'code', 'invalid_plan'); end if;
  update clinic_subscriptions set
    plan_id = coalesce(p_plan_id, plan_id),
    status = coalesce(p_status, status),
    trial_ends_at = case when coalesce(p_trial_days, 0) > 0 then greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => least(p_trial_days, 365)) else trial_ends_at end,
    note = case when p_note is null then note else nullif(trim(p_note), '') end,
    updated_at = now()
  where store_id = p_store_id returning * into s;
  return jsonb_build_object('ok', true) || public._clinic_state(s);
end $$;

-- ── App features follow the package (emergency sharing is never paused) ─────
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
  if not public._clinic_app_enabled(c.store_id) then return jsonb_build_object('ok', false, 'code', 'clinic_paused'); end if;

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
  if not public._clinic_app_enabled(p_store_id) then return jsonb_build_object('ok', false, 'code', 'clinic_paused'); end if;
  v_primary := public._link_upsert(auth.uid(), p_store_id, null, 'nearby');
  return jsonb_build_object('ok', true, 'store_id', p_store_id, 'is_primary', v_primary);
end $$;

create or replace function public.clinic_invite_code(p_store_id uuid, p_owner_id uuid)
returns table(code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_code text; v_exp timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this clinic' using errcode = '42501'; end if;
  if not public._clinic_app_enabled(p_store_id) then raise exception 'clinic package paused' using errcode = 'P0003'; end if;
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

create or replace function public.clinic_shared_data(p_store_id uuid, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l clinic_links; c jsonb; v_cats text[]; v_pet_ids uuid[];
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then
    raise exception 'not a member of this clinic' using errcode = '42501';
  end if;
  if not public._clinic_app_enabled(p_store_id) then return jsonb_build_object('ok', false, 'code', 'plan_paused'); end if;
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


-- ── Grants ─────────────────────────────────────────────────────────────────
revoke all on function public.clinic_billing_status(uuid) from public, anon;
grant execute on function public.clinic_billing_status(uuid) to authenticated;
revoke all on function public.admin_clinic_billing_overview() from public, anon, authenticated;
revoke all on function public.admin_issue_clinic_invoice(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.admin_mark_clinic_invoice_paid(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_void_clinic_invoice(uuid) from public, anon, authenticated;
revoke all on function public.admin_update_clinic_subscription(uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.admin_clinic_billing_overview(), public.admin_issue_clinic_invoice(uuid, uuid, text, integer, text, text),
  public.admin_mark_clinic_invoice_paid(uuid, text), public.admin_void_clinic_invoice(uuid),
  public.admin_update_clinic_subscription(uuid, uuid, text, integer, text) to service_role;
revoke all on function public.link_clinic_by_code(text) from public, anon;
revoke all on function public.link_clinic(uuid) from public, anon;
revoke all on function public.clinic_invite_code(uuid, uuid) from public, anon;
revoke all on function public.clinic_shared_data(uuid, uuid) from public, anon;
grant execute on function public.link_clinic_by_code(text), public.link_clinic(uuid), public.clinic_invite_code(uuid, uuid),
  public.clinic_shared_data(uuid, uuid) to authenticated;
