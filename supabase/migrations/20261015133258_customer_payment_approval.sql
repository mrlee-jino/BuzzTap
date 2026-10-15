-- Requires migrations through 20261013000014. Deploy with the customer app.
begin;
create schema if not exists payment_private;
revoke all on schema payment_private from public,anon;
grant usage on schema payment_private to authenticated;

create table public.customer_payment_requests (
 id uuid primary key,
 business_id uuid not null references public.businesses(id),
 customer_id text not null,
 profile_id uuid not null references public.profiles(id),
 created_by uuid not null references auth.users(id),
 kind text not null check(kind in ('PRODUCT','WORKSTATION')),
 payment_method text not null check(payment_method in ('BUZZPOINTS','CUSTOMIZED')),
 amount bigint not null check(amount>0 and amount<=9007199254740991),
 business_name text not null, item_name text not null,
 product_id text, quantity integer, unit_price numeric,
 workstation_id text, hourly_rate numeric, duration_seconds bigint,
 input_payload jsonb not null,
 state text not null default 'PENDING' check(state in ('PENDING','APPROVED','DECLINED','CANCELLED','CAPTURED')),
 consent_version text not null default 'payment-v1',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '5 minutes'),
 approved_at timestamptz, approved_by uuid references auth.users(id),
 captured_at timestamptz, transaction_id uuid unique references public.business_transactions(id),
 session_id uuid,
 check((kind='PRODUCT' and product_id is not null and quantity is not null and quantity>0 and unit_price is not null and unit_price>0 and workstation_id is null)
    or (kind='WORKSTATION' and workstation_id is not null and hourly_rate is not null and hourly_rate>0 and duration_seconds is not null and duration_seconds>0 and product_id is null)),
 check(state not in ('APPROVED','CAPTURED') or (approved_at is not null and approved_by is not null and approved_by=profile_id)),
 check(state<>'CAPTURED' or (transaction_id is not null and captured_at is not null))
);
create index payment_customer_inbox on public.customer_payment_requests(profile_id,created_at desc);
create index payment_business_inbox on public.customer_payment_requests(business_id,created_at desc);
create index payment_operator_rate on public.customer_payment_requests(created_by,created_at desc);
create table public.customer_payment_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.customer_payment_requests(id),
 event_type text not null,
 actor_id uuid references auth.users(id),
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index payment_events_request on public.customer_payment_events(request_id,created_at);
create table public.customer_payment_disputes (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.customer_payment_requests(id),
 profile_id uuid not null references public.profiles(id),
 business_id uuid not null references public.businesses(id),
 reason text not null check(length(trim(reason)) between 10 and 2000),
 state text not null default 'OPEN' check(state in ('OPEN','UNDER_REVIEW','RESOLVED','REJECTED')),
 resolution text check(length(resolution)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 resolved_at timestamptz, reviewed_by uuid references auth.users(id)
);
create index payment_disputes_customer on public.customer_payment_disputes(profile_id,created_at desc);
create index payment_disputes_business on public.customer_payment_disputes(business_id,state,created_at desc);
create table public.business_payment_controls (
 business_id uuid primary key references public.businesses(id),
 points_payments_enabled boolean not null default true,
 reason text not null check(length(trim(reason)) between 5 and 1000),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table public.business_payment_control_events (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),
 points_payments_enabled boolean not null,reason text not null,
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index payment_control_history on public.business_payment_control_events(business_id,created_at desc);

alter table public.customer_payment_requests enable row level security;
alter table public.customer_payment_events enable row level security;
alter table public.customer_payment_disputes enable row level security;
alter table public.business_payment_controls enable row level security;
alter table public.business_payment_control_events enable row level security;
revoke all on public.customer_payment_requests,public.customer_payment_events,public.customer_payment_disputes,
 public.business_payment_controls,public.business_payment_control_events from public,anon,authenticated;
grant select on public.customer_payment_requests,public.customer_payment_events,public.customer_payment_disputes,
 public.business_payment_controls,public.business_payment_control_events to authenticated;
create policy payment_participants_read on public.customer_payment_requests for select to authenticated
 using(profile_id=(select auth.uid()) or public.user_is_active_business_member(business_id) or public.is_admin());
create policy payment_events_read on public.customer_payment_events for select to authenticated
 using(exists(select 1 from public.customer_payment_requests r where r.id=request_id
  and (event_type not like 'DISPUTE_%' or r.profile_id=(select auth.uid()) or public.user_has_business_role(r.business_id,array['OWNER','MANAGER']) or public.is_admin())));
create policy payment_disputes_read on public.customer_payment_disputes for select to authenticated
 using(profile_id=(select auth.uid()) or public.user_has_business_role(business_id,array['OWNER','MANAGER']) or public.is_admin());
create policy payment_controls_read on public.business_payment_controls for select to authenticated
 using(public.user_is_active_business_member(business_id) or public.is_admin());
create policy payment_control_events_read on public.business_payment_control_events for select to authenticated using(public.is_admin());

-- Financial records are written through checked RPCs, never browser DML.
revoke insert,update,delete,truncate,references,trigger on public.business_transactions,
 public.business_customer_bp_transfers,public.business_customized_bp_wallets,
 public.business_customized_bp_ledger,public.product_checkout_requests from public,anon,authenticated;
revoke all on public.business_customer_bp_transfers from public,anon,authenticated;
-- Supabase's older default grants included TRUNCATE, which bypasses RLS.
do $$ declare t text; begin
 foreach t in array array['customer_bp_wallets','business_bp_wallets','buzzpoint_wallets','buzzpoint_ledger','transactions','audit_logs'] loop
  if to_regclass('public.'||t) is not null then
   execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from public,anon,authenticated',t);
  end if;
 end loop;
end $$;
-- Legacy provisioning returns wallet rows. A null anonymous uid must never
-- reach its older authorization predicates; preserve signed-in integrations.
do $$ declare f regprocedure; sig text; begin
 foreach sig in array array['public.provision_customer_wallet(uuid)','public.provision_business_wallet(uuid)','public.provision_platform_wallet()'] loop
  f:=to_regprocedure(sig);
  if f is not null then
   execute format('revoke all on function %s from public,anon',f);
   execute format('grant execute on function %s to authenticated',f);
  end if;
 end loop;
end $$;
-- Own shared balance was previously missing from the deployed app's RLS.
create policy customer_own_shared_bp on public.customer_bp_wallets for select to authenticated
 using(customer_id=(select auth.uid()));
grant select on public.customer_bp_wallets to authenticated;
drop policy if exists customized_wallet_read on public.business_customized_bp_wallets;
create policy customized_wallet_read on public.business_customized_bp_wallets for select to authenticated
 using(profile_id=(select auth.uid()) or public.user_has_business_role(business_id,array['OWNER','MANAGER']) or public.is_admin());

-- Preserve account eligibility without disclosing the shared balance.
create or replace function public.get_business_shared_bp(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER','STAFF']) then
   raise exception 'Not authorized' using errcode='42501'; end if;
 return jsonb_build_object('business_balance',coalesce((select balance from public.business_bp_wallets where business_id=p_business_id),0),
  'customers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id::text,'profile_status',p.status))
    from public.customers c left join public.profiles p on p.id=c.profile_id where c.business_id=p_business_id),'[]'::jsonb));
end; $$;
revoke all on function public.get_business_shared_bp(uuid) from public,anon;
grant execute on function public.get_business_shared_bp(uuid) to authenticated;

create function payment_private.request_payment(p_business_id uuid,p_customer_id text,p_kind text,
 p_payment_method text,p_product_id text,p_quantity integer,p_workstation_id text,p_amount numeric,p_request_id uuid)
returns public.customer_payment_requests language plpgsql security definer set search_path='' as $$
declare r public.customer_payment_requests%rowtype; c public.customers%rowtype;
 product public.products_services%rowtype; station public.workstations%rowtype;
 payload jsonb; total numeric; bname text;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and status='ACTIVE')
  or not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER','STAFF'])
  or (p_kind='WORKSTATION' and not public.user_has_business_role(p_business_id,array['OWNER','MANAGER'])) then
  raise exception 'Not authorized to request payment' using errcode='42501'; end if;
 if p_request_id is null or p_kind is null or p_kind not in ('PRODUCT','WORKSTATION')
  or p_payment_method is null or p_payment_method not in ('BUZZPOINTS','CUSTOMIZED') then raise exception 'Invalid payment request'; end if;
 payload:=jsonb_build_object('business',p_business_id,'customer',p_customer_id,'kind',p_kind,'method',p_payment_method,
  'product',p_product_id,'quantity',p_quantity,'station',p_workstation_id,'amount',p_amount);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into r from public.customer_payment_requests where id=p_request_id;
 if found then
  if r.input_payload is distinct from payload or r.created_by<>auth.uid() then raise exception 'Request ID already used for different details'; end if;
  return r;
 end if;
 select name into bname from public.businesses where id=p_business_id and status='ACTIVE' for share;
 if not found then raise exception 'Business is not active'; end if;
 if exists(select 1 from public.business_payment_controls where business_id=p_business_id and not points_payments_enabled) then raise exception 'Points payments are paused for this business'; end if;
 select * into c from public.customers where business_id=p_business_id and id::text=p_customer_id and status='ACTIVE' for share;
 if not found or c.profile_id is null then raise exception 'Select an active linked customer'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payment-rate:'||auth.uid()::text,0));
 -- Serializes per-customer quotas and prevents approval/request races with freezes.
 perform 1 from public.profiles where id=c.profile_id and role='CUSTOMER' and status='ACTIVE' for update;
 if not found then raise exception 'Customer account is not active'; end if;
 if (select count(*) from public.customer_payment_requests where profile_id=c.profile_id and business_id=p_business_id
   and state in ('PENDING','APPROVED') and expires_at>now())>=5
  or (select count(*) from public.customer_payment_requests where created_by=auth.uid() and created_at>now()-interval '1 minute')>=30 then
  raise exception 'Too many payment requests. Wait or cancel an existing request'; end if;
 if exists(select 1 from public.product_checkout_requests where request_id=p_request_id)
  or exists(select 1 from public.business_customer_bp_transfers where request_id=p_request_id)
  or exists(select 1 from public.business_customized_bp_requests where request_id=p_request_id)
  or exists(select 1 from public.workstation_sessions where purchase_request_id=p_request_id) then raise exception 'Request ID already used for a payment'; end if;
 if p_kind='PRODUCT' then
  if p_quantity is null or p_quantity<1 or p_workstation_id is not null or p_amount is not null then raise exception 'Invalid product details'; end if;
  select * into product from public.products_services where business_id=p_business_id and id::text=p_product_id and status='ACTIVE' and item_type='PRODUCT';
  if not found or product.stock<p_quantity then raise exception 'Insufficient active product stock'; end if;
  total:=product.price*p_quantity;
 else
  if p_product_id is not null or p_quantity is not null then raise exception 'Invalid workstation details'; end if;
  select * into station from public.workstations where business_id=p_business_id and id::text=p_workstation_id and status='ACTIVE';
  if not found or station.rate is null or station.rate<=0 or station.rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Workstation unavailable or invalid hourly rate'; end if;
  total:=p_amount;
 end if;
 if total is null or total::text in ('NaN','Infinity','-Infinity') or total<=0 or total<>trunc(total) or total>9007199254740991 then raise exception 'Payment requires a positive whole point amount'; end if;
 insert into public.customer_payment_requests(id,business_id,customer_id,profile_id,created_by,kind,payment_method,amount,
  business_name,item_name,product_id,quantity,unit_price,workstation_id,hourly_rate,duration_seconds,input_payload)
 values(p_request_id,p_business_id,c.id::text,c.profile_id,auth.uid(),p_kind,p_payment_method,total::bigint,bname,
  case when p_kind='PRODUCT' then product.name else station.name end,p_product_id,p_quantity,product.price,p_workstation_id,station.rate,
  case when p_kind='WORKSTATION' then ceil(total/station.rate*3600)::bigint end,payload) returning * into r;
 return r;
