-- Business operations schema. This migration is additive and intentionally
-- leaves the existing signup tables, columns, triggers, and data untouched.

create or replace function public.user_is_active_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.status = 'ACTIVE'
  );
$$;
revoke all on function public.user_is_active_business_member(uuid) from public, anon;
grant execute on function public.user_is_active_business_member(uuid) to authenticated;

-- Existing installations may already have one of these names with a partial
-- legacy shape. Add the tenant key before creating tenant-scoped indexes.
do $$
declare
  operation_table text;
  table_exists boolean;
begin
  foreach operation_table in array array[
    'customers', 'products_services', 'workstations', 'nfc_cards',
    'wallet_ledger', 'business_transactions', 'business_invitations',
    'content_items', 'purchase_requests', 'settlement_requests',
    'report_snapshots'
  ] loop
    select exists (
      select 1
      from information_schema.tables existing_table
      where existing_table.table_schema = 'public'
        and existing_table.table_name = operation_table
    ) into table_exists;

    if table_exists
      and not exists (
        select 1
        from information_schema.columns existing_column
        where existing_column.table_schema = 'public'
          and existing_column.table_name = operation_table
          and existing_column.column_name = 'business_id'
      ) then
      execute format(
        'alter table public.%I add column business_id uuid references public.businesses(id) on delete cascade',
        operation_table
      );
    end if;
  end loop;
end $$;

create table if not exists public.customers (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text not null,
  status text not null default 'ACTIVE',
  wallet_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_business_id_idx on public.customers(business_id);

create table if not exists public.products_services (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  price numeric(14,2) not null default 0,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_services_business_id_idx on public.products_services(business_id);

create table if not exists public.workstations (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null,
  location text,
  rate numeric(14,2) not null default 0,
  device text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workstations_business_id_idx on public.workstations(business_id);

create table if not exists public.nfc_cards (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- Kept type-compatible with existing UUID- or text-based customer schemas.
  customer_id text,
  status text not null default 'ACTIVE',
  replaced_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nfc_cards_business_id_idx on public.nfc_cards(business_id);

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id text,
  type text not null,
  amount numeric(14,2) not null,
  status text not null default 'COMPLETED',
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_business_id_idx on public.wallet_ledger(business_id);

create table if not exists public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- These identifiers are intentionally not foreign keys because existing
  -- installations may use UUID primary keys while the app uses text IDs.
  customer_id text,
  card_id text,
  workstation_id text,
  type text not null,
  amount numeric(14,2) not null,
  status text not null default 'COMPLETED',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists business_transactions_business_id_idx on public.business_transactions(business_id);

create table if not exists public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null default 'STAFF',
  status text not null default 'PENDING',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  content text,
  status text not null default 'DRAFT',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_items add column if not exists content_id text;
alter table public.content_items add column if not exists description text;
alter table public.content_items add column if not exists type text not null default 'UPDATE';
alter table public.content_items add column if not exists start_date date;
alter table public.content_items add column if not exists end_date date;
alter table public.content_items add column if not exists media_url text;
alter table public.content_items add column if not exists call_to_action text;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric(14,2) not null,
  reference text,
  notes text,
  status text not null default 'PENDING',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.settlement_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric(14,2) not null,
  notes text,
  status text not null default 'PENDING',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  report_type text not null,
  period_start date,
  period_end date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_tenant_access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.user_is_active_business_member(business_id)) with check (public.user_is_active_business_member(business_id))',
      table_name || '_tenant_access', table_name
    );
  end loop;
end $$;
