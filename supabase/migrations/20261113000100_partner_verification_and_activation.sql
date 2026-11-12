-- Explicit partner review states while preserving the legacy is_verified flag.
alter table public.stores
  add column if not exists verification_status text not null default 'pending';

alter table public.stores
  drop constraint if exists stores_verification_status_check;
alter table public.stores
  add constraint stores_verification_status_check
  check (verification_status in ('pending', 'accept', 'reject'));

-- Backfill existing boolean approvals, while keeping unapproved stores pending.
update public.stores
set verification_status = case when is_verified then 'accept' else 'pending' end
where verification_status is null or verification_status = 'pending';

create or replace function public.sync_store_verification_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_verified then
      new.verification_status := 'accept';
    elsif new.verification_status is null then
      new.verification_status := 'pending';
    end if;
  elsif new.verification_status is distinct from old.verification_status then
    new.is_verified := (new.verification_status = 'accept');
  elsif new.is_verified is distinct from old.is_verified then
    new.verification_status := case when new.is_verified then 'accept' else 'pending' end;
  end if;

  -- Authenticated partner sessions may not approve, reject, or alter the
  -- review state. Trusted admin/service-role writes have auth.uid() = null.
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.verification_status <> 'pending' or new.is_verified then
        raise exception 'Store verification requires FUFU approval';
      end if;
    elsif new.verification_status is distinct from old.verification_status then
      raise exception 'Store verification requires FUFU approval';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stores_prevent_partner_self_verification on public.stores;
drop trigger if exists stores_sync_verification_status on public.stores;
create trigger stores_sync_verification_status
before insert or update of is_verified, verification_status on public.stores
for each row execute function public.sync_store_verification_status();

create index if not exists stores_verification_status_idx
  on public.stores (verification_status, is_active);
