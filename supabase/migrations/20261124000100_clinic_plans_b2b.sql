-- B2B packages for clinics (follows 20261121000400_clinic_billing):
--   * Clinics pay for the whole Partner Portal after the 3-month trial. Shops, grooming and hotels stay free.
--   * Packages differ by the number of users (staff accounts incl. the owner). Trial = no user limit.
--   * After the paid/trial period + 14 days grace the clinic's Portal becomes read-only (enforced by the
--     Portal API with clinic_plan_writable); emergency sharing and paying stay open.
--   * The clinic owner picks a package in the Portal and gets an invoice at once (clinic_order_plan);
--     FUFU confirms the transfer in Admin, which activates the package.

alter table public.clinic_plans
  add column max_users integer check (max_users is null or max_users > 0),   -- null = unlimited
  add column is_popular boolean not null default false;

-- The public pricing page reads active packages without signing in
create policy clinic_plans_public_read on public.clinic_plans for select to anon using (is_active);

-- One row of billing settings (how clinics pay), edited in Admin
create table public.billing_settings (
  id boolean primary key default true check (id),
  payment_note text,
  updated_at timestamptz not null default now()
);
alter table public.billing_settings enable row level security;   -- no policies: functions and the Admin server only
insert into public.billing_settings(id) values (true) on conflict do nothing;

insert into public.clinic_plans(code, name, description, price_monthly, price_yearly, max_users, is_popular, sort, features) values
  ('starter', 'Starter', 'คลินิกเล็ก หมอ 1–2 คน', 990, 9900, 3, false, 1,
   '["ระบบคลินิกครบทุกเมนู (นัดหมาย คิว OPD IPD POS สต็อก)", "ลูกค้าใช้แอป FUFU ฟรี เชื่อมกับคลินิกได้ไม่จำกัด", "แชทและโทรหาลูกค้า", "รับเคสสแกน AI และการแชร์ฉุกเฉิน"]'),
  ('pro', 'Pro', 'คลินิกขนาดกลาง หมอหลายคน', 1990, 19900, 10, true, 2,
   '["ระบบคลินิกครบทุกเมนู (นัดหมาย คิว OPD IPD POS สต็อก)", "ลูกค้าใช้แอป FUFU ฟรี เชื่อมกับคลินิกได้ไม่จำกัด", "แชทและโทรหาลูกค้า", "รับเคสสแกน AI และการแชร์ฉุกเฉิน"]'),
  ('hospital', 'Hospital', 'โรงพยาบาลสัตว์ ทีมใหญ่', 3990, 39900, null, false, 3,
   '["ระบบคลินิกครบทุกเมนู (นัดหมาย คิว OPD IPD POS สต็อก)", "ลูกค้าใช้แอป FUFU ฟรี เชื่อมกับคลินิกได้ไม่จำกัด", "แชทและโทรหาลูกค้า", "รับเคสสแกน AI และการแชร์ฉุกเฉิน"]')
on conflict (code) do nothing;

-- ── Users ───────────────────────────────────────────────────────────────────
-- Active staff accounts plus the owner (counted once)
create or replace function public._clinic_user_count(p_store_id uuid) returns integer
language sql stable security definer set search_path = public as $$
  select (select count(*) from staff st where st.store_id = p_store_id and st.is_active
            and st.user_id is distinct from (select owner_id from stores where id = p_store_id))::int + 1
$$;
revoke all on function public._clinic_user_count(uuid) from public, anon, authenticated;

