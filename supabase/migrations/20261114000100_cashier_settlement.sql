-- Cashier settlement — matches "FUFU Portal Vet v.2 · flow" (section 3 queue states + section 4 payment).
--
--   queue:   waiting → called → in_progress → cashier_waiting → completed
--            in_progress → waiting (pause) · cashier_waiting → in_progress (fix treatment) · → cancelled before completed
--   payment: open cash drawer → pending invoice → server totals (discount · VAT · split payment)
--            → ONE transaction: record payments + gapless receipt number + FEFO stock deduction + queue completed
--            → any failure rolls everything back (no receipt number is used up).
--
-- Every function checks store membership itself (security definer + is_store_member), so staff never need
-- direct write access to invoice_payments / receipt counters.

begin;

-- ── 1. Status values ────────────────────────────────────────────────────────────
-- The original constraints were created outside migrations, so drop whichever CHECK mentions status.
do $$
declare c record;
begin
  for c in
    select conname, conrelid::regclass as rel from pg_constraint
    where contype = 'c'
      and conrelid in ('public.queue_entries'::regclass, 'public.invoices'::regclass)
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table %s drop constraint %I', c.rel, c.conname);
  end loop;
end $$;

alter table public.queue_entries
  add constraint queue_entries_status_check
  check (status in ('waiting', 'called', 'in_progress', 'cashier_waiting', 'completed', 'no_show', 'cancelled'));

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('pending', 'paid', 'void'));

alter table public.queue_entries add column if not exists cancelled_at timestamptz;
alter table public.queue_entries add column if not exists cancel_reason text;
-- transactions.payment_method: allow split payments and the values the older POS already writes
do $
declare c record;
begin
  for c in select conname from pg_constraint
           where contype = 'c' and conrelid = 'public.transactions'::regclass
             and pg_get_constraintdef(oid) ilike '%payment_method%'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
  end loop;
end $;
alter table public.transactions
  add constraint transactions_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'transfer', 'card', 'qr', 'promptpay', 'split', 'other'));

alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists cash_session_id uuid;

-- One open (pending) invoice per queue entry
create unique index if not exists invoices_one_pending_per_queue
  on public.invoices (queue_entry_id) where status = 'pending' and queue_entry_id is not null;
-- Receipt numbers are unique per store
create unique index if not exists invoices_store_number_unique
  on public.invoices (store_id, invoice_number) where invoice_number is not null;

-- ── 2. Cash drawer sessions ─────────────────────────────────────────────────────
create table if not exists public.cash_sessions (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  opened_by      uuid not null default auth.uid(),
  opened_by_name text,
  opened_at      timestamptz not null default now(),
  opening_float  numeric(12,2) not null default 0 check (opening_float >= 0),
  closed_by      uuid,
  closed_at      timestamptz,
  counted_cash   numeric(12,2),
  expected_cash  numeric(12,2),
  note           text
);
-- At most one open drawer per store
create unique index if not exists cash_sessions_one_open on public.cash_sessions (store_id) where closed_at is null;

alter table public.cash_sessions enable row level security;
drop policy if exists cash_sessions_member_read on public.cash_sessions;
create policy cash_sessions_member_read on public.cash_sessions
  for select to authenticated using (public.is_store_member(store_id));

-- ── 3. Payments (split payment = several rows per invoice) ──────────────────────
create table if not exists public.invoice_payments (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  invoice_id      uuid not null references public.invoices(id) on delete restrict,
  cash_session_id uuid references public.cash_sessions(id),
  method          text not null check (method in ('cash', 'transfer', 'card', 'qr')),
  amount          numeric(12,2) not null check (amount > 0),
  reference       text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id);
create index if not exists invoice_payments_session_idx on public.invoice_payments (cash_session_id);

alter table public.invoice_payments enable row level security;
drop policy if exists invoice_payments_member_read on public.invoice_payments;
create policy invoice_payments_member_read on public.invoice_payments
  for select to authenticated using (public.is_store_member(store_id));

-- ── 4. Gapless receipt counter (per store, per Bangkok day) ─────────────────────
create table if not exists public.store_receipt_counters (
  store_id uuid not null references public.stores(id) on delete cascade,
  day      date not null,
  last_no  integer not null default 0,
  primary key (store_id, day)
);
alter table public.store_receipt_counters enable row level security; -- no policies: functions only

-- ── 5. Functions ────────────────────────────────────────────────────────────────

