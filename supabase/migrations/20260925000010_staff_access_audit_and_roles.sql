-- Allow non-business Auth users to be created by the staff provisioning function.
-- Business signup still runs when all business metadata is present.
create or replace function public.handle_new_business_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  business_id uuid;
  signup_data jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  business_name text := nullif(trim(signup_data ->> 'business_name'), '');
  business_type text := nullif(trim(signup_data ->> 'business_type'), '');
  phone text := nullif(trim(signup_data ->> 'phone'), '');
  address text := nullif(trim(signup_data ->> 'address'), '');
begin
  if business_name is null
    or business_type is null
    or phone is null
    or address is null then
    return new;
  end if;

  insert into public.profiles (
    id, full_name, email, phone, role, status
  )
  values (
    new.id, business_name, new.email, phone, 'BUSINESS_OWNER', 'ACTIVE'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    status = excluded.status;

  insert into public.businesses (
    name, business_type, email, phone, address, status
  )
  values (
    business_name, business_type, new.email, phone, address, 'ACTIVE'
  )
  returning id into business_id;

  insert into public.business_members (
    business_id, user_id, role, status, invitation_status
  )
  values (
    business_id, new.id, 'OWNER', 'ACTIVE', 'ACCEPTED'
  );

  return new;
end;
$$;

revoke all on function public.handle_new_business_signup() from public;

create or replace function public.user_has_business_role(
  target_business_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = target_business_id
      and member.user_id = auth.uid()
      and member.status = 'ACTIVE'
      and member.role = any(allowed_roles)
  );
$$;

revoke all on function public.user_has_business_role(uuid, text[]) from public, anon;
grant execute on function public.user_has_business_role(uuid, text[]) to authenticated;

create table if not exists public.business_access_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('LOGIN', 'LOGOUT')),
  occurred_at timestamptz not null default now()
);
create index if not exists business_access_logs_business_time_idx
  on public.business_access_logs(business_id, occurred_at desc);

alter table public.business_access_logs enable row level security;
drop policy if exists business_access_logs_read on public.business_access_logs;
create policy business_access_logs_read
  on public.business_access_logs for select to authenticated
  using (public.user_is_active_business_member(business_id));
drop policy if exists business_access_logs_insert on public.business_access_logs;
create policy business_access_logs_insert
  on public.business_access_logs for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.user_is_active_business_member(business_id)
  );

-- Members may see the names used in transaction and access history records.
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Business members can read member profiles" on public.profiles;
create policy "Business members can read member profiles"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.business_members target_member
      join public.business_members viewer_member
        on viewer_member.business_id = target_member.business_id
      where target_member.user_id = profiles.id
        and viewer_member.user_id = auth.uid()
        and target_member.status = 'ACTIVE'
        and viewer_member.status = 'ACTIVE'
    )
  );

-- Replace the broad operations policy with role-aware policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers', 'products_services', 'workstations', 'nfc_cards',
    'wallet_ledger', 'business_transactions', 'business_invitations',
    'content_items', 'purchase_requests', 'settlement_requests',
    'report_snapshots'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_tenant_access', table_name);
  end loop;
end $$;

create policy customers_role_access on public.customers for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER', 'CASHIER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER', 'CASHIER']));
create policy products_services_role_access on public.products_services for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));
create policy workstations_role_access on public.workstations for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));
create policy nfc_cards_role_access on public.nfc_cards for all to authenticated
  using (public.user_is_active_business_member(business_id))
  with check (public.user_is_active_business_member(business_id));
create policy wallet_ledger_role_access on public.wallet_ledger for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER', 'CASHIER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER', 'CASHIER']));
create policy business_transactions_role_access on public.business_transactions for all to authenticated
  using (public.user_is_active_business_member(business_id))
  with check (public.user_is_active_business_member(business_id));
create policy business_invitations_role_access on public.business_invitations for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER']))
  with check (public.user_has_business_role(business_id, array['OWNER']));
create policy content_items_role_access on public.content_items for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));
create policy purchase_requests_role_access on public.purchase_requests for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));
create policy settlement_requests_role_access on public.settlement_requests for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));
create policy report_snapshots_role_access on public.report_snapshots for all to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));
