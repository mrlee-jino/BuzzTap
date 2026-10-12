begin;

-- Resolve the storage object path outside the businesses subquery: the
-- unqualified "name" there referred to the business name, not the file path.
-- A checked definer function also avoids requiring a separate business-table
-- SELECT policy just to authorize a storage upload.
create or replace function public.can_upload_business_profile_image(p_object_name text)
returns boolean language sql stable security definer set search_path=public
as $$
  select auth.uid() is not null
    and split_part(p_object_name,'/',2) in ('logo_url','cover_url')
    and exists(select 1 from public.businesses b
      where b.id::text=split_part(p_object_name,'/',1) and b.status='ACTIVE'
        and public.user_has_business_role(b.id,array['OWNER','MANAGER']));
$$;
revoke all on function public.can_upload_business_profile_image(text) from public,anon;
grant execute on function public.can_upload_business_profile_image(text) to authenticated;

-- Re-establish the bucket configuration if the earlier migration was missed.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-profile-images','business-profile-images',true,10485760,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists business_profile_image_insert on storage.objects;
create policy business_profile_image_insert on storage.objects
for insert to authenticated with check (
  bucket_id='business-profile-images'
  and public.can_upload_business_profile_image(storage.objects.name)
);
commit;
