-- Partner owners must not be able to self-approve stores through the public
-- Supabase API. Admin/service-role workflows can still update this flag.
create or replace function public.prevent_partner_self_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.is_verified is distinct from false then
        raise exception 'Store verification requires FUFU approval';
      end if;
      new.is_verified := false;
    elsif new.is_verified is distinct from old.is_verified then
      raise exception 'Store verification requires FUFU approval';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stores_prevent_partner_self_verification on public.stores;
create trigger stores_prevent_partner_self_verification
before insert or update of is_verified on public.stores
for each row execute function public.prevent_partner_self_verification();
