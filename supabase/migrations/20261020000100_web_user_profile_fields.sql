-- Fields used by the FUFU Web profile and vaccination forms.
alter table public.profiles add column if not exists address text;
alter table public.vaccinations add column if not exists notes text;
