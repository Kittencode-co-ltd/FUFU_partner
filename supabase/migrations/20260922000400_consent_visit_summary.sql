-- P4: appointment-scoped consent, visit summaries and append-only audit.
create table if not exists public.appointment_data_consents(
 appointment_id uuid primary key references public.appointments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 store_id uuid not null references public.stores(id) on delete cascade,
 allow_pet_profile boolean not null default false,
 allow_health_records boolean not null default false,
 allow_vaccinations boolean not null default false,
 allow_scan_images boolean not null default false,
 granted_at timestamptz not null default now(), revoked_at timestamptz
);
create table if not exists public.visit_summaries(
 id uuid primary key default gen_random_uuid(), appointment_id uuid not null unique references public.appointments(id) on delete restrict,
 store_id uuid not null references public.stores(id) on delete restrict, pet_id uuid not null references public.pets(id) on delete restrict,
 vet_user_id uuid references auth.users(id) on delete set null, findings text, actions_taken text, care_instructions text,
 warning_signs text, follow_up_at timestamptz, status text not null default 'draft' check(status in('draft','finalized')),
 finalize_idempotency_key text unique, finalized_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.health_records add column if not exists source_visit_summary_id uuid references public.visit_summaries(id) on delete set null;
create unique index if not exists health_record_summary_unique on public.health_records(source_visit_summary_id) where source_visit_summary_id is not null;
alter table public.vaccinations add column if not exists source_visit_summary_id uuid references public.visit_summaries(id) on delete set null;
create unique index if not exists vaccination_summary_name_unique on public.vaccinations(source_visit_summary_id,vaccine_name) where source_visit_summary_id is not null;
create table if not exists public.audit_logs(
 id bigint generated always as identity primary key, store_id uuid references public.stores(id) on delete set null,
 actor_user_id uuid references auth.users(id) on delete set null, action text not null, entity_type text not null, entity_id uuid,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.appointment_data_consents enable row level security; alter table public.appointment_data_consents force row level security;
alter table public.visit_summaries enable row level security; alter table public.visit_summaries force row level security;
alter table public.audit_logs enable row level security; alter table public.audit_logs force row level security;
create policy consent_owner_all on public.appointment_data_consents for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy consent_clinic_select on public.appointment_data_consents for select to authenticated using(public.is_store_member(store_id));
create policy summaries_related_select on public.visit_summaries for select to authenticated using(public.is_store_member(store_id) or exists(select 1 from public.appointments a where a.id=appointment_id and a.user_id=auth.uid()));
create policy summaries_member_insert on public.visit_summaries for insert to authenticated with check(public.is_store_member(store_id));
create policy summaries_member_update on public.visit_summaries for update to authenticated using(public.is_store_member(store_id)) with check(public.is_store_member(store_id));
create policy audit_member_select on public.audit_logs for select to authenticated using(store_id is not null and public.is_store_member(store_id));
grant select,insert,update on public.appointment_data_consents,public.visit_summaries to authenticated;
grant select on public.audit_logs to authenticated;

drop policy if exists pets_clinic_appointment_select on public.pets;
create policy pets_clinic_appointment_select on public.pets for select to authenticated using(exists(
 select 1 from public.appointments a join public.appointment_data_consents c on c.appointment_id=a.id
 where a.pet_id=pets.id and public.is_store_member(a.store_id) and c.revoked_at is null and c.allow_pet_profile
));
drop policy if exists health_clinic_appointment_select on public.health_records;
create policy health_clinic_appointment_select on public.health_records for select to authenticated using(exists(
 select 1 from public.appointments a join public.appointment_data_consents c on c.appointment_id=a.id
 where a.pet_id=health_records.pet_id and public.is_store_member(a.store_id) and c.revoked_at is null and c.allow_health_records
));
drop policy if exists vaccinations_clinic_appointment_select on public.vaccinations;
create policy vaccinations_clinic_appointment_select on public.vaccinations for select to authenticated using(exists(
 select 1 from public.appointments a join public.appointment_data_consents c on c.appointment_id=a.id
 where a.pet_id=vaccinations.pet_id and public.is_store_member(a.store_id) and c.revoked_at is null and c.allow_vaccinations
));
drop policy if exists scans_clinic_appointment_select on public.scan_results;
create policy scans_clinic_appointment_select on public.scan_results for select to authenticated using(exists(
 select 1 from public.appointments a join public.appointment_data_consents c on c.appointment_id=a.id
 where a.pet_id=scan_results.pet_id and public.is_store_member(a.store_id) and c.revoked_at is null and c.allow_scan_images
));

create or replace function public.is_vet_for_store(p_store_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.stores where id=p_store_id and owner_id=auth.uid()) or exists(select 1 from public.staff where store_id=p_store_id and user_id=auth.uid() and role='vet' and is_active)
$$;
revoke all on function public.is_vet_for_store(uuid) from public; grant execute on function public.is_vet_for_store(uuid) to authenticated;

create or replace function public.finalize_visit_summary(p_summary_id uuid,p_idempotency_key text,p_vaccinations jsonb default '[]'::jsonb)
returns public.visit_summaries language plpgsql security definer set search_path=public as $$
declare v public.visit_summaries; a public.appointments; item jsonb;
begin
 select * into v from public.visit_summaries where id=p_summary_id for update;
 if v.id is null then raise exception 'summary not found' using errcode='P0002'; end if;
 if not public.is_vet_for_store(v.store_id) then raise exception 'vet role required' using errcode='42501'; end if;
 if v.status='finalized' then
   if v.finalize_idempotency_key=p_idempotency_key then return v; end if;
   raise exception 'summary already finalized' using errcode='23514';
 end if;
 select * into a from public.appointments where id=v.appointment_id;
 update public.visit_summaries set status='finalized',vet_user_id=auth.uid(),finalized_at=now(),finalize_idempotency_key=p_idempotency_key where id=v.id returning * into v;
 insert into public.health_records(user_id,pet_id,record_type,title,date,description,source_visit_summary_id)
 values(a.user_id,v.pet_id,'Treatment','Visit Summary',current_date,concat_ws(E'\n',v.findings,v.actions_taken,v.care_instructions,v.warning_signs),v.id) on conflict(source_visit_summary_id) where source_visit_summary_id is not null do nothing;
 for item in select * from jsonb_array_elements(coalesce(p_vaccinations,'[]'::jsonb)) loop
   insert into public.vaccinations(user_id,pet_id,vaccine_name,date_administered,next_due_date,veterinarian,location,source_visit_summary_id)
   values(a.user_id,v.pet_id,item->>'name',coalesce((item->>'date_administered')::timestamptz,now()),(item->>'next_due_date')::timestamptz,(select full_name from public.profiles where id=auth.uid()),(select name from public.stores where id=v.store_id),v.id)
   on conflict(source_visit_summary_id,vaccine_name) where source_visit_summary_id is not null do nothing;
 end loop;
 insert into public.notifications(user_id,store_id,appointment_id,event_type,title,body) values(a.user_id,v.store_id,a.id,'visit_summary_ready','สรุปการเข้ารับบริการพร้อมดู',null);
 insert into public.audit_logs(store_id,actor_user_id,action,entity_type,entity_id) values(v.store_id,auth.uid(),'finalize','visit_summary',v.id);
 return v;
end $$;
grant execute on function public.finalize_visit_summary(uuid,text,jsonb) to authenticated;

create or replace function public.log_health_access(p_appointment_id uuid,p_entity text)
returns void language plpgsql security definer set search_path=public as $$
declare a public.appointments;
begin
 select * into a from public.appointments where id=p_appointment_id;
 if a.id is null or not public.is_store_member(a.store_id) then raise exception 'access denied' using errcode='42501'; end if;
 insert into public.audit_logs(store_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(a.store_id,auth.uid(),'read_health_context',p_entity,a.pet_id,jsonb_build_object('appointment_id',a.id));
end $$;
grant execute on function public.log_health_access(uuid,text) to authenticated;

create or replace function public.prevent_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'audit logs are append-only' using errcode='42501'; end $$;
create trigger audit_logs_append_only before update or delete on public.audit_logs for each row execute function public.prevent_audit_mutation();
create trigger status_history_append_only before update or delete on public.appointment_status_history for each row execute function public.prevent_audit_mutation();
create trigger set_visit_summaries_updated_at before update on public.visit_summaries for each row execute function public.set_updated_at();
create or replace function public.prevent_finalized_summary_edit() returns trigger language plpgsql as $$
begin if old.status='finalized' and row(new.*) is distinct from row(old.*) then raise exception 'finalized summary is immutable' using errcode='23514'; end if; return new; end $$;
create trigger visit_summary_finalized_immutable before update on public.visit_summaries for each row execute function public.prevent_finalized_summary_edit();