end; $$;

create function payment_private.respond_payment(p_request_id uuid,p_approve boolean)
returns public.customer_payment_requests language plpgsql security definer set search_path='' as $$
declare r public.customer_payment_requests%rowtype;
begin
 select * into r from public.customer_payment_requests where id=p_request_id for update;
 if auth.uid() is null or r.profile_id is distinct from auth.uid() then raise exception 'Payment request not found' using errcode='42501'; end if;
 if p_approve is null then raise exception 'Choose approve or decline'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and role='CUSTOMER' and status='ACTIVE') then raise exception 'Customer account is not active'; end if;
 if r.expires_at<=now() then raise exception 'Payment request expired'; end if;
 if r.state=(case when p_approve then 'APPROVED' else 'DECLINED' end) then return r; end if;
 if r.state<>'PENDING' then raise exception 'Payment request is no longer pending'; end if;
 update public.customer_payment_requests set state=case when p_approve then 'APPROVED' else 'DECLINED' end,
  approved_at=case when p_approve then now() end,approved_by=case when p_approve then auth.uid() end
  where id=r.id returning * into r;
 return r;
end; $$;

create function payment_private.cancel_payment(p_request_id uuid)
returns public.customer_payment_requests language plpgsql security definer set search_path='' as $$
declare r public.customer_payment_requests%rowtype;
begin
 select * into r from public.customer_payment_requests where id=p_request_id for update;
 if auth.uid() is null or r.id is null or not (r.profile_id=auth.uid() or public.user_has_business_role(r.business_id,array['OWNER','MANAGER','CASHIER','STAFF'])) then
  raise exception 'Payment request not found' using errcode='42501'; end if;
 if r.state='CANCELLED' then return r; end if;
 if r.state not in ('PENDING','APPROVED') then raise exception 'Payment can no longer be cancelled'; end if;
 update public.customer_payment_requests set state='CANCELLED' where id=r.id returning * into r;
 return r;
