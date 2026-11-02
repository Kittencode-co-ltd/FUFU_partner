-- Storage inventory. Avatars remain public for current-client compatibility;
-- scan images are private because they may contain sensitive health context.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-avatars', 'pet-avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('profile-avatars', 'profile-avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('scan-images', 'scan-images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects'
    and policyname like 'mvp_%'
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy mvp_owner_read on storage.objects for select to authenticated
  using (bucket_id in ('pet-avatars','profile-avatars','scan-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy mvp_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('pet-avatars','profile-avatars','scan-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy mvp_owner_update on storage.objects for update to authenticated
  using (bucket_id in ('pet-avatars','profile-avatars','scan-images') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('pet-avatars','profile-avatars','scan-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy mvp_owner_delete on storage.objects for delete to authenticated
  using (bucket_id in ('pet-avatars','profile-avatars','scan-images') and (storage.foldername(name))[1] = auth.uid()::text);
