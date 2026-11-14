alter table public.stores
  add column if not exists store_profile_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-profile-images', 'store-profile-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists store_profile_images_public_read on storage.objects;
create policy store_profile_images_public_read on storage.objects for select to public
  using (bucket_id = 'store-profile-images');

drop policy if exists store_profile_images_owner_insert on storage.objects;
create policy store_profile_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'store-profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists store_profile_images_owner_update on storage.objects;
create policy store_profile_images_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'store-profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'store-profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
