begin;
create table if not exists public.business_rebate_promotions (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 name text not null check(length(trim(name)) between 1 and 120),
 reward_type text not null check(reward_type in ('PERCENT','FIXED')),
 reward_value numeric not null check(reward_value>0 and reward_value<1000000000 and (reward_type<>'PERCENT' or reward_value<=100)),
 minimum_amount numeric not null default 0 check(minimum_amount>=0 and minimum_amount<1000000000),
 maximum_reward bigint check(maximum_reward>0), scope text not null default 'ALL' check(scope in ('ALL','PRODUCT','WORKSTATION')),
 payment_eligibility text not null default 'ALL' check(payment_eligibility in ('ALL','CASH','BUZZPOINTS')),
 starts_at timestamptz not null default now(), ends_at timestamptz,
 active boolean not null default true, created_at timestamptz not null default now(),
 check(ends_at is null or ends_at>starts_at)
);
create table if not exists public.business_customized_bp_wallets (
 business_id uuid not null references public.businesses(id), profile_id uuid not null references public.profiles(id),
 balance bigint not null default 0, updated_at timestamptz not null default now(), primary key(business_id,profile_id)
);
create table if not exists public.business_customized_bp_ledger (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),
 profile_id uuid not null references public.profiles(id),transaction_id uuid not null references public.business_transactions(id),
 kind text not null check(kind in ('EARN','REDEEM','REVERSAL','REFUND')), amount bigint not null check(amount>0),
 promotion_id uuid references public.business_rebate_promotions(id),original_transaction_id uuid,
 created_at timestamptz not null default now(),unique(transaction_id,kind)
);
create unique index if not exists customized_reversal_once on public.business_customized_bp_ledger(original_transaction_id,kind) where kind in ('REVERSAL','REFUND');
create table if not exists public.business_customized_bp_requests (
 request_id uuid primary key,business_id uuid not null, payload jsonb not null,transaction_id uuid not null references public.business_transactions(id)
);
alter table public.business_rebate_promotions enable row level security;
alter table public.business_customized_bp_wallets enable row level security;
alter table public.business_customized_bp_ledger enable row level security;
alter table public.business_customized_bp_requests enable row level security;
revoke all on public.business_rebate_promotions,public.business_customized_bp_wallets,public.business_customized_bp_ledger,public.business_customized_bp_requests from public,anon,authenticated;
grant select,insert,update on public.business_rebate_promotions to authenticated;
grant select on public.business_customized_bp_wallets,public.business_customized_bp_ledger to authenticated;
drop policy if exists rebate_promotions_read on public.business_rebate_promotions;
create policy rebate_promotions_read on public.business_rebate_promotions for select to authenticated using(public.user_is_active_business_member(business_id));
drop policy if exists rebate_promotions_create on public.business_rebate_promotions;
create policy rebate_promotions_create on public.business_rebate_promotions for insert to authenticated with check(public.user_has_business_role(business_id,array['OWNER','MANAGER']));
drop policy if exists rebate_promotions_update on public.business_rebate_promotions;
create policy rebate_promotions_update on public.business_rebate_promotions for update to authenticated using(public.user_has_business_role(business_id,array['OWNER','MANAGER'])) with check(public.user_has_business_role(business_id,array['OWNER','MANAGER']));
drop policy if exists customized_wallet_read on public.business_customized_bp_wallets;
create policy customized_wallet_read on public.business_customized_bp_wallets for select to authenticated using(profile_id=auth.uid() or public.user_is_active_business_member(business_id));
drop policy if exists customized_ledger_read on public.business_customized_bp_ledger;
create policy customized_ledger_read on public.business_customized_bp_ledger for select to authenticated using(profile_id=auth.uid() or public.user_is_active_business_member(business_id));

create or replace function public.apply_business_rebate()
returns trigger language plpgsql security definer set search_path=public as $$
declare promo public.business_rebate_promotions%rowtype; earned public.business_customized_bp_ledger%rowtype;
 pid uuid; reward bigint; method text; sale_scope text;
