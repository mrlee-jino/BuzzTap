create table if not exists public.business_preferences (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  notifications jsonb not null default '{
    "transactionAlerts": true,
    "settlementUpdates": true,
    "contentModeration": true,
    "lowPointInventory": true
  }'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.business_preferences enable row level security;
drop policy if exists business_preferences_owner_access on public.business_preferences;
drop policy if exists business_preferences_member_read on public.business_preferences;
drop policy if exists business_preferences_owner_insert on public.business_preferences;
drop policy if exists business_preferences_owner_update on public.business_preferences;
drop policy if exists business_preferences_owner_delete on public.business_preferences;
create policy business_preferences_member_read
  on public.business_preferences for select to authenticated
  using (public.user_is_active_business_member(business_id));
create policy business_preferences_owner_insert
  on public.business_preferences for insert to authenticated
  with check (public.user_has_business_role(business_id, array['OWNER']));
create policy business_preferences_owner_update
  on public.business_preferences for update to authenticated
  using (public.user_has_business_role(business_id, array['OWNER']))
  with check (public.user_has_business_role(business_id, array['OWNER']));
create policy business_preferences_owner_delete
  on public.business_preferences for delete to authenticated
  using (public.user_has_business_role(business_id, array['OWNER']));

drop policy if exists businesses_owner_update on public.businesses;
create policy businesses_owner_update
  on public.businesses for update to authenticated
  using (public.user_has_business_role(id, array['OWNER']))
  with check (public.user_has_business_role(id, array['OWNER']));

create table if not exists public.workstation_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  workstation_id text not null,
  customer_id text,
  operator_id uuid references auth.users(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists workstation_sessions_business_started_idx
  on public.workstation_sessions(business_id, started_at desc);
create unique index if not exists workstation_sessions_one_active_per_station_idx
  on public.workstation_sessions(business_id, workstation_id)
  where status = 'ACTIVE';

alter table public.workstation_sessions enable row level security;
drop policy if exists workstation_sessions_member_read on public.workstation_sessions;
create policy workstation_sessions_member_read
  on public.workstation_sessions for select to authenticated
  using (public.user_is_active_business_member(business_id));

create table if not exists public.product_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id text not null,
  movement_type text not null check (movement_type in ('ISSUE', 'RESTOCK')),
  quantity integer not null check (quantity > 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists product_inventory_movements_business_created_idx
  on public.product_inventory_movements(business_id, created_at desc);

alter table public.product_inventory_movements enable row level security;
drop policy if exists product_inventory_movements_member_read on public.product_inventory_movements;
create policy product_inventory_movements_member_read
  on public.product_inventory_movements for select to authenticated
  using (public.user_is_active_business_member(business_id));

alter table public.business_notifications
  add column if not exists category text;

-- Staff can read the catalog to issue stock; only managers can edit it directly.
drop policy if exists products_services_role_access on public.products_services;
drop policy if exists products_services_member_read on public.products_services;
drop policy if exists products_services_manager_insert on public.products_services;
drop policy if exists products_services_manager_update on public.products_services;
drop policy if exists products_services_manager_delete on public.products_services;
create policy products_services_member_read
  on public.products_services for select to authenticated
  using (public.user_is_active_business_member(business_id));
create policy products_services_manager_insert
  on public.products_services for insert to authenticated
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));
create policy products_services_manager_update
  on public.products_services for update to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']))
  with check (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));
create policy products_services_manager_delete
  on public.products_services for delete to authenticated
  using (public.user_has_business_role(business_id, array['OWNER', 'MANAGER']));

