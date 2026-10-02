-- Businesses can manage their own content but must leave moderation outcomes
-- (such as publishing or approval) to Admin Web.
drop policy if exists content_items_role_access on public.content_items;

drop policy if exists content_items_business_read on public.content_items;
create policy content_items_business_read
  on public.content_items for select to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));

drop policy if exists content_items_business_insert on public.content_items;
create policy content_items_business_insert
  on public.content_items for insert to authenticated
  with check (
    public.user_has_business_role(business_id, array['OWNER', 'MANAGER'])
    and status in ('DRAFT', 'SUBMITTED')
  );

drop policy if exists content_items_business_update on public.content_items;
create policy content_items_business_update
  on public.content_items for update to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']))
  with check (
    public.user_has_business_role(business_id, array['OWNER', 'MANAGER'])
    and status in ('DRAFT', 'SUBMITTED', 'ARCHIVED')
  );