-- Open the cash drawer for the day
create or replace function public.fufu_open_cash_session(p_store_id uuid, p_opening_float numeric default 0, p_name text default null)
returns public.cash_sessions
language plpgsql security definer set search_path = public as $$
declare s public.cash_sessions;
begin
  if not public.is_store_member(p_store_id) then raise exception 'not_store_member' using errcode = '42501'; end if;
  if coalesce(p_opening_float, 0) < 0 then raise exception 'invalid_float'; end if;
  insert into public.cash_sessions (store_id, opening_float, opened_by_name)
  values (p_store_id, coalesce(p_opening_float, 0), nullif(trim(p_name), ''))
  returning * into s;
  return s;
exception when unique_violation then
  raise exception 'drawer_already_open';
end $$;

-- Close the drawer: expected cash = opening float + cash taken in this session
create or replace function public.fufu_close_cash_session(p_session_id uuid, p_counted_cash numeric, p_note text default null)
returns public.cash_sessions
language plpgsql security definer set search_path = public as $$
declare s public.cash_sessions; v_cash numeric;
begin
  select * into s from public.cash_sessions where id = p_session_id for update;
  if not found or not public.is_store_member(s.store_id) then raise exception 'session_not_found'; end if;
  if s.closed_at is not null then raise exception 'session_closed'; end if;
  select coalesce(sum(amount), 0) into v_cash from public.invoice_payments where cash_session_id = s.id and method = 'cash';
  update public.cash_sessions
     set closed_at = now(), closed_by = auth.uid(), counted_cash = p_counted_cash,
         expected_cash = s.opening_float + v_cash, note = nullif(trim(p_note), '')
   where id = s.id
  returning * into s;
  return s;
end $$;

-- Treatment done → bill waits at the cashier (queue: in_progress → cashier_waiting)
create or replace function public.fufu_open_invoice(
  p_store_id uuid, p_queue_entry_id uuid, p_pet_name text, p_owner_name text, p_line_items jsonb, p_medical_record_id uuid default null)
returns public.invoices
language plpgsql security definer set search_path = public as $$
declare inv public.invoices; q public.queue_entries; v_subtotal numeric := 0; li jsonb;
begin
  if not public.is_store_member(p_store_id) then raise exception 'not_store_member' using errcode = '42501'; end if;
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_array_length(p_line_items) = 0 then raise exception 'no_line_items'; end if;
  for li in select * from jsonb_array_elements(p_line_items) loop
    if coalesce((li->>'qty')::numeric, 0) <= 0 or coalesce((li->>'unit_price')::numeric, -1) < 0 or coalesce(trim(li->>'name'), '') = '' then
      raise exception 'invalid_line_item';
    end if;
    -- Stock is counted in whole units
    if nullif(li->>'product_id', '') is not null and (li->>'qty')::numeric <> trunc((li->>'qty')::numeric) then
      raise exception 'invalid_line_item';
    end if;
    v_subtotal := v_subtotal + (li->>'qty')::numeric * (li->>'unit_price')::numeric;
  end loop;

  if p_queue_entry_id is not null then
    select * into q from public.queue_entries where id = p_queue_entry_id and store_id = p_store_id for update;
    if not found then raise exception 'queue_not_found'; end if;
    if q.status not in ('called', 'in_progress') then raise exception 'queue_not_in_treatment'; end if;
    update public.queue_entries set status = 'cashier_waiting' where id = q.id;
  end if;

  insert into public.invoices (store_id, queue_entry_id, medical_record_id, pet_name, owner_name, line_items,
                               subtotal, discount, discount_type, vat_rate, vat_amount, total, status, created_by)
  values (p_store_id, p_queue_entry_id, p_medical_record_id, p_pet_name, p_owner_name, p_line_items,
          v_subtotal, 0, 'amount', 0, 0, v_subtotal, 'pending', auth.uid()::text)
  returning * into inv;
  return inv;
exception when unique_violation then
  raise exception 'invoice_already_open';
end $$;