begin
 if new.status<>'COMPLETED' then return new; end if;
 if new.type in ('REFUND','CASH_REFUND') then
   select * into earned from public.business_customized_bp_ledger where transaction_id=(new.metadata->>'original_transaction_id')::uuid and business_id=new.business_id and kind='EARN' for update;
   if found and not exists(select 1 from public.business_customized_bp_ledger where original_transaction_id=earned.transaction_id and kind='REVERSAL') then
     -- A negative balance represents already-spent rewards being recovered;
     -- future earnings repay it, preventing refund/rebate abuse.
     update public.business_customized_bp_wallets set balance=balance-earned.amount,updated_at=now() where business_id=new.business_id and profile_id=earned.profile_id;
     insert into public.business_customized_bp_ledger(business_id,profile_id,transaction_id,kind,amount,promotion_id,original_transaction_id)
       values(new.business_id,earned.profile_id,new.id,'REVERSAL',earned.amount,earned.promotion_id,earned.transaction_id);
   end if;
   return new;
 end if;
 if new.type not in ('CUSTOMER_PURCHASE','CASH_PURCHASE') or new.customer_id is null then return new; end if;
 select profile_id into pid from public.customers where business_id=new.business_id and id::text=new.customer_id::text and status='ACTIVE';
 if pid is null then return new; end if;
 if not exists(select 1 from public.profiles where id=pid and status='ACTIVE' and role='CUSTOMER') then return new; end if;
 method:=case when new.type='CASH_PURCHASE' then 'CASH' else 'BUZZPOINTS' end;
 sale_scope:=case when new.workstation_id is not null then 'WORKSTATION' else 'PRODUCT' end;
 select * into promo from public.business_rebate_promotions where business_id=new.business_id and active
   and starts_at<=now() and (ends_at is null or ends_at>now()) and minimum_amount<=new.amount
   and scope in ('ALL',sale_scope) and payment_eligibility in ('ALL',method)
   order by created_at desc,id desc limit 1;
 if not found then return new; end if;
 reward:=floor(case when promo.reward_type='PERCENT' then new.amount*promo.reward_value/100 else promo.reward_value end)::bigint;
 if promo.maximum_reward is not null then reward:=least(reward,promo.maximum_reward); end if;
 if reward<1 then return new; end if;
 insert into public.business_customized_bp_wallets(business_id,profile_id,balance) values(new.business_id,pid,reward)
   on conflict(business_id,profile_id) do update set balance=business_customized_bp_wallets.balance+excluded.balance,updated_at=now();
 insert into public.business_customized_bp_ledger(business_id,profile_id,transaction_id,kind,amount,promotion_id) values(new.business_id,pid,new.id,'EARN',reward,promo.id);
 return new;
end; $$;
revoke all on function public.apply_business_rebate() from public,anon,authenticated;
drop trigger if exists award_business_rebate on public.business_transactions;
create trigger award_business_rebate after insert on public.business_transactions for each row execute function public.apply_business_rebate();

create or replace function public.pay_business_customized_bp(bid uuid,cid text,amount_value numeric,request_value uuid,context_value jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare customer public.customers%rowtype; prior public.business_customized_bp_requests%rowtype; payload_value jsonb; tx uuid; balance_value bigint;
begin
 if not public.user_has_business_role(bid,array['OWNER','MANAGER','CASHIER']) then raise exception 'Not authorized to accept CBP'; end if;
 if request_value is null or amount_value is null or amount_value<=0 or amount_value<>trunc(amount_value) or amount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a positive whole CBP amount'; end if;
 if not exists(select 1 from public.businesses where id=bid and status='ACTIVE') then raise exception 'Business is not active'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_value::text,0));
 payload_value:=jsonb_build_object('customer',cid,'amount',amount_value,'context',context_value,'business',bid);
 select * into prior from public.business_customized_bp_requests where request_id=request_value;
 if found then if prior.payload is distinct from payload_value then raise exception 'Request ID already used for different CBP payment'; end if; return prior.transaction_id; end if;
 if exists(select 1 from public.product_checkout_requests where request_id=request_value) or exists(select 1 from public.business_customer_bp_transfers where request_id=request_value) then raise exception 'Request ID already used for another payment'; end if;
 select * into customer from public.customers where business_id=bid and id::text=cid and status='ACTIVE' for share;
 if not found or customer.profile_id is null or not exists(select 1 from public.profiles where id=customer.profile_id and role='CUSTOMER' and status='ACTIVE') then raise exception 'Select an active linked customer'; end if;
 select balance into balance_value from public.business_customized_bp_wallets where business_id=bid and profile_id=customer.profile_id for update;
 if not found or balance_value<amount_value then raise exception 'Insufficient Customized BuzzPoints at this business'; end if;
 update public.business_customized_bp_wallets set balance=balance-amount_value::bigint,updated_at=now() where business_id=bid and profile_id=customer.profile_id;
 insert into public.business_transactions(business_id,customer_id,workstation_id,type,amount,status,metadata,created_by)
   values(bid,customer.id,context_value->>'workstation_id','CUSTOMIZED_PURCHASE',amount_value,'COMPLETED',context_value||jsonb_build_object('payment_method','CUSTOMIZED','profile_id',customer.profile_id,'request_id',request_value),auth.uid()) returning id into tx;
 insert into public.business_customized_bp_ledger(business_id,profile_id,transaction_id,kind,amount) values(bid,customer.profile_id,tx,'REDEEM',amount_value);
 insert into public.business_customized_bp_requests values(request_value,bid,payload_value,tx);
 return tx;
