-- Additive AI screening + clinic referral workflow. No existing scan data is removed.
alter table public.scan_results
  add column if not exists result_json jsonb,
  add column if not exists screening_status text,
  add column if not exists model_version text,
  add column if not exists triage_level text,
  add column if not exists symptom_answers jsonb not null default '{}'::jsonb,
  add column if not exists scanned_at timestamptz not null default now(),
  add column if not exists image_path text,
  add column if not exists referral_store_id uuid references public.stores(id) on delete set null,
  add column if not exists referral_status text,
  add column if not exists referral_consent_at timestamptz,
  add column if not exists referral_revoked_at timestamptz,
  add column if not exists owner_contact jsonb,
  add column if not exists owner_note text,
  add column if not exists referred_at timestamptz,
  add column if not exists vet_assessment text,
  add column if not exists vet_feedback jsonb,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update public.scan_results set scanned_at = created_at where created_at is not null;
update public.scan_results
set image_path = split_part(split_part(image_url, '/scan-images/', 2), '?', 1), image_url = null
where image_path is null and image_url like '%/scan-images/%';

alter table public.scan_results drop constraint if exists scan_results_screening_status_check;
alter table public.scan_results add constraint scan_results_screening_status_check
  check (screening_status is null or screening_status in ('normal','needs_vet','urgent','unable_to_assess'));
alter table public.scan_results drop constraint if exists scan_results_triage_level_check;
alter table public.scan_results add constraint scan_results_triage_level_check
  check (triage_level is null or triage_level in ('emergency','vet_24_48h','monitor','no_clear_abnormality'));
alter table public.scan_results drop constraint if exists scan_results_referral_status_check;
alter table public.scan_results add constraint scan_results_referral_status_check
  check (referral_status is null or referral_status in ('requested','accepted','declined','completed','cancelled'));

create index if not exists scan_results_referral_inbox_idx
  on public.scan_results(referral_store_id, referral_status, referred_at desc)
  where referral_store_id is not null;
create index if not exists scan_results_owner_scanned_idx
  on public.scan_results(user_id, scanned_at desc);

create or replace function public.is_vet_for_store(p_store_id uuid)
returns boolean language sql stable security invoker set search_path=public as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.stores s
    where s.id = p_store_id and (
      s.owner_id = (select auth.uid())
      or lower(coalesce(s.owner_email,'')) = lower(coalesce((select auth.jwt()->>'email'),''))
    )
  ) or exists (
    select 1 from public.staff st
    where st.store_id = p_store_id
      and st.user_id = (select auth.uid())
      and st.is_active
      and st.role in ('vet','veterinarian')
  );
$$;
revoke all on function public.is_vet_for_store(uuid) from public;
grant execute on function public.is_vet_for_store(uuid) to authenticated;

drop policy if exists scan_results_referral_clinic_select on public.scan_results;
create policy scan_results_referral_clinic_select on public.scan_results
  for select to authenticated
  using (
    referral_store_id is not null
    and referral_consent_at is not null
    and referral_status in ('requested','accepted','completed')
    and public.is_store_member(referral_store_id)
  );

drop policy if exists scan_results_referral_clinic_update on public.scan_results;
create policy scan_results_referral_clinic_update on public.scan_results
  for update to authenticated
  using (
    referral_store_id is not null
    and referral_status in ('requested','accepted')
    and public.is_vet_for_store(referral_store_id)
  )
  with check (
    referral_store_id is not null
    and referral_status in ('accepted','declined','completed')
    and public.is_vet_for_store(referral_store_id)
  );

drop policy if exists pets_screening_referral_clinic_select on public.pets;
create policy pets_screening_referral_clinic_select on public.pets
  for select to authenticated
  using (exists (
    select 1 from public.scan_results r
    where r.pet_id = pets.id
      and r.referral_store_id is not null
      and r.referral_consent_at is not null
      and r.referral_status in ('requested','accepted','completed')
      and public.is_store_member(r.referral_store_id)
  ));