-- Cashier sends the bill back to the vet to fix the treatment (cashier_waiting → in_progress)
create or replace function public.fufu_return_to_treatment(p_invoice_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or not public.is_store_member(inv.store_id) then raise exception 'invoice_not_found'; end if;
  if inv.status <> 'pending' then raise exception 'invoice_not_pending'; end if;
  update public.invoices set status = 'void' where id = inv.id;
  if inv.queue_entry_id is not null then
    update public.queue_entries set status = 'in_progress' where id = inv.queue_entry_id and status = 'cashier_waiting';
  end if;
end $$;

-- Settle: all-or-nothing. Any exception rolls back the payments, the receipt number and the stock deduction.
--   p_payments: [{ "method": "cash"|"transfer"|"card"|"qr", "amount": 100, "reference": "..." }]
create or replace function public.fufu_settle_invoice(
  p_invoice_id uuid, p_payments jsonb, p_discount numeric default 0, p_vat_rate numeric default 0)
returns public.invoices
language plpgsql security definer set search_path = public as $$
declare
  inv public.invoices; sess public.cash_sessions; li jsonb; pay jsonb; b record;
  v_subtotal numeric := 0; v_discount numeric; v_after numeric; v_vat numeric; v_total numeric; v_paid numeric := 0;
  v_day date := (now() at time zone 'Asia/Bangkok')::date; v_no integer; v_number text;
  v_need numeric; v_take integer; v_methods text[] := '{}';
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or not public.is_store_member(inv.store_id) then raise exception 'invoice_not_found'; end if;
  if inv.status <> 'pending' then raise exception 'invoice_not_pending'; end if;

  select * into sess from public.cash_sessions where store_id = inv.store_id and closed_at is null;
  if not found then raise exception 'drawer_closed'; end if;

  -- Totals are always computed here, never trusted from the browser
  for li in select * from jsonb_array_elements(inv.line_items) loop
    v_subtotal := v_subtotal + (li->>'qty')::numeric * (li->>'unit_price')::numeric;
  end loop;
  v_discount := least(greatest(coalesce(p_discount, 0), 0), v_subtotal);
  if coalesce(p_vat_rate, 0) not in (0, 7) then raise exception 'invalid_vat_rate'; end if;
  v_after := v_subtotal - v_discount;
  v_vat   := round(v_after * coalesce(p_vat_rate, 0) / 100, 2);
  v_total := v_after + v_vat;

  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then raise exception 'no_payments'; end if;
  for pay in select * from jsonb_array_elements(p_payments) loop
    if (pay->>'method') not in ('cash', 'transfer', 'card', 'qr') or coalesce((pay->>'amount')::numeric, 0) <= 0 then
      raise exception 'invalid_payment';
    end if;
    v_paid := v_paid + (pay->>'amount')::numeric;
    v_methods := array_append(v_methods, pay->>'method');
  end loop;
  if round(v_paid, 2) <> round(v_total, 2) then raise exception 'payment_total_mismatch'; end if;

  -- Stock: earliest expiry first (FEFO) for every line that is a product
  for li in select * from jsonb_array_elements(inv.line_items) loop
    if li ? 'product_id' and nullif(li->>'product_id', '') is not null then
      v_need := (li->>'qty')::numeric;
      for b in
        select id, quantity, lot_number from public.inventory_batches
         where store_id = inv.store_id and product_id = (li->>'product_id')::uuid and is_active and quantity > 0
           and (expiry_date is null or expiry_date > v_day)
         order by expiry_date asc nulls last, created_at asc
         for update
      loop
        exit when v_need <= 0;
        v_take := least(b.quantity, v_need)::integer;
        update public.inventory_batches set quantity = quantity - v_take, is_active = (quantity - v_take) > 0 where id = b.id;
        insert into public.stock_movements (store_id, product_id, batch_id, movement_type, quantity, reference_type, reference_id, reason, performed_by)
        values (inv.store_id, (li->>'product_id')::uuid, b.id, 'OUT', -v_take::integer, 'invoice', inv.id,
                'จ่ายตามใบเสร็จ · Lot ' || coalesce(b.lot_number, '-'), auth.uid()::text);
        v_need := v_need - v_take;
      end loop;
      if v_need > 0 then raise exception 'insufficient_stock:%', li->>'name'; end if;
      update public.products set stock_qty = greatest(coalesce(stock_qty, 0) - (li->>'qty')::integer, 0)
       where id = (li->>'product_id')::uuid and store_id = inv.store_id;
    end if;
  end loop;

  -- Next receipt number for today; rolled back together with everything else on failure
  insert into public.store_receipt_counters as c (store_id, day, last_no) values (inv.store_id, v_day, 1)
  on conflict (store_id, day) do update set last_no = c.last_no + 1
  returning last_no into v_no;
  v_number := 'INV-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_no::text, 4, '0');

  for pay in select * from jsonb_array_elements(p_payments) loop
    insert into public.invoice_payments (store_id, invoice_id, cash_session_id, method, amount, reference)
    values (inv.store_id, inv.id, sess.id, pay->>'method', (pay->>'amount')::numeric, nullif(trim(pay->>'reference'), ''));
  end loop;

  insert into public.transactions (store_id, created_by, invoice_number, items, subtotal, discount, vat_rate, vat_amount, total,
                                   commission_rate, commission_amount, payment_method, payment_status)
  values (inv.store_id, auth.uid(), v_number, inv.line_items, v_subtotal, v_discount, coalesce(p_vat_rate, 0), v_vat, v_total,
          0.05, round(v_total * 0.05, 2),
          case when array_length(v_methods, 1) > 1 then 'split' else v_methods[1] end, 'paid');

  update public.invoices
     set status = 'paid', invoice_number = v_number, subtotal = v_subtotal, discount = v_discount, discount_type = 'amount',
         vat_rate = coalesce(p_vat_rate, 0), vat_amount = v_vat, total = v_total, paid_at = now(), cash_session_id = sess.id,
         payment_method = case when array_length(v_methods, 1) > 1 then 'split' else v_methods[1] end
   where id = inv.id
  returning * into inv;

  if inv.queue_entry_id is not null then
    update public.queue_entries set status = 'completed', completed_at = now() where id = inv.queue_entry_id;
  end if;

  return inv;
end $$;

revoke all on function public.fufu_open_cash_session(uuid, numeric, text) from public;
revoke all on function public.fufu_close_cash_session(uuid, numeric, text) from public;
revoke all on function public.fufu_open_invoice(uuid, uuid, text, text, jsonb, uuid) from public;
revoke all on function public.fufu_return_to_treatment(uuid) from public;
revoke all on function public.fufu_settle_invoice(uuid, jsonb, numeric, numeric) from public;
grant execute on function public.fufu_open_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.fufu_close_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.fufu_open_invoice(uuid, uuid, text, text, jsonb, uuid) to authenticated;
grant execute on function public.fufu_return_to_treatment(uuid) to authenticated;
grant execute on function public.fufu_settle_invoice(uuid, jsonb, numeric, numeric) to authenticated;

-- ── 6. Receipt documents ────────────────────────────────────────────────────────
-- print_count: the first print is the ORIGINAL (ต้นฉบับ); every later print is marked COPY (สำเนา).
-- buyer_*: needed for a full tax invoice (ใบกำกับภาษีเต็มรูป, Revenue Code s.86/4). Locked once the
-- full tax invoice has been issued; corrections go through void + re-issue, never by editing.
alter table public.invoices add column if not exists print_count integer not null default 0;
alter table public.invoices add column if not exists buyer_name text;
alter table public.invoices add column if not exists buyer_address text;
alter table public.invoices add column if not exists buyer_tax_id text;
alter table public.invoices add column if not exists buyer_branch text;
alter table public.invoices add column if not exists full_tax_invoice_at timestamptz;

create or replace function public.fufu_mark_invoice_printed(p_invoice_id uuid, p_full_tax_invoice boolean default false)
returns integer
language plpgsql security definer set search_path = public as $$
declare inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or not public.is_store_member(inv.store_id) then raise exception 'invoice_not_found'; end if;
  if inv.status <> 'paid' then raise exception 'invoice_not_paid'; end if;
  if p_full_tax_invoice and coalesce(trim(inv.buyer_name), '') = '' then raise exception 'buyer_required'; end if;
  update public.invoices
     set print_count = print_count + 1,
         full_tax_invoice_at = case when p_full_tax_invoice then coalesce(full_tax_invoice_at, now()) else full_tax_invoice_at end
   where id = inv.id
  returning print_count into inv.print_count;
  insert into public.audit_logs (store_id, action, entity_type, entity_id, new_data, reason)
  values (inv.store_id, 'PRINT', 'invoice', inv.id,
          jsonb_build_object('invoice_number', inv.invoice_number, 'print_no', inv.print_count, 'full_tax_invoice', p_full_tax_invoice),
          case when inv.print_count = 1 then 'ต้นฉบับ' else 'สำเนา' end);
  return inv.print_count;
end $$;

create or replace function public.fufu_set_invoice_buyer(p_invoice_id uuid, p_name text, p_address text, p_tax_id text, p_branch text)
returns public.invoices
language plpgsql security definer set search_path = public as $$
declare inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or not public.is_store_member(inv.store_id) then raise exception 'invoice_not_found'; end if;
  if inv.status <> 'paid' then raise exception 'invoice_not_paid'; end if;
  if inv.full_tax_invoice_at is not null then raise exception 'tax_invoice_locked'; end if;
  if nullif(trim(p_tax_id), '') is not null and trim(p_tax_id) !~ '^[0-9]{13}$' then raise exception 'invalid_tax_id'; end if;
  update public.invoices
     set buyer_name = nullif(trim(p_name), ''), buyer_address = nullif(trim(p_address), ''),
         buyer_tax_id = nullif(trim(p_tax_id), ''), buyer_branch = nullif(trim(p_branch), '')
   where id = inv.id
  returning * into inv;
  return inv;
end $$;

revoke all on function public.fufu_mark_invoice_printed(uuid, boolean) from public;
revoke all on function public.fufu_set_invoice_buyer(uuid, text, text, text, text) from public;
grant execute on function public.fufu_mark_invoice_printed(uuid, boolean) to authenticated;
grant execute on function public.fufu_set_invoice_buyer(uuid, text, text, text, text) to authenticated;

commit;
