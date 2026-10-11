-- Shared BP uses the same wallets as current Admin funding. No legacy
-- balances are merged, and treasury is never modified by business operations.
begin;

alter table public.workstation_sessions
  add column if not exists purchase_request_id uuid,
  add column if not exists purchase_payload jsonb;
create unique index if not exists workstation_sessions_purchase_request_id_idx
  on public.workstation_sessions(purchase_request_id);

create table if not exists public.business_customer_bp_transfers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  business_id uuid not null references public.businesses(id),
  profile_id uuid not null references public.profiles(id),
  customer_id text not null,
  kind text not null check (kind in ('LOAD','PAYMENT','REFUND')),
  amount bigint not null check (amount > 0),
  customer_before bigint not null,
  customer_after bigint not null check (customer_after >= 0),
  business_before bigint not null,
  business_after bigint not null check (business_after >= 0),
  original_id uuid unique references public.business_customer_bp_transfers(id),
  local_transaction_id uuid not null unique,
  shared_transaction_id text not null,
  payload jsonb not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.business_customer_bp_transfers enable row level security;
revoke all on public.business_customer_bp_transfers from anon,authenticated;

create or replace function public.get_business_shared_bp(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to view customer balances' using errcode='42501';
  end if;
  return jsonb_build_object(
    'business_balance',coalesce((select balance from public.business_bp_wallets where business_id=p_business_id),0),
    'customers',coalesce((select jsonb_agg(jsonb_build_object(
      'id',customer.id::text,'balance',case when profile.id is not null then coalesce(wallet.balance,0) else null end,'profile_status',profile.status))
      from public.customers customer
      left join public.profiles profile on profile.id=customer.profile_id
      left join public.customer_bp_wallets wallet on wallet.customer_id=profile.id
      where customer.business_id=p_business_id),'[]'::jsonb)
  );
end;
$$;

-- Private transfer primitive. Public callers use the checked wrappers below.
create or replace function public.apply_business_shared_bp(
  p_business_id uuid,p_customer_id text,p_kind text,p_amount numeric,
  p_request_id uuid,p_original_id uuid,p_context jsonb
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  registered public.customers%rowtype;
  profile public.profiles%rowtype;
  prior public.business_customer_bp_transfers%rowtype;
  original public.business_customer_bp_transfers%rowtype;
  local_record public.business_transactions%rowtype;
  transfer_id uuid := gen_random_uuid();
  local_id uuid;
  shared_id text;
  code text;
  payload_value jsonb;
  customer_before bigint;
  business_before bigint;
  customer_after bigint;
  business_after bigint;
  amount_value bigint;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to transfer customer BP' using errcode='42501';
  end if;
  if p_request_id is null or p_kind is null or p_kind not in ('LOAD','PAYMENT','REFUND') then
    raise exception 'Request ID and valid transfer kind are required';
  end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount<=0 or p_amount<>trunc(p_amount) or p_amount>9007199254740991 then
    raise exception 'BP amount must be a positive whole number within the supported range';
  end if;
  amount_value:=p_amount::bigint;
  payload_value:=jsonb_build_object('business',p_business_id,'customer',p_customer_id,
    'kind',p_kind,'amount',amount_value,'original',p_original_id,'context',coalesce(p_context,'{}'::jsonb));
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into prior from public.business_customer_bp_transfers where request_id=p_request_id;
  if found then
    if prior.payload<>payload_value then raise exception 'Request ID was already used for different details'; end if;
    return prior.id;
  end if;
  select * into registered from public.customers
    where business_id=p_business_id and id::text=p_customer_id and status='ACTIVE' for share;
  if not found or registered.profile_id is null then
    raise exception 'Select an active customer linked to a BuzzTap account';
  end if;
  select * into profile from public.profiles where id=registered.profile_id for update;
  if not found or profile.role is distinct from 'CUSTOMER' or profile.status is distinct from 'ACTIVE' then
    raise exception 'Customer account is frozen, closed, or inactive';
  end if;
  if not exists(select 1 from public.businesses where id=p_business_id and status='ACTIVE') then
    raise exception 'Business is not active';
  end if;
  if p_kind='REFUND' then
    select * into original from public.business_customer_bp_transfers
      where id=p_original_id and business_id=p_business_id and profile_id=profile.id and kind='PAYMENT'
      for update;
    if not found or original.amount<>amount_value then raise exception 'Original shared payment was not found'; end if;
    if exists(select 1 from public.business_customer_bp_transfers where original_id=p_original_id) then
      raise exception 'This shared payment has already been refunded';
    end if;
  elsif p_original_id is not null then raise exception 'Original payment is only valid for refunds';
  end if;
  -- All business transfers lock wallets in the same order. Admin funding
  -- locks the profile or treasury first and credits these same wallet rows.
  insert into public.business_bp_wallets(business_id,balance) values(p_business_id,0) on conflict do nothing;
  insert into public.customer_bp_wallets(customer_id,balance) values(profile.id,0) on conflict do nothing;
  select balance into business_before from public.business_bp_wallets where business_id=p_business_id for update;
  select balance into customer_before from public.customer_bp_wallets where customer_id=profile.id for update;
  if p_kind='PAYMENT' then
    if customer_before<amount_value then raise exception 'Insufficient shared BuzzPoints balance'; end if;
    customer_after:=customer_before-amount_value;
    business_after:=business_before+amount_value;
  else
    if business_before<amount_value then raise exception 'Insufficient business BuzzPoints balance'; end if;
    customer_after:=customer_before+amount_value;
    business_after:=business_before-amount_value;
  end if;
  update public.customer_bp_wallets set balance=customer_after,updated_at=now() where customer_id=profile.id;
  update public.business_bp_wallets set balance=business_after,updated_at=now() where business_id=p_business_id;
  code:='BPSHARED-'||upper(replace(transfer_id::text,'-',''));
  local_record.customer_id:=registered.id::text;
  local_record.workstation_id:=p_context->>'workstation_id';
  insert into public.business_transactions(business_id,customer_id,workstation_id,type,amount,status,metadata,created_by)
    values(p_business_id,local_record.customer_id,local_record.workstation_id,
      case p_kind when 'PAYMENT' then 'CUSTOMER_PURCHASE' when 'LOAD' then 'CUSTOMER_LOAD' else 'REFUND' end,
      amount_value,'COMPLETED',coalesce(p_context,'{}'::jsonb)||jsonb_build_object(
        'shared_transfer_id',transfer_id,'profile_id',profile.id,'payment_method','BUZZPOINTS',
        'original_transaction_id',original.local_transaction_id),auth.uid()) returning id into local_id;
  insert into public.transactions(transaction_code,customer_id,business_id,transaction_type,status,
    amount_bp,description,metadata,completed_at)
    values(code,profile.id,p_business_id,
      case p_kind when 'PAYMENT' then 'PURCHASE' when 'LOAD' then 'CUSTOMER_LOAD' else 'REFUND' end,
      'COMPLETED',amount_value,'Shared BP '||lower(p_kind),jsonb_build_object(
        'wallet_source','customer_bp_wallets','transfer_id',transfer_id,
        'original_transfer_id',p_original_id,'local_transaction_id',local_id),now()) returning id::text into shared_id;
  insert into public.business_customer_bp_transfers(id,request_id,business_id,profile_id,customer_id,
    kind,amount,customer_before,customer_after,business_before,business_after,original_id,
    local_transaction_id,shared_transaction_id,payload,actor_id)
    values(transfer_id,p_request_id,p_business_id,profile.id,registered.id::text,p_kind,amount_value,
      customer_before,customer_after,business_before,business_after,p_original_id,local_id,shared_id,payload_value,auth.uid());
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,details)
    values(auth.uid(),'BUSINESS_SHARED_BP_'||p_kind,'TRANSACTION',shared_id::uuid,
      jsonb_build_object('transfer_id',transfer_id,'business_id',p_business_id,'customer_id',profile.id,
        'amount',amount_value,'customer_before',customer_before,'customer_after',customer_after,
        'business_before',business_before,'business_after',business_after));
  return transfer_id;
end;
$$;

create or replace function public.load_shared_customer_bp(p_business_id uuid,p_customer_id text,p_amount numeric,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$ begin
  return public.apply_business_shared_bp(p_business_id,p_customer_id,'LOAD',p_amount,p_request_id,null,'{}');
end; $$;

create or replace function public.refund_shared_customer_bp(p_business_id uuid,p_transaction_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$ declare
  original public.business_customer_bp_transfers%rowtype;
  product public.products_services%rowtype;
  movement public.product_inventory_movements%rowtype;
  refund_id uuid;
  product_code text;
  quantity_value integer;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to refund BP' using errcode='42501';
  end if;
  select * into original from public.business_customer_bp_transfers
    where business_id=p_business_id and local_transaction_id=p_transaction_id and kind='PAYMENT';
  if not found then raise exception 'Only verified shared BP payments can be refunded'; end if;
  perform pg_advisory_xact_lock(hashtextextended(original.id::text,0));
  select id into refund_id from public.business_customer_bp_transfers where original_id=original.id;
  if found then return refund_id; end if;
  product_code:=original.payload->'context'->>'product_id';
  if product_code is not null then
    quantity_value:=(original.payload->'context'->>'quantity')::integer;
    select * into product from public.products_services where business_id=p_business_id and id::text=product_code for update;
    if not found then raise exception 'Original product was not found for stock restoration'; end if;
  end if;
  -- Original payment UUID is the stable refund request ID.
  refund_id:=public.apply_business_shared_bp(p_business_id,original.customer_id,'REFUND',original.amount,
    original.id,original.id,'{}');
  if product_code is not null then
    update public.products_services set stock=stock+quantity_value where id=product.id and business_id=p_business_id;
    movement.product_id:=product.id::text;
    insert into public.product_inventory_movements(business_id,product_id,movement_type,quantity,note,created_by)
      values(p_business_id,movement.product_id,'RESTOCK',quantity_value,'Shared BP refund '||refund_id::text,auth.uid());
  end if;
  return refund_id;
end; $$;

create or replace function public.purchase_shared_product(p_business_id uuid,p_customer_id text,p_product_id text,p_quantity integer,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$ declare
  product public.products_services%rowtype;
  movement public.product_inventory_movements%rowtype;
  prior public.business_customer_bp_transfers%rowtype;
  transfer_id uuid;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to process purchases' using errcode='42501';
  end if;
  if p_request_id is null or p_quantity is null or p_quantity<1 then raise exception 'Request ID and positive quantity are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into prior from public.business_customer_bp_transfers where request_id=p_request_id;
  if found then
    if prior.business_id<>p_business_id or prior.customer_id is distinct from p_customer_id or prior.kind<>'PAYMENT'
      or prior.payload->'context' is distinct from jsonb_build_object('product_id',p_product_id,'quantity',p_quantity) then
      raise exception 'Request ID already used for different details';
    end if;
    return prior.id;
  end if;
  select * into product from public.products_services where business_id=p_business_id and id::text=p_product_id and status='ACTIVE' for update;
  if not found then raise exception 'Active product was not found'; end if;
  if product.stock<p_quantity then raise exception 'Insufficient stock'; end if;
  transfer_id:=public.apply_business_shared_bp(p_business_id,p_customer_id,'PAYMENT',product.price*p_quantity,
    p_request_id,null,jsonb_build_object('product_id',p_product_id,'quantity',p_quantity));
  update public.products_services set stock=stock-p_quantity where business_id=p_business_id and id=product.id;
  movement.product_id:=product.id::text;
  insert into public.product_inventory_movements(business_id,product_id,movement_type,quantity,note,created_by)
    values(p_business_id,movement.product_id,'ISSUE',p_quantity,'Shared BP purchase '||transfer_id::text,auth.uid());
  return transfer_id;
end; $$;

create or replace function public.start_shared_workstation_session(
  p_business_id uuid,p_workstation_id text,p_customer_id text,p_guest_name text,
  p_payment_method text,p_amount numeric,p_request_id uuid
)
returns uuid language plpgsql security definer set search_path=public
as $$ declare
  station public.workstations%rowtype;
  prior public.workstation_sessions%rowtype;
  session_record public.workstation_sessions%rowtype;
  request_payload jsonb;
  session_id uuid;
  transfer_id uuid;
  local_id uuid;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER']) then
    raise exception 'Not authorized to start a session' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  request_payload:=jsonb_build_object('business',p_business_id,'station',p_workstation_id,'customer',p_customer_id,
    'guest',p_guest_name,'method',p_payment_method,'amount',p_amount);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into prior from public.workstation_sessions where purchase_request_id=p_request_id;
  if found then
    if prior.purchase_payload<>request_payload then raise exception 'Request ID already used for different details'; end if;
    return prior.id;
  end if;
  if p_payment_method='CASH' then
    session_id:=public.purchase_workstation_session(p_business_id,p_workstation_id,p_customer_id,p_guest_name,p_payment_method,p_amount);
  elsif p_payment_method='BUZZPOINTS' then
    -- Keep station locking consistent with start/end session functions.
    select * into station from public.workstations where business_id=p_business_id and id::text=p_workstation_id for update;
    if not found or station.status is distinct from 'ACTIVE' then raise exception 'Workstation is not available'; end if;
    transfer_id:=public.apply_business_shared_bp(p_business_id,p_customer_id,'PAYMENT',p_amount,p_request_id,null,
      jsonb_build_object('workstation_id',p_workstation_id));
    session_id:=public.start_workstation_session(p_business_id,p_workstation_id);
    select local_transaction_id into local_id from public.business_customer_bp_transfers where id=transfer_id;
    session_record.customer_id:=p_customer_id;
    update public.workstation_sessions set customer_id=session_record.customer_id,
      payment_method='BUZZPOINTS',amount_paid=p_amount,transaction_id=local_id where id=session_id;
  else raise exception 'Choose Cash or BuzzPoints'; end if;
  update public.workstation_sessions set purchase_request_id=p_request_id,purchase_payload=request_payload where id=session_id;
  return session_id;
end; $$;

-- Disable obsolete public write entry points; wrappers can still invoke
-- the cash implementation as their definer. Existing balance data stays intact.
revoke execute on function public.purchase_workstation_session(uuid,text,text,text,text,numeric) from authenticated;
revoke execute on function public.load_customer_points(uuid,text,numeric) from authenticated;
revoke execute on function public.record_business_refund(uuid,uuid) from authenticated;
revoke all on function public.apply_business_shared_bp(uuid,text,text,numeric,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.get_business_shared_bp(uuid) from public,anon;
revoke all on function public.load_shared_customer_bp(uuid,text,numeric,uuid) from public,anon;
revoke all on function public.refund_shared_customer_bp(uuid,uuid) from public,anon;
revoke all on function public.start_shared_workstation_session(uuid,text,text,text,text,numeric,uuid) from public,anon;
grant execute on function public.get_business_shared_bp(uuid) to authenticated;
grant execute on function public.load_shared_customer_bp(uuid,text,numeric,uuid) to authenticated;
grant execute on function public.refund_shared_customer_bp(uuid,uuid) to authenticated;
grant execute on function public.start_shared_workstation_session(uuid,text,text,text,text,numeric,uuid) to authenticated;
revoke all on function public.purchase_shared_product(uuid,text,text,integer,uuid) from public,anon;
grant execute on function public.purchase_shared_product(uuid,text,text,integer,uuid) to authenticated;

-- The legacy refund RPC uses buzzpoint_wallets. It must never refund a new
-- transaction funded by customer_bp_wallets, or it could credit a second wallet.
-- Preserve legacy behavior while inserting a narrow source guard into the
-- inspected live definition. An unexpected definition aborts the migration.
do $$
declare
  legacy_oid regprocedure := to_regprocedure('public.refund_customer_transaction(uuid,text)');
  legacy_definition text;
  needle text := 'if v_original.transaction_type <> ''PURCHASE'' then';
begin
  if legacy_oid is not null then
    legacy_definition := pg_get_functiondef(legacy_oid);
    if strpos(legacy_definition,needle)=0 then
      raise exception 'Legacy refund definition differs from the inspected version. Review it before applying shared BP migration';
    end if;
    if strpos(legacy_definition,'Use the shared BP refund flow for this payment')=0 then
      legacy_definition := replace(legacy_definition,needle,
      'if v_original.metadata->>''wallet_source'' = ''customer_bp_wallets'' then
         raise exception ''Use the shared BP refund flow for this payment'';
       end if;
       '||needle);
    execute legacy_definition;
    end if;
  end if;
end;
$$;
notify pgrst,'reload schema';
commit;