create or replace function public.protect_screening_referral_update()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if (select auth.uid()) = old.user_id then
    if (old.referral_store_id is null and new.referral_store_id is not null)
       or (old.referral_status in ('cancelled','declined') and new.referral_status = 'requested') then
      if new.referral_status <> 'requested' or new.referral_consent_at is null or new.referred_at is null then
        raise exception 'explicit referral consent is required' using errcode='42501';
      end if;
      if old.referral_store_id is not null and new.referral_consent_at <= old.referral_consent_at then
        raise exception 'new consent is required for another referral' using errcode='42501';
      end if;
      if (new.id,new.user_id,new.pet_id,new.body_part,new.diagnosis,new.confidence,new.status,new.image_url,new.notes,
          new.image_path,
          new.created_at,new.model_version,new.result_json,new.screening_status,new.triage_level,new.symptom_answers,new.scanned_at)
         is distinct from
         (old.id,old.user_id,old.pet_id,old.body_part,old.diagnosis,old.confidence,old.status,old.image_url,old.notes,
          old.image_path,
          old.created_at,old.model_version,old.result_json,old.screening_status,old.triage_level,old.symptom_answers,old.scanned_at) then
        raise exception 'scan data is immutable' using errcode='42501';
      end if;
      return new;
    end if;
    if old.referral_status = 'requested' and new.referral_status = 'cancelled'
       and new.referral_store_id = old.referral_store_id and new.referral_revoked_at is not null then
      return new;
    end if;
    raise exception 'referral update denied' using errcode='42501';
  end if;

  if not public.is_vet_for_store(old.referral_store_id) then
    raise exception 'vet role required' using errcode='42501';
  end if;
  if (new.id,new.user_id,new.pet_id,new.body_part,new.diagnosis,new.confidence,new.status,new.image_url,new.notes,
      new.image_path,
      new.created_at,new.model_version,new.result_json,new.screening_status,new.triage_level,new.symptom_answers,new.scanned_at,
      new.referral_store_id,new.referral_consent_at,new.owner_contact,new.owner_note,new.referred_at)
     is distinct from
     (old.id,old.user_id,old.pet_id,old.body_part,old.diagnosis,old.confidence,old.status,old.image_url,old.notes,
      old.image_path,
      old.created_at,old.model_version,old.result_json,old.screening_status,old.triage_level,old.symptom_answers,old.scanned_at,
      old.referral_store_id,old.referral_consent_at,old.owner_contact,old.owner_note,old.referred_at) then
    raise exception 'screening data is immutable' using errcode='42501';
  end if;
  if (old.referral_status = 'requested' and new.referral_status not in ('accepted','declined'))
     or (old.referral_status = 'accepted' and new.referral_status <> 'completed') then
    raise exception 'invalid referral transition' using errcode='23514';
  end if;
  if new.reviewed_by is distinct from (select auth.uid()) or new.reviewed_at is null
     or nullif(trim(new.vet_assessment),'') is null or new.vet_feedback is null or jsonb_typeof(new.vet_feedback) <> 'object' then
    raise exception 'review identity required' using errcode='42501';
  end if;
  return new;
end $$;

drop trigger if exists protect_screening_referral_update on public.scan_results;
create trigger protect_screening_referral_update
  before update on public.scan_results
  for each row execute function public.protect_screening_referral_update();

grant select, insert, update on public.scan_results to authenticated;

-- Scan images contain health details. Remove the legacy public access policies
-- and allow owner access plus access to explicitly consented clinic referrals.
update storage.buckets set public = false where id = 'scan-images';
drop policy if exists "Allow public select for scan-images" on storage.objects;
drop policy if exists "Allow public insert for scan-images" on storage.objects;
drop policy if exists "Allow public update for scan-images" on storage.objects;
drop policy if exists "Allow public delete for scan-images" on storage.objects;
drop policy if exists fufu_scan_images_owner_select on storage.objects;
drop policy if exists fufu_scan_images_owner_insert on storage.objects;
drop policy if exists fufu_scan_images_owner_update on storage.objects;
drop policy if exists fufu_scan_images_owner_delete on storage.objects;
drop policy if exists fufu_scan_images_referral_select on storage.objects;
create policy fufu_scan_images_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'scan-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fufu_scan_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'scan-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fufu_scan_images_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'scan-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'scan-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fufu_scan_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'scan-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fufu_scan_images_referral_select on storage.objects for select to authenticated
  using (bucket_id = 'scan-images' and exists (
    select 1 from public.scan_results r
    where r.image_path = name
      and r.referral_store_id is not null
      and r.referral_consent_at is not null
      and r.referral_status in ('requested','accepted','completed')
      and public.is_store_member(r.referral_store_id)
  ));