-- User limit in force now: none during the trial or without a package
create or replace function public._clinic_max_users(p_store_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare s clinic_subscriptions;
begin
  s := public._clinic_subscription(p_store_id);
  if s.store_id is null or s.status = 'trial' or s.plan_id is null then return null; end if;
  return (select max_users from clinic_plans where id = s.plan_id);
end $$;
revoke all on function public._clinic_max_users(uuid) from public, anon, authenticated;

create or replace function public._staff_plan_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max integer; v_used integer;
begin
  if not new.is_active then return new; end if;
  if tg_op = 'UPDATE' and old.is_active and old.store_id = new.store_id then return new; end if;
  if new.user_id is not distinct from (select owner_id from stores where id = new.store_id) then return new; end if;
  v_max := public._clinic_max_users(new.store_id);
  if v_max is null then return new; end if;
  select count(*)::int + 1 into v_used from staff st
   where st.store_id = new.store_id and st.is_active and st.id <> new.id
     and st.user_id is distinct from (select owner_id from stores where id = new.store_id);
  if v_used + 1 > v_max then
    raise exception 'plan_user_limit: % of % users', v_used, v_max using errcode = 'P0004';
  end if;
  return new;
end $$;
revoke all on function public._staff_plan_limit() from public, anon, authenticated;
create trigger staff_plan_limit before insert or update of is_active, store_id on public.staff
  for each row execute function public._staff_plan_limit();

-- ── Read-only after expiry ──────────────────────────────────────────────────
-- false only for a clinic whose trial/paid period + grace has ended (or that Admin suspended)
create or replace function public.clinic_plan_writable(p_store_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from stores where id = p_store_id and lower(category) in ('vet_clinic','vet_hospital')) then return true; end if;
  return public._clinic_app_enabled(p_store_id);
end $$;

-- ── Portal: status with packages, users and how to pay ──────────────────────
create or replace function public.clinic_billing_status(p_store_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s clinic_subscriptions; p clinic_plans;
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then raise exception 'not a member of this clinic' using errcode = '42501'; end if;
  s := public._clinic_subscription(p_store_id);
  if s.store_id is null then return jsonb_build_object('ok', true, 'applies', false); end if;
  select * into p from clinic_plans where id = s.plan_id;
  return jsonb_build_object('ok', true, 'applies', true, 'billing_cycle', s.billing_cycle,
           'plan', case when p.id is null then null else jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description,
                   'price_monthly', p.price_monthly, 'price_yearly', p.price_yearly, 'features', p.features, 'max_users', p.max_users) end,
           'users', jsonb_build_object('used', public._clinic_user_count(p_store_id), 'max', public._clinic_max_users(p_store_id)),
           'plans', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'code', x.code, 'name', x.name, 'description', x.description,
                     'price_monthly', x.price_monthly, 'price_yearly', x.price_yearly, 'features', x.features, 'max_users', x.max_users,
                     'is_popular', x.is_popular) order by x.sort, x.price_monthly) from clinic_plans x where x.is_active), '[]'::jsonb))
         || public._clinic_state(s)
         || jsonb_build_object('invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'invoice_no', i.invoice_no, 'plan_name', i.plan_name,
                 'billing_cycle', i.billing_cycle, 'period_start', i.period_start, 'period_end', i.period_end, 'amount', i.amount,
                 'status', i.status, 'due_date', i.due_date, 'payment_note', i.payment_note, 'issued_at', i.issued_at, 'paid_at', i.paid_at)
                 order by i.issued_at desc) from (select * from clinic_billing_invoices where store_id = p_store_id and status <> 'void' order by issued_at desc limit 24) i), '[]'::jsonb));
end $$;

