-- Remove API access to legacy backup tables; these are not application tables.
revoke all on table
  public._bak_appointments,
  public._bak_medical_records,
  public._bak_notifications,
  public._bak_order_items,
  public._bak_orders,
  public._bak_pet_owners,
  public._bak_pet_vaccinations,
  public._bak_pets,
  public._bak_roles,
  public._bak_scan_results
from anon, authenticated;

alter table public._bak_appointments enable row level security;
alter table public._bak_appointments force row level security;
alter table public._bak_medical_records enable row level security;
alter table public._bak_medical_records force row level security;
alter table public._bak_notifications enable row level security;
alter table public._bak_notifications force row level security;
alter table public._bak_order_items enable row level security;
alter table public._bak_order_items force row level security;
alter table public._bak_orders enable row level security;
alter table public._bak_orders force row level security;
alter table public._bak_pet_owners enable row level security;
alter table public._bak_pet_owners force row level security;
alter table public._bak_pet_vaccinations enable row level security;
alter table public._bak_pet_vaccinations force row level security;
alter table public._bak_pets enable row level security;
alter table public._bak_pets force row level security;
alter table public._bak_roles enable row level security;
alter table public._bak_roles force row level security;
alter table public._bak_scan_results enable row level security;
alter table public._bak_scan_results force row level security;