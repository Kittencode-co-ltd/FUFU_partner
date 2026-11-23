-- Veterinary licence number (เลขที่ใบอนุญาตผู้ประกอบวิชาชีพการสัตวแพทย์) for certificates and prescriptions.
-- Store owners who examine pets themselves keep theirs on the store (vet_license_no) since they may have no staff row.
alter table public.staff add column if not exists license_no text check (license_no is null or length(trim(license_no)) between 1 and 40);
alter table public.stores add column if not exists owner_vet_name text check (owner_vet_name is null or length(trim(owner_vet_name)) between 1 and 120);
alter table public.stores add column if not exists owner_license_no text check (owner_license_no is null or length(trim(owner_license_no)) between 1 and 40);