create or replace function public.save_business_settings(
  p_business_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_notifications jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.user_has_business_role(p_business_id, array['OWNER']) then
    raise exception 'Only a business owner can update business settings'
      using errcode = '42501';
  end if;

  if nullif(trim(p_name), '') is null
    or nullif(trim(p_email), '') is null
    or nullif(trim(p_phone), '') is null
    or nullif(trim(p_address), '') is null
    or jsonb_typeof(p_notifications) is distinct from 'object'
    or jsonb_typeof(p_notifications -> 'transactionAlerts') is distinct from 'boolean'
    or jsonb_typeof(p_notifications -> 'settlementUpdates') is distinct from 'boolean'
    or jsonb_typeof(p_notifications -> 'contentModeration') is distinct from 'boolean'
    or jsonb_typeof(p_notifications -> 'lowPointInventory') is distinct from 'boolean' then
    raise exception 'Business settings are incomplete or invalid'
      using errcode = '22023';
  end if;

  update public.businesses
  set name = trim(p_name),
      email = trim(p_email),
      phone = trim(p_phone),
      address = trim(p_address)
  where id = p_business_id;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  insert into public.business_preferences (business_id, notifications, updated_at)
  values (p_business_id, p_notifications, now())
  on conflict (business_id) do update
    set notifications = excluded.notifications,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_business_settings(uuid, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.save_business_settings(uuid, text, text, text, text, jsonb)
  to authenticated;

create or replace function public.start_workstation_session(
  p_business_id uuid,
  p_workstation_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  new_session_id uuid;
begin
  if not public.user_has_business_role(p_business_id, array['OWNER', 'MANAGER']) then
    raise exception 'Not authorized to start a workstation session'
      using errcode = '42501';
  end if;

  select status into current_status
  from public.workstations
  where business_id = p_business_id and id = p_workstation_id
  for update;

  if not found or current_status <> 'ACTIVE' then
    raise exception 'Workstation is not available'
      using errcode = 'P0001';
  end if;

  update public.workstations
  set status = 'IN_USE'
  where business_id = p_business_id and id = p_workstation_id;

  insert into public.workstation_sessions (
    business_id, workstation_id, operator_id
  )
  values (p_business_id, p_workstation_id, auth.uid())
  returning id into new_session_id;

  return new_session_id;
end;
$$;

revoke all on function public.start_workstation_session(uuid, text)
  from public, anon;
grant execute on function public.start_workstation_session(uuid, text)
  to authenticated;

create or replace function public.end_workstation_session(
  p_business_id uuid,
  p_workstation_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session_id uuid;
begin
  if not public.user_has_business_role(p_business_id, array['OWNER', 'MANAGER']) then
    raise exception 'Not authorized to end a workstation session'
      using errcode = '42501';
  end if;

  select id into active_session_id
  from public.workstation_sessions
  where business_id = p_business_id
    and workstation_id = p_workstation_id
    and status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'No active workstation session was found'
      using errcode = 'P0002';
  end if;

  update public.workstation_sessions
  set status = 'COMPLETED', ended_at = now()
  where id = active_session_id;

  update public.workstations
  set status = 'ACTIVE'
  where business_id = p_business_id
    and id = p_workstation_id
    and status = 'IN_USE';

  if not found then
    raise exception 'Workstation state is inconsistent'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.end_workstation_session(uuid, text)
  from public, anon;
grant execute on function public.end_workstation_session(uuid, text)
  to authenticated;

create or replace function public.issue_product_inventory(
  p_business_id uuid,
  p_product_id text,
  p_quantity integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock integer;
  movement_id uuid;
begin
  if not public.user_has_business_role(
    p_business_id, array['OWNER', 'MANAGER', 'CASHIER', 'STAFF']
  ) then
    raise exception 'Not authorized to issue product inventory'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be greater than zero'
      using errcode = '22023';
  end if;

  select stock into current_stock
  from public.products_services
  where business_id = p_business_id
    and id = p_product_id
    and status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Active product was not found'
      using errcode = 'P0002';
  end if;

  if current_stock < p_quantity then
    raise exception 'Insufficient product stock'
      using errcode = '22023';
  end if;

  update public.products_services
  set stock = stock - p_quantity
  where business_id = p_business_id and id = p_product_id;

  insert into public.product_inventory_movements (
    business_id, product_id, movement_type, quantity, note, created_by
  )
  values (
    p_business_id, p_product_id, 'ISSUE', p_quantity,
    nullif(trim(p_note), ''), auth.uid()
  )
  returning id into movement_id;

  return movement_id;
end;
$$;

revoke all on function public.issue_product_inventory(uuid, text, integer, text)
  from public, anon;
grant execute on function public.issue_product_inventory(uuid, text, integer, text)
  to authenticated;

create or replace function public.restock_product_inventory(
  p_business_id uuid,
  p_product_id text,
  p_quantity integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  movement_id uuid;
begin
  if not public.user_has_business_role(
    p_business_id, array['OWNER', 'MANAGER']
  ) then
    raise exception 'Only a business owner or manager can restock inventory'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Restock quantity must be greater than zero'
      using errcode = '22023';
  end if;

  update public.products_services
  set stock = stock + p_quantity
  where business_id = p_business_id
    and id = p_product_id
    and status = 'ACTIVE';

  if not found then
    raise exception 'Active product was not found'
      using errcode = 'P0002';
  end if;

  insert into public.product_inventory_movements (
    business_id, product_id, movement_type, quantity, note, created_by
  )
  values (
    p_business_id, p_product_id, 'RESTOCK', p_quantity,
    nullif(trim(p_note), ''), auth.uid()
  )
  returning id into movement_id;

  return movement_id;
end;
$$;

revoke all on function public.restock_product_inventory(uuid, text, integer, text)
  from public, anon;
grant execute on function public.restock_product_inventory(uuid, text, integer, text)
  to authenticated;

create or replace function public.record_business_refund(
  p_business_id uuid,
  p_transaction_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  original_transaction public.business_transactions%rowtype;
  refund_id uuid;
begin
  if not public.user_has_business_role(
    p_business_id, array['OWNER', 'MANAGER', 'CASHIER']
  ) then
    raise exception 'Not authorized to record a refund'
      using errcode = '42501';
  end if;

  select * into original_transaction
  from public.business_transactions
  where id = p_transaction_id
    and business_id = p_business_id
    and type = 'CUSTOMER_PURCHASE'
    and status = 'COMPLETED'
  for update;

  if not found then
    raise exception 'Completed customer purchase was not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.business_transactions
    where business_id = p_business_id
      and type = 'REFUND'
      and metadata ->> 'original_transaction_id' = p_transaction_id::text
  ) then
    raise exception 'This transaction has already been refunded'
      using errcode = '23505';
  end if;

  insert into public.business_transactions (
    business_id, customer_id, card_id, workstation_id,
    type, amount, status, metadata, created_by
  )
  values (
    p_business_id,
    original_transaction.customer_id,
    original_transaction.card_id,
    original_transaction.workstation_id,
    'REFUND',
    original_transaction.amount,
    'COMPLETED',
    jsonb_build_object(
      'original_transaction_id', original_transaction.id,
      'refund_record_only', true
    ),
    auth.uid()
  )
  returning id into refund_id;

  return refund_id;
end;
$$;

revoke all on function public.record_business_refund(uuid, uuid)
  from public, anon;
grant execute on function public.record_business_refund(uuid, uuid)
  to authenticated;

create or replace function public.assign_nfc_card(
  p_business_id uuid,
  p_customer_id text,
  p_card_id text,
  p_old_card_id text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  found_customer_id text;
begin
  if not public.user_has_business_role(
    p_business_id, array['OWNER', 'MANAGER', 'CASHIER']
  ) then
    raise exception 'Not authorized to assign customer cards'
      using errcode = '42501';
  end if;

  select id into found_customer_id
  from public.customers
  where business_id = p_business_id
    and id = p_customer_id
    and status = 'ACTIVE'
  for update;

  if nullif(trim(p_card_id), '') is null or not found then
    raise exception 'Active customer and card ID are required'
      using errcode = '22023';
  end if;

  if p_old_card_id is not null then
    update public.nfc_cards
    set status = 'REPLACED', replaced_by = trim(p_card_id)
    where business_id = p_business_id
      and id = p_old_card_id
      and customer_id = p_customer_id
      and status = 'ACTIVE';

    if not found then
      raise exception 'The active customer card was not found'
        using errcode = 'P0002';
    end if;
  elsif exists (
    select 1 from public.nfc_cards
    where business_id = p_business_id
      and customer_id = p_customer_id
      and status = 'ACTIVE'
  ) then
    raise exception 'Customer already has an active card to replace'
      using errcode = '23505';
  end if;

  insert into public.nfc_cards (id, business_id, customer_id, status)
  values (trim(p_card_id), p_business_id, p_customer_id, 'ACTIVE');

  return trim(p_card_id);
end;
$$;

revoke all on function public.assign_nfc_card(uuid, text, text, text)
  from public, anon;
grant execute on function public.assign_nfc_card(uuid, text, text, text)
  to authenticated;

create or replace function public.load_customer_points(
  p_business_id uuid,
  p_customer_id text,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_business_id uuid;
  purchased_points numeric;
  distributed_points numeric;
  ledger_id uuid;
begin
  if not public.user_has_business_role(
    p_business_id, array['OWNER', 'MANAGER', 'CASHIER']
  ) then
    raise exception 'Not authorized to load customer points'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Point load amount must be greater than zero'
      using errcode = '22023';
  end if;

  select id into locked_business_id
  from public.businesses
  where id = p_business_id
  for update;

  if not found then
    raise exception 'Business was not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.customers
    where business_id = p_business_id
      and id = p_customer_id
      and status = 'ACTIVE'
  ) then
    raise exception 'Active customer was not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0) into purchased_points
  from public.wallet_ledger
  where business_id = p_business_id
    and type = 'PURCHASE'
    and upper(status) = 'COMPLETED';

  select purchased_points + coalesce(sum(amount), 0)
  into purchased_points
  from public.purchase_requests
  where business_id = p_business_id
    and upper(status) = 'APPROVED';

  select coalesce(sum(amount), 0) into distributed_points
  from public.wallet_ledger
  where business_id = p_business_id
    and type = 'CUSTOMER_LOAD'
    and upper(status) = 'COMPLETED';

  if purchased_points - distributed_points < p_amount then
    raise exception 'Insufficient available business point allocation'
      using errcode = '22023';
  end if;

  insert into public.wallet_ledger (
    business_id, customer_id, type, amount, status, created_by
  )
  values (
    p_business_id, p_customer_id, 'CUSTOMER_LOAD', p_amount,
    'COMPLETED', auth.uid()
  )
  returning id into ledger_id;

  return ledger_id;
end;
$$;

revoke all on function public.load_customer_points(uuid, text, numeric)
  from public, anon;
grant execute on function public.load_customer_points(uuid, text, numeric)
  to authenticated;
