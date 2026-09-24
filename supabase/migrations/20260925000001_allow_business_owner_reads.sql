-- Allow an authenticated owner to read only their own application records.
-- These policies are intentionally narrow and do not expose other businesses.

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can read their own memberships" on public.business_members;
create policy "Users can read their own memberships"
  on public.business_members
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Members can read their businesses" on public.businesses;
create policy "Members can read their businesses"
  on public.businesses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.business_members membership
      where membership.business_id = businesses.id
        and membership.user_id = (select auth.uid())
        and membership.status = 'ACTIVE'
    )
  );