end; $$;

-- Keep cash compatibility; all point captures go through capture_payment only.
-- Retire the legacy local-wallet debit branch and fix its ambiguous receipt ID.
create or replace function public.purchase_workstation_session(p_business_id uuid,p_workstation_id text,p_customer_id text,
 p_guest_name text,p_payment_method text,p_amount numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid; tx uuid; sr public.workstation_sessions%rowtype; tr public.business_transactions%rowtype;
begin
 if auth.uid() is null or not public.user_has_business_role(p_business_id,array['OWNER','MANAGER']) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_payment_method is distinct from 'CASH' then raise exception 'Customer approval required'; end if;
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=1000000000000 then raise exception 'Enter a valid positive cash amount'; end if;
 if not exists(select 1 from public.businesses where id=p_business_id and status='ACTIVE') then raise exception 'Business is not active'; end if;
 if p_customer_id is null then
  if nullif(trim(p_guest_name),'') is null or length(trim(p_guest_name))>160 then raise exception 'Enter a guest name'; end if;
 elsif not exists(select 1 from public.customers where business_id=p_business_id and id::text=p_customer_id and status='ACTIVE') then raise exception 'Active customer not found'; end if;
 sid:=public.start_workstation_session(p_business_id,p_workstation_id);
 sr.customer_id:=p_customer_id; tr.customer_id:=p_customer_id; tr.workstation_id:=p_workstation_id;
 insert into public.business_transactions(business_id,customer_id,workstation_id,type,amount,status,metadata,created_by)
 values(p_business_id,tr.customer_id,tr.workstation_id,'CASH_PURCHASE',p_amount,'COMPLETED',
  jsonb_build_object('session_id',sid,'payment_method','CASH','guest_name',case when p_customer_id is null then trim(p_guest_name) end),auth.uid()) returning id into tx;
 update public.workstation_sessions set customer_id=sr.customer_id,guest_name=case when p_customer_id is null then trim(p_guest_name) end,
  payment_method='CASH',amount_paid=p_amount,transaction_id=tx where id=sid;
 return sid;
end; $$;
alter function public.checkout_product_purchase(uuid,text,integer,text,text,text,numeric,uuid) rename to checkout_product_purchase_approved_internal;
alter function public.start_timed_workstation_session(uuid,text,text,text,text,numeric,uuid,integer) rename to start_timed_workstation_session_approved_internal;
create function public.checkout_product_purchase(p_business_id uuid,p_product_id text,p_quantity integer,p_customer_id text,
 p_guest_name text,p_payment_method text,p_cash_amount numeric,p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if p_payment_method is distinct from 'CASH' then raise exception 'Customer approval required. Create a payment request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 if exists(select 1 from public.customer_payment_requests where id=p_request_id) then raise exception 'Request ID belongs to a points payment'; end if;
 return public.checkout_product_purchase_approved_internal(p_business_id,p_product_id,p_quantity,p_customer_id,p_guest_name,p_payment_method,p_cash_amount,p_request_id);
end; $$;
create function public.start_timed_workstation_session(p_business_id uuid,p_workstation_id text,p_customer_id text,p_guest_name text,
 p_payment_method text,p_amount numeric,p_request_id uuid,p_duration_minutes integer)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if p_payment_method is distinct from 'CASH' then raise exception 'Customer approval required. Create a payment request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 if exists(select 1 from public.customer_payment_requests where id=p_request_id) then raise exception 'Request ID belongs to a points payment'; end if;
 return public.start_timed_workstation_session_approved_internal(p_business_id,p_workstation_id,p_customer_id,p_guest_name,p_payment_method,p_amount,p_request_id,p_duration_minutes);
end; $$;

create function payment_private.capture_payment(p_request_id uuid)
returns public.customer_payment_requests language plpgsql security definer set search_path='' as $$
declare r public.customer_payment_requests%rowtype; product public.products_services%rowtype;
 station public.workstations%rowtype; tx uuid; sid uuid;
begin
 select * into r from public.customer_payment_requests where id=p_request_id for update;
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and status='ACTIVE')
  or r.id is null or not public.user_has_business_role(r.business_id,array['OWNER','MANAGER','CASHIER','STAFF'])
  or (r.kind='WORKSTATION' and not public.user_has_business_role(r.business_id,array['OWNER','MANAGER'])) then
  raise exception 'Payment request not found or not authorized' using errcode='42501'; end if;
 -- Lost-response retries return the original result, even after expiry.
 if r.state='CAPTURED' then return r; end if;
 if r.state<>'APPROVED' or r.approved_by is distinct from r.profile_id then raise exception 'Customer approval required'; end if;
 if r.expires_at<=now() then raise exception 'Payment request expired'; end if;
 perform 1 from public.businesses where id=r.business_id and status='ACTIVE' for share;
 if not found then raise exception 'Business is not active'; end if;
 -- Lock the business row in the pause RPC too, so a pause cannot race capture.
 if exists(select 1 from public.business_payment_controls where business_id=r.business_id and not points_payments_enabled) then raise exception 'Points payments are paused for this business'; end if;
 perform 1 from public.customers where business_id=r.business_id and id::text=r.customer_id and profile_id=r.profile_id and status='ACTIVE' for share;
 if not found then raise exception 'Customer registration changed or is inactive'; end if;
 perform 1 from public.profiles where id=r.profile_id and role='CUSTOMER' and status='ACTIVE' for update;
 if not found then raise exception 'Customer account is not active'; end if;
 if r.kind='PRODUCT' then
  select * into product from public.products_services where business_id=r.business_id and id::text=r.product_id for update;
  if not found or product.price is distinct from r.unit_price or product.name is distinct from r.item_name then raise exception 'Product details changed. Request customer approval again'; end if;
  tx:=public.checkout_product_purchase_approved_internal(r.business_id,r.product_id,r.quantity,r.customer_id,null,r.payment_method,null,r.id);
 else
  select * into station from public.workstations where business_id=r.business_id and id::text=r.workstation_id for update;
  if not found or station.rate is distinct from r.hourly_rate or station.name is distinct from r.item_name then raise exception 'Workstation details changed. Request customer approval again'; end if;
  sid:=public.start_timed_workstation_session_approved_internal(r.business_id,r.workstation_id,r.customer_id,null,r.payment_method,r.amount,r.id,null);
  select transaction_id into tx from public.workstation_sessions where id=sid;
 end if;
 if tx is null then raise exception 'Payment receipt missing'; end if;
 update public.business_transactions set metadata=metadata||jsonb_build_object('payment_request_id',r.id,'customer_approved_at',r.approved_at,'consent_version',r.consent_version) where id=tx;
 update public.customer_payment_requests set state='CAPTURED',captured_at=now(),transaction_id=tx,session_id=sid where id=r.id returning * into r;
 return r;
end; $$;

create function payment_private.open_dispute(p_request_id uuid,p_reason text)
returns public.customer_payment_disputes language plpgsql security definer set search_path='' as $$
declare r public.customer_payment_requests%rowtype; d public.customer_payment_disputes%rowtype;
begin
 select * into r from public.customer_payment_requests where id=p_request_id for update;
 if auth.uid() is null or r.profile_id is distinct from auth.uid() or r.state<>'CAPTURED' then raise exception 'Completed payment not found' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 2000 then raise exception 'Enter a reason between 10 and 2000 characters'; end if;
 insert into public.customer_payment_disputes(request_id,profile_id,business_id,reason) values(r.id,r.profile_id,r.business_id,trim(p_reason))
  on conflict(request_id) do nothing;
 select * into d from public.customer_payment_disputes where request_id=r.id;
 return d;
end; $$;
create function payment_private.review_dispute(p_dispute_id uuid,p_state text,p_resolution text)
returns public.customer_payment_disputes language plpgsql security definer set search_path='' as $$
declare d public.customer_payment_disputes%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_state is null or p_state not in ('UNDER_REVIEW','RESOLVED','REJECTED') or p_resolution is null or length(trim(p_resolution)) not between 10 and 2000 then raise exception 'Review state and resolution of 10 to 2000 characters required'; end if;
 select * into d from public.customer_payment_disputes where id=p_dispute_id for update;
 if not found then raise exception 'Dispute not found'; end if;
 if d.state in ('RESOLVED','REJECTED') then
  if d.state=p_state and d.resolution=trim(p_resolution) then return d; end if;
  raise exception 'Dispute already closed'; end if;
 update public.customer_payment_disputes set state=p_state,resolution=trim(p_resolution),reviewed_by=auth.uid(),updated_at=now(),
  resolved_at=case when p_state in ('RESOLVED','REJECTED') then now() end where id=d.id returning * into d;
 return d;
end; $$;
create function payment_private.set_payment_control(p_business_id uuid,p_enabled boolean,p_reason text)
returns public.business_payment_controls language plpgsql security definer set search_path='' as $$
declare c public.business_payment_controls%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_enabled is null or p_reason is null or length(trim(p_reason)) not between 5 and 1000 then raise exception 'Enabled flag and reason required'; end if;
 perform 1 from public.businesses where id=p_business_id for update;
 if not found then raise exception 'Business not found'; end if;
 insert into public.business_payment_controls values(p_business_id,p_enabled,trim(p_reason),auth.uid(),now())
  on conflict(business_id) do update set points_payments_enabled=excluded.points_payments_enabled,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at returning * into c;
 insert into public.business_payment_control_events(business_id,points_payments_enabled,reason,actor_id) values(p_business_id,p_enabled,trim(p_reason),auth.uid());
 return c;
end; $$;

-- Durable customer inbox and immutable evidence. Push delivery is an app backend job.
create function payment_private.audit_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='customer_payment_requests' then
  if tg_op='INSERT' or new.state is distinct from old.state then
   insert into public.customer_payment_events(request_id,event_type,actor_id) values(new.id,new.state,auth.uid());
  end if;
 elsif tg_table_name='customer_payment_disputes' then
  insert into public.customer_payment_events(request_id,event_type,actor_id,details)
   values(new.request_id,'DISPUTE_'||new.state,auth.uid(),jsonb_build_object('dispute_id',new.id,'resolution',new.resolution));
 end if;
 return new;
end; $$;
create trigger payment_request_audit after insert or update on public.customer_payment_requests for each row execute function payment_private.audit_payment();
create trigger payment_dispute_audit after insert or update on public.customer_payment_disputes for each row execute function payment_private.audit_payment();
create function payment_private.audit_refund() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='COMPLETED' and new.type in ('REFUND','CUSTOMIZED_REFUND') then
  insert into public.customer_payment_events(request_id,event_type,actor_id,details)
  select id,'REFUNDED',auth.uid(),jsonb_build_object('transaction_id',new.id,'amount',new.amount)
  from public.customer_payment_requests where transaction_id::text=new.metadata->>'original_transaction_id';
 end if;
 return new;
end; $$;
create trigger approved_payment_refund_audit after insert on public.business_transactions for each row execute function payment_private.audit_refund();

-- Public PostgREST RPCs are invoker wrappers; privileged implementations are private.
create function public.request_customer_payment(p_business_id uuid,p_customer_id text,p_kind text,p_payment_method text,
 p_product_id text,p_quantity integer,p_workstation_id text,p_amount numeric,p_request_id uuid)
returns public.customer_payment_requests language sql security invoker set search_path='' as $$
 select payment_private.request_payment(p_business_id,p_customer_id,p_kind,p_payment_method,p_product_id,p_quantity,p_workstation_id,p_amount,p_request_id); $$;
create function public.respond_customer_payment(p_request_id uuid,p_approve boolean)
returns public.customer_payment_requests language sql security invoker set search_path='' as $$select payment_private.respond_payment(p_request_id,p_approve);$$;
create function public.cancel_customer_payment(p_request_id uuid)
returns public.customer_payment_requests language sql security invoker set search_path='' as $$select payment_private.cancel_payment(p_request_id);$$;
create function public.capture_customer_payment(p_request_id uuid)
returns public.customer_payment_requests language sql security invoker set search_path='' as $$select payment_private.capture_payment(p_request_id);$$;
create function public.open_customer_payment_dispute(p_request_id uuid,p_reason text)
returns public.customer_payment_disputes language sql security invoker set search_path='' as $$select payment_private.open_dispute(p_request_id,p_reason);$$;
create function public.admin_review_payment_dispute(p_dispute_id uuid,p_state text,p_resolution text)
returns public.customer_payment_disputes language sql security invoker set search_path='' as $$select payment_private.review_dispute(p_dispute_id,p_state,p_resolution);$$;
create function public.admin_set_business_points_payments(p_business_id uuid,p_enabled boolean,p_reason text)
returns public.business_payment_controls language sql security invoker set search_path='' as $$select payment_private.set_payment_control(p_business_id,p_enabled,p_reason);$$;

do $$ declare f regprocedure; sig text;
begin
 foreach sig in array array[
 'public.checkout_product_purchase_approved_internal(uuid,text,integer,text,text,text,numeric,uuid)',
 'public.start_timed_workstation_session_approved_internal(uuid,text,text,text,text,numeric,uuid,integer)',
 'public.purchase_shared_product(uuid,text,text,integer,uuid)',
 'public.start_shared_workstation_session(uuid,text,text,text,text,numeric,uuid)',
 'public.checkout_product_purchase_before_rebates(uuid,text,integer,text,text,text,numeric,uuid)',
 'public.start_shared_workstation_session_before_rebates(uuid,text,text,text,text,numeric,uuid)',
 'public.apply_business_shared_bp(uuid,text,text,numeric,uuid,uuid,jsonb)',
 'public.pay_business_customized_bp(uuid,text,numeric,uuid,jsonb)',
 'public.purchase_workstation_session(uuid,text,text,text,text,numeric)',
 'public.start_workstation_session(uuid,text)',
 'public.process_customer_purchase(text,uuid,uuid,uuid,jsonb,text)',
 'public.load_customer_points(uuid,text,numeric)',
 'public.record_business_refund(uuid,uuid)'] loop
  f:=to_regprocedure(sig);
  if f is not null then execute format('revoke all on function %s from public,anon,authenticated',f); end if;
 end loop;
 -- Grant only the deliberately exposed RPC implementations, never trigger funcs.
 foreach sig in array array[
 'payment_private.request_payment(uuid,text,text,text,text,integer,text,numeric,uuid)',
 'payment_private.respond_payment(uuid,boolean)','payment_private.cancel_payment(uuid)','payment_private.capture_payment(uuid)',
 'payment_private.open_dispute(uuid,text)','payment_private.review_dispute(uuid,text,text)',
 'payment_private.set_payment_control(uuid,boolean,text)',
 'public.request_customer_payment(uuid,text,text,text,text,integer,text,numeric,uuid)',
 'public.respond_customer_payment(uuid,boolean)','public.cancel_customer_payment(uuid)','public.capture_customer_payment(uuid)',
 'public.open_customer_payment_dispute(uuid,text)','public.admin_review_payment_dispute(uuid,text,text)',
 'public.admin_set_business_points_payments(uuid,boolean,text)',
 'public.checkout_product_purchase(uuid,text,integer,text,text,text,numeric,uuid)',
 'public.start_timed_workstation_session(uuid,text,text,text,text,numeric,uuid,integer)'] loop
  f:=sig::regprocedure;
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
revoke all on function payment_private.audit_payment(),payment_private.audit_refund() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
