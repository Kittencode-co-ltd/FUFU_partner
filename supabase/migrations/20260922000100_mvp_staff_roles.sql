-- Partner MVP active staff roles are owner, reception and vet only.
-- Unsupported historical roles are retained for auditability but deactivated.

alter table public.staff drop constraint if exists staff_role_check;

update public.staff set role = 'vet' where role = 'veterinarian';
update public.staff set role = 'reception' where role = 'receptionist';
update public.staff
set is_active = false, updated_at = now()
where role not in ('owner', 'reception', 'vet') and is_active;

alter table public.staff add constraint staff_role_check
  check (role in ('owner', 'reception', 'vet') or not is_active);
