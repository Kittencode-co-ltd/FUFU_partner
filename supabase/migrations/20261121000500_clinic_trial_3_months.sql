-- Clinic free trial is 3 months (was 30 days). 20261121000400 already creates 3-month trials on a fresh database;
-- this brings databases that ran the earlier 30-day version in line.
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

update public.clinic_subscriptions set trial_ends_at = created_at + interval '3 months', updated_at = now()
 where status = 'trial' and trial_ends_at is not null and trial_ends_at < created_at + interval '3 months';