-- ── Portal: the owner picks a package → invoice now ─────────────────────────
create or replace function public.clinic_order_plan(p_store_id uuid, p_plan_id uuid, p_cycle text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s clinic_subscriptions; p clinic_plans; i clinic_billing_invoices; v_used integer; v_start timestamptz;
begin
  if auth.uid() is null or not exists (select 1 from stores where id = p_store_id and owner_id = auth.uid()) then
    raise exception 'only the clinic owner can order a package' using errcode = '42501'; end if;
  if p_cycle not in ('monthly','yearly') then return jsonb_build_object('ok', false, 'code', 'invalid_cycle'); end if;
  s := public._clinic_subscription(p_store_id);
  if s.store_id is null then return jsonb_build_object('ok', false, 'code', 'not_a_clinic'); end if;
  select * into p from clinic_plans where id = p_plan_id and is_active;
  if p.id is null then return jsonb_build_object('ok', false, 'code', 'invalid_plan'); end if;
  v_used := public._clinic_user_count(p_store_id);
  if p.max_users is not null and v_used > p.max_users then
    return jsonb_build_object('ok', false, 'code', 'too_many_users', 'used', v_used, 'max', p.max_users); end if;

  -- Same package already waiting for payment: show that invoice again
  select * into i from clinic_billing_invoices
   where store_id = p_store_id and status = 'issued' and plan_id = p.id and billing_cycle = p_cycle and created_by like 'clinic:%'
   order by issued_at desc limit 1;
  if i.id is not null then return jsonb_build_object('ok', true, 'invoice', to_jsonb(i), 'reused', true); end if;
  -- A different package replaces the clinic's own earlier unpaid order
  update clinic_billing_invoices set status = 'void', voided_at = now()
   where store_id = p_store_id and status = 'issued' and created_by like 'clinic:%';

  v_start := greatest(now(), coalesce(case when s.status = 'trial' then s.trial_ends_at else s.paid_until end, now()));
  insert into clinic_billing_invoices(store_id, plan_id, plan_name, billing_cycle, period_start, period_end, amount, due_date, payment_note, created_by)
  values (p_store_id, p.id, p.name, p_cycle, v_start, v_start + case when p_cycle = 'yearly' then interval '1 year' else interval '1 month' end,
          case when p_cycle = 'yearly' then p.price_yearly else p.price_monthly end,
          (now() at time zone 'Asia/Bangkok')::date + 7, (select payment_note from billing_settings where id), 'clinic:' || auth.uid())
  returning * into i;
  return jsonb_build_object('ok', true, 'invoice', to_jsonb(i));
end $$;

-- Payment received: the invoice's package and period become the clinic's
create or replace function public.admin_mark_clinic_invoice_paid(p_invoice_id uuid, p_payment_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i clinic_billing_invoices;
begin
  select * into i from clinic_billing_invoices where id = p_invoice_id for update;
  if i.id is null or i.status <> 'issued' then return jsonb_build_object('ok', false, 'code', 'not_open'); end if;
  update clinic_billing_invoices set status = 'paid', paid_at = now(), payment_ref = nullif(trim(p_payment_ref), '') where id = i.id;
  update clinic_subscriptions set status = case when status = 'cancelled' then status else 'active' end,
         plan_id = coalesce(i.plan_id, plan_id), billing_cycle = i.billing_cycle,
         paid_until = greatest(coalesce(paid_until, i.period_end), i.period_end), updated_at = now()
   where store_id = i.store_id;
  return jsonb_build_object('ok', true);
end $$;

-- Admin's invoice uses the saved payment note when none is typed
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
          (now() at time zone 'Asia/Bangkok')::date + greatest(coalesce(p_due_days, 7), 0),
          coalesce(nullif(trim(p_payment_note), ''), (select payment_note from billing_settings where id)), p_admin)
  returning * into i;
  return jsonb_build_object('ok', true, 'invoice', to_jsonb(i));
end $$;

revoke all on function public.clinic_plan_writable(uuid) from public, anon;
revoke all on function public.clinic_billing_status(uuid) from public, anon;
revoke all on function public.clinic_order_plan(uuid, uuid, text) from public, anon;
grant execute on function public.clinic_plan_writable(uuid), public.clinic_billing_status(uuid), public.clinic_order_plan(uuid, uuid, text) to authenticated;
revoke all on function public.admin_mark_clinic_invoice_paid(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_issue_clinic_invoice(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.admin_mark_clinic_invoice_paid(uuid, text), public.admin_issue_clinic_invoice(uuid, uuid, text, integer, text, text) to service_role;
