-- Tenant isolation for the canonical MVP tables.

create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores s
    where s.id = target_store_id and s.owner_id = auth.uid()
  ) or exists (
    select 1 from public.staff st
    where st.store_id = target_store_id
      and st.user_id = auth.uid()
      and st.is_active = true
  );
$$;
revoke all on function public.is_store_member(uuid) from public;
grant execute on function public.is_store_member(uuid) to authenticated;

create or replace function public.enforce_appointment_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if (new.user_id, new.pet_id, new.store_id, new.appt_date, new.appt_time_slot)
     is distinct from
     (old.user_id, old.pet_id, old.store_id, old.appt_date, old.appt_time_slot) then
    raise exception 'appointment identity and slot are immutable' using errcode = '42501';
  end if;
  if auth.uid() = old.user_id then
    if new.status <> 'Cancelled' or old.status not in ('Pending','Confirmed') then
      raise exception 'customer may only cancel an active appointment' using errcode = '42501';
    end if;
  elsif public.is_store_member(old.store_id) then
    if not (
      (old.status = 'Pending' and new.status in ('Confirmed','Rejected')) or
      (old.status = 'Confirmed' and new.status in ('Completed','Cancelled','NoShow')) or
      new.status = old.status
    ) then
      raise exception 'invalid clinic appointment transition' using errcode = '23514';
    end if;
  else
    raise exception 'appointment update denied' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_appointment_update on public.appointments;
create trigger enforce_appointment_update before update on public.appointments
for each row execute function public.enforce_appointment_update();

do $$
declare t text; p record;
begin
  foreach t in array array['profiles','stores','staff','roles','pets','health_records','vaccinations','appointments','scan_results','account_deletion_requests']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

create policy profiles_owner_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_owner_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_owner_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_owner_delete on public.profiles for delete to authenticated using (id = auth.uid());

create policy stores_discovery on public.stores for select to anon, authenticated
  using (is_active and is_verified);
create policy stores_owner_select on public.stores for select to authenticated
  using (owner_id = auth.uid());
create policy stores_member_select on public.stores for select to authenticated
  using (public.is_store_member(id));
create policy stores_owner_insert on public.stores for insert to authenticated
  with check (owner_id = auth.uid());
create policy stores_owner_update on public.stores for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy staff_self_or_owner_select on public.staff for select to authenticated
  using (user_id = auth.uid() or store_id in (select s.id from public.stores s where s.owner_id=auth.uid()));
create policy staff_owner_insert on public.staff for insert to authenticated
  with check (store_id in (select s.id from public.stores s where s.owner_id=auth.uid()));
create policy staff_owner_update on public.staff for update to authenticated
  using (store_id in (select s.id from public.stores s where s.owner_id=auth.uid()))
  with check (store_id in (select s.id from public.stores s where s.owner_id=auth.uid()));
create policy staff_owner_delete on public.staff for delete to authenticated
  using (store_id in (select s.id from public.stores s where s.owner_id=auth.uid()));

create policy roles_store_select on public.roles for select to authenticated
  using (public.is_store_member(store_id));
create policy roles_owner_all on public.roles for all to authenticated
  using (store_id in (select s.id from public.stores s where s.owner_id=auth.uid()))
  with check (store_id in (select s.id from public.stores s where s.owner_id=auth.uid()));

create policy pets_owner_all on public.pets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy health_records_owner_all on public.health_records for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.pets p where p.id=pet_id and p.user_id=auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.pets p where p.id=pet_id and p.user_id=auth.uid()));

create policy vaccinations_owner_all on public.vaccinations for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.pets p where p.id=pet_id and p.user_id=auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.pets p where p.id=pet_id and p.user_id=auth.uid()));

create policy scan_results_owner_select on public.scan_results for select to authenticated
  using (user_id = auth.uid());
create policy scan_results_owner_insert on public.scan_results for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.pets p where p.id=pet_id and p.user_id=auth.uid()));
create policy scan_results_owner_delete on public.scan_results for delete to authenticated
  using (user_id = auth.uid());
-- Writes are performed by the screening Edge Function using service role.

create policy appointments_owner_select on public.appointments for select to authenticated
  using (user_id = auth.uid());
create policy appointments_owner_insert on public.appointments for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'Pending'
    and exists (select 1 from public.pets p where p.id=pet_id and p.user_id=auth.uid())
    and exists (select 1 from public.stores s where s.id=store_id and s.is_active and s.is_verified)
  );
create policy appointments_owner_cancel on public.appointments for update to authenticated
  using (user_id = auth.uid() and status in ('Pending','Confirmed'))
  with check (user_id = auth.uid() and status = 'Cancelled');
create policy appointments_clinic_select on public.appointments for select to authenticated
  using (public.is_store_member(store_id));
create policy appointments_clinic_update on public.appointments for update to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

create policy deletion_request_owner_select on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid());
create policy deletion_request_owner_insert on public.account_deletion_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

grant usage on schema public to anon, authenticated;
grant select on public.stores to anon, authenticated;
grant select, insert, update, delete on public.staff, public.roles to authenticated;
grant select, insert, update, delete on public.profiles, public.pets, public.health_records,
  public.vaccinations, public.appointments, public.scan_results, public.account_deletion_requests to authenticated;
