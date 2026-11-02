-- Shared optional fields already used by the customer Web forms.
-- Additive only: retain existing pet data and RLS policies.
begin;
alter table public.pets
  add column if not exists color text,
  add column if not exists notes text;
commit;