end; $$;
revoke all on function public.pay_business_customized_bp(uuid,text,numeric,uuid,jsonb) from public,anon,authenticated;

do $$ begin if to_regprocedure('public.checkout_product_purchase_before_rebates(uuid,text,integer,text,text,text,numeric,uuid)') is null then alter function public.checkout_product_purchase(uuid,text,integer,text,text,text,numeric,uuid) rename to checkout_product_purchase_before_rebates; end if; end $$;
revoke all on function public.checkout_product_purchase_before_rebates(uuid,text,integer,text,text,text,numeric,uuid) from public,anon,authenticated;
create or replace function public.checkout_product_purchase(p_business_id uuid,p_product_id text,p_quantity integer,p_customer_id text,p_guest_name text,p_payment_method text,p_cash_amount numeric,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare product public.products_services%rowtype; prior public.business_customized_bp_requests%rowtype; tx uuid; context_value jsonb;
begin
 if p_payment_method is distinct from 'CUSTOMIZED' then
   if exists(select 1 from public.business_customized_bp_requests where request_id=p_request_id) then raise exception 'Request ID already used for a CBP payment'; end if;
   return public.checkout_product_purchase_before_rebates(p_business_id,p_product_id,p_quantity,p_customer_id,p_guest_name,p_payment_method,p_cash_amount,p_request_id); end if;
 if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then raise exception 'Not authorized to accept CBP'; end if;
 if p_request_id is null or p_quantity is null or p_quantity<1 or p_cash_amount is not null or p_customer_id is null then raise exception 'Invalid CBP checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into prior from public.business_customized_bp_requests where request_id=p_request_id;
 if found then
   if prior.business_id<>p_business_id or prior.payload->>'customer' is distinct from p_customer_id or prior.payload->'context'->>'product_id' is distinct from p_product_id or (prior.payload->'context'->>'quantity')::integer<>p_quantity then raise exception 'Request ID already used for different CBP checkout'; end if;
   return prior.transaction_id;
 end if;
 select * into product from public.products_services where business_id=p_business_id and id::text=p_product_id and status='ACTIVE' and item_type='PRODUCT' for update;
 if not found or product.stock<p_quantity then raise exception 'Insufficient active product stock'; end if;
 context_value:=jsonb_build_object('product_id',p_product_id,'quantity',p_quantity,'catalog_price_bp',product.price);
 tx:=public.pay_business_customized_bp(p_business_id,p_customer_id,product.price*p_quantity,p_request_id,context_value);
 update public.products_services set stock=stock-p_quantity where id=product.id and business_id=p_business_id;
 insert into public.product_inventory_movements(business_id,product_id,movement_type,quantity,note,created_by) values(p_business_id,product.id,'ISSUE',p_quantity,'CBP checkout '||tx,auth.uid());
 return tx;
end; $$;
grant execute on function public.checkout_product_purchase(uuid,text,integer,text,text,text,numeric,uuid) to authenticated;
revoke all on function public.checkout_product_purchase(uuid,text,integer,text,text,text,numeric,uuid) from public,anon;

do $$ begin if to_regprocedure('public.start_shared_workstation_session_before_rebates(uuid,text,text,text,text,numeric,uuid)') is null then alter function public.start_shared_workstation_session(uuid,text,text,text,text,numeric,uuid) rename to start_shared_workstation_session_before_rebates; end if; end $$;
revoke all on function public.start_shared_workstation_session_before_rebates(uuid,text,text,text,text,numeric,uuid) from public,anon,authenticated;
create or replace function public.start_shared_workstation_session(p_business_id uuid,p_workstation_id text,p_customer_id text,p_guest_name text,p_payment_method text,p_amount numeric,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; tx uuid; session_record public.workstation_sessions%rowtype;
begin
 if p_payment_method is distinct from 'CUSTOMIZED' then return public.start_shared_workstation_session_before_rebates(p_business_id,p_workstation_id,p_customer_id,p_guest_name,p_payment_method,p_amount,p_request_id); end if;
 if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER']) then raise exception 'Not authorized to start a session'; end if;
 perform 1 from public.workstations where business_id=p_business_id and id::text=p_workstation_id and status='ACTIVE' for update;
 if not found then raise exception 'Workstation is not available'; end if;
 tx:=public.pay_business_customized_bp(p_business_id,p_customer_id,p_amount,p_request_id,jsonb_build_object('workstation_id',p_workstation_id));
 sid:=public.start_workstation_session(p_business_id,p_workstation_id);
 session_record.customer_id:=p_customer_id;
 update public.workstation_sessions set customer_id=session_record.customer_id,payment_method='CUSTOMIZED',amount_paid=p_amount,transaction_id=tx where id=sid;
 return sid;
end; $$;
revoke all on function public.start_shared_workstation_session(uuid,text,text,text,text,numeric,uuid) from public,anon;
revoke all on function public.start_shared_workstation_session(uuid,text,text,text,text,numeric,uuid) from authenticated;

create or replace function public.refund_business_customized_bp(p_business_id uuid,p_transaction_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare original public.business_transactions%rowtype; pid uuid; tx uuid;
begin
 if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then raise exception 'Not authorized to refund CBP'; end if;
 select * into original from public.business_transactions where business_id=p_business_id and id=p_transaction_id and type='CUSTOMIZED_PURCHASE' and status='COMPLETED' for update;
 if not found then raise exception 'CBP purchase not found'; end if;
 select transaction_id into tx from public.business_customized_bp_ledger where original_transaction_id=original.id and kind='REFUND';
 if found then return tx; end if;
 pid:=(original.metadata->>'profile_id')::uuid;
 if original.metadata ? 'product_id' then
   update public.products_services set stock=stock+(original.metadata->>'quantity')::integer where business_id=p_business_id and id::text=original.metadata->>'product_id';
   insert into public.product_inventory_movements(business_id,product_id,movement_type,quantity,note,created_by) values(p_business_id,original.metadata->>'product_id','RESTOCK',(original.metadata->>'quantity')::integer,'CBP refund',auth.uid());
 end if;
 update public.business_customized_bp_wallets set balance=balance+original.amount::bigint,updated_at=now() where business_id=p_business_id and profile_id=pid;
 insert into public.business_transactions(business_id,customer_id,workstation_id,type,amount,status,metadata,created_by) values(p_business_id,original.customer_id,original.workstation_id,'CUSTOMIZED_REFUND',original.amount,'COMPLETED',jsonb_build_object('payment_method','CUSTOMIZED','original_transaction_id',original.id,'profile_id',pid),auth.uid()) returning id into tx;
 insert into public.business_customized_bp_ledger(business_id,profile_id,transaction_id,kind,amount,original_transaction_id) values(p_business_id,pid,tx,'REFUND',original.amount,original.id);
 return tx;
end; $$;
revoke all on function public.refund_business_customized_bp(uuid,uuid) from public,anon;
grant execute on function public.refund_business_customized_bp(uuid,uuid) to authenticated;
create or replace function public.start_timed_workstation_session(
  p_business_id uuid,p_workstation_id text,p_customer_id text,p_guest_name text,
  p_payment_method text,p_amount numeric,p_request_id uuid,p_duration_minutes integer
)
returns uuid language plpgsql security definer set search_path=public
as $$ declare
  station public.workstations%rowtype;
  previous public.workstation_sessions%rowtype;
  session_id uuid;
  purchased_seconds bigint;
  display_name text;
  payload_value jsonb;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER']) then
    raise exception 'Not authorized to start a session' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  payload_value:=jsonb_build_object('business',p_business_id,'station',p_workstation_id,
    'customer',p_customer_id,'guest',p_guest_name,'method',p_payment_method,
    'amount',p_amount,'minutes',p_duration_minutes);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into previous from public.workstation_sessions where purchase_request_id=p_request_id;
  if found and previous.timing_payload is not null then
    if previous.timing_payload<>payload_value then raise exception 'Request ID already used for different session details'; end if;
    return previous.id;
  elsif found then
    raise exception 'This request belongs to an older session without recorded timing';
  end if;
  select * into station from public.workstations
    where business_id=p_business_id and id::text=p_workstation_id for update;
  if not found or station.status is distinct from 'ACTIVE' then raise exception 'Workstation is not available'; end if;
  if p_payment_method in ('BUZZPOINTS','CUSTOMIZED') then
    if station.rate is null or station.rate<=0 or station.rate::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Set a positive hourly BP rate before starting a BP session';
    end if;
    if p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Enter a positive BP amount';
    end if;
    purchased_seconds:=ceil(p_amount/station.rate*3600)::bigint;
  elsif p_payment_method='CASH' then
    if station.rate is null or station.rate<=0 or station.rate::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Set a positive hourly rate before starting a cash session';
    end if;
    if p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity')
      or p_amount<>round(p_amount,2) then
      raise exception 'Enter a positive cash amount with at most two decimal places';
    end if;
    purchased_seconds:=ceil(p_amount/station.rate*3600)::bigint;
  else raise exception 'Choose Cash or BuzzPoints'; end if;
  if p_customer_id is null then display_name:=trim(p_guest_name);
  else select name into display_name from public.customers where business_id=p_business_id and id::text=p_customer_id; end if;
  session_id:=public.start_shared_workstation_session(p_business_id,p_workstation_id,p_customer_id,
    p_guest_name,p_payment_method,p_amount,p_request_id);
  update public.workstation_sessions set customer_name=display_name,hourly_rate=station.rate,
    duration_seconds=purchased_seconds,ends_at=started_at + purchased_seconds*interval '1 second',
    timing_payload=payload_value where id=session_id;
  return session_id;
end; $$;

create or replace function public.capture_customized_rewards_activity()
returns trigger language plpgsql security definer set search_path=public as $$
declare action_value text; actor_label text; old_values jsonb:='{}'; new_values jsonb:='{}'; field_name text;
begin
 if tg_op='UPDATE' and new is not distinct from old then return new; end if;
 select coalesce(nullif(full_name,''),email) into actor_label from public.profiles where id=auth.uid();
 action_value:=case when tg_table_name='business_customized_bp_ledger' then 'CBP_'||(to_jsonb(new)->>'kind')
   when tg_op='INSERT' then 'REBATE_PROMOTION_CREATED' else 'REBATE_PROMOTION_CHANGED' end;
 foreach field_name in array array['name','reward_type','reward_value','minimum_amount','maximum_reward','scope','payment_eligibility','starts_at','ends_at','active','kind','amount','profile_id','transaction_id','promotion_id','original_transaction_id'] loop
   if to_jsonb(new) ? field_name then new_values:=new_values||jsonb_build_object(field_name,to_jsonb(new)->field_name); end if;
   if tg_op='UPDATE' and to_jsonb(old) ? field_name then old_values:=old_values||jsonb_build_object(field_name,to_jsonb(old)->field_name); end if;
 end loop;
 if tg_op='UPDATE' and old_values=new_values then return new; end if;
 insert into public.business_system_logs(business_id,actor_id,actor_name,category,action,source_table,source_id,details)
 values(new.business_id,auth.uid(),coalesce(actor_label,'System'),'FINANCE',action_value,tg_table_name,new.id::text,jsonb_build_object('before',old_values,'after',new_values));
 return new;
end; $$;
revoke all on function public.capture_customized_rewards_activity() from public,anon,authenticated;
drop trigger if exists customized_rewards_audit on public.business_rebate_promotions;
create trigger customized_rewards_audit after insert or update on public.business_rebate_promotions for each row execute function public.capture_customized_rewards_activity();
drop trigger if exists customized_rewards_audit on public.business_customized_bp_ledger;
create trigger customized_rewards_audit after insert on public.business_customized_bp_ledger for each row execute function public.capture_customized_rewards_activity();
create or replace view public.business_important_system_logs with (security_invoker=true) as
select * from public.business_system_logs where source_table in ('business_rebate_promotions','business_customized_bp_ledger')
 or public.is_important_business_activity(source_table,
 case when source_table='content_items' and action like 'POST_%' then 'INSERT'
 when source_table in ('purchase_requests','settlement_requests') and action like '%PURCHASE_%' then 'INSERT'
 when source_table='settlement_requests' and action like 'SETTLEMENT_%' then 'INSERT' else action end,details);

revoke all on public.business_important_system_logs from public,anon;
grant select on public.business_important_system_logs to authenticated;
notify pgrst,'reload schema';
commit;
