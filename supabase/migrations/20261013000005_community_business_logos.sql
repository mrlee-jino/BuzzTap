begin;
-- Return one existing logo URL per business; never duplicate image data
-- into posts or expose the business's private account settings.
create or replace function public.get_community_business_identities(p_business_ids uuid[])
returns table(id uuid,name text,logo_url text)
language sql stable security definer set search_path=public
as $$
  select b.id,coalesce(nullif(p.profile->>'display_name',''),b.name)::text,
    coalesce(p.profile->>'logo_url','')
  from public.businesses b
  left join public.business_public_profiles p on p.business_id=b.id
  where b.id=any(p_business_ids) and b.status='ACTIVE' and auth.uid() is not null
    and exists(select 1 from public.content_items item where item.business_id=b.id and item.status='PUBLISHED');
$$;
revoke all on function public.get_community_business_identities(uuid[]) from public,anon;
grant execute on function public.get_community_business_identities(uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
