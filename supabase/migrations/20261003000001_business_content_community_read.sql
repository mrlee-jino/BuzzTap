-- Authenticated business users may view published community posts.
-- Draft, submitted, rejected, and archived posts remain tenant-scoped.
drop policy if exists content_items_community_published_read on public.content_items;
create policy content_items_community_published_read
  on public.content_items for select to authenticated
  using (status = 'PUBLISHED');
