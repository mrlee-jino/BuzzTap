begin;
-- Profile branding images are publicly readable; only a business's owners
-- and managers can upload into its UUID-prefixed folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-profile-images','business-profile-images',true,10485760,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists business_profile_image_insert on storage.objects;
create policy business_profile_image_insert on storage.objects
for insert to authenticated with check (
  bucket_id='business-profile-images'
  and exists(select 1 from public.businesses b
    where b.id::text=split_part(storage.objects.name,'/',1) and b.status='ACTIVE'
      and public.user_has_business_role(b.id,array['OWNER','MANAGER']))
);
commit;
