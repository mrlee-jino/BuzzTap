-- Community reads published content across tenants, including admin posts.
-- Unpublished content continues to use existing tenant/admin policies.
begin;
drop policy if exists content_items_community_published_read on public.content_items;
create policy content_items_community_published_read
  on public.content_items for select to authenticated
  using (status = 'PUBLISHED' and exists (
    select 1 from public.business_members member
    where member.user_id = auth.uid() and member.status = 'ACTIVE'
  ));

-- Expose only public display names for businesses with published posts.
-- Do not grant cross-tenant access to private business profile fields.
create or replace function public.get_community_business_names(p_business_ids uuid[])
returns table (id uuid, name text)
language sql stable security definer set search_path = public
as $$
  select business.id, business.name::text
  from public.businesses business
  where business.id = any(p_business_ids)
    and auth.uid() is not null
    and exists (
      select 1 from public.business_members member
      where member.user_id = auth.uid() and member.status = 'ACTIVE'
    )
    and exists (
      select 1 from public.content_items item
      where item.business_id = business.id and item.status = 'PUBLISHED'
    );
$$;
revoke all on function public.get_community_business_names(uuid[]) from public, anon;
grant execute on function public.get_community_business_names(uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
