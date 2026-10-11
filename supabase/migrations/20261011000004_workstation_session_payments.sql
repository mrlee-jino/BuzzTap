begin;
alter table public.workstation_sessions
  add column if not exists guest_name text,
  add column if not exists payment_method text,
  add column if not exists amount_paid numeric(14,2),
  add column if not exists transaction_id uuid;

create or replace function public.purchase_workstation_session(
  p_business_id uuid, p_workstation_id text, p_customer_id text,
  p_guest_name text, p_payment_method text, p_amount numeric
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  customer public.customers%rowtype;
  session_record public.workstation_sessions%rowtype;
  transaction_record public.business_transactions%rowtype;
  ledger_record public.wallet_ledger%rowtype;
  session_id uuid;
  transaction_id uuid;
  balance numeric;
  ledger_count bigint;
begin
  if not public.user_has_business_role(p_business_id, array['OWNER','MANAGER']) then
    raise exception 'Not authorized to start a workstation session' using errcode = '42501';
  end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount <= 0
    or p_amount <> round(p_amount, 2) or p_amount >= 1000000000000 then
    raise exception 'Enter a positive amount with at most two decimal places';
  end if;
  if p_payment_method is null or p_payment_method not in ('CASH','BUZZPOINTS') then
    raise exception 'Choose Cash or BuzzPoints';
  end if;
  if p_customer_id is null then
    if nullif(trim(p_guest_name), '') is null or length(trim(p_guest_name)) > 160 then
      raise exception 'Enter a guest name';
    end if;
    if p_payment_method = 'BUZZPOINTS' then
      raise exception 'BuzzPoints requires a registered customer wallet';
    end if;
  else
    select * into customer from public.customers
    where business_id = p_business_id and id::text = p_customer_id and status = 'ACTIVE'
    for update;
    if not found then raise exception 'Active customer was not found'; end if;
  end if;

  -- Starting, payment and wallet debit share one transaction. Any failure
  -- rolls back the station status, session, and payment together.
  session_id := public.start_workstation_session(p_business_id, p_workstation_id);
  session_record.customer_id := p_customer_id;
  transaction_record.customer_id := p_customer_id;
  transaction_record.workstation_id := p_workstation_id;
  ledger_record.customer_id := p_customer_id;

  if p_payment_method = 'BUZZPOINTS' then
    select count(*), coalesce(sum(case when type = 'CUSTOMER_PURCHASE' then -amount else amount end), 0)
      into ledger_count, balance from public.wallet_ledger
      where business_id = p_business_id and customer_id::text = p_customer_id and status = 'COMPLETED';
    if ledger_count = 0 then balance := coalesce(customer.wallet_balance, 0); end if;
    if balance < p_amount then raise exception 'Insufficient BuzzPoints balance'; end if;
    if ledger_count = 0 and balance > 0 then
      insert into public.wallet_ledger (business_id,customer_id,type,amount,status,created_by)
      values (p_business_id,ledger_record.customer_id,'OPENING_BALANCE',balance,'COMPLETED',auth.uid());
    end if;
    insert into public.wallet_ledger (business_id,customer_id,type,amount,status,reference,created_by)
    values (p_business_id,ledger_record.customer_id,'CUSTOMER_PURCHASE',p_amount,'COMPLETED',session_id::text,auth.uid());
    update public.customers set wallet_balance = balance - p_amount
      where business_id = p_business_id and id = customer.id;
  end if;

  insert into public.business_transactions
    (business_id,customer_id,workstation_id,type,amount,status,metadata,created_by)
  values (p_business_id,transaction_record.customer_id,transaction_record.workstation_id,
    case when p_payment_method = 'BUZZPOINTS' then 'CUSTOMER_PURCHASE' else 'CASH_PURCHASE' end,
    p_amount,'COMPLETED',jsonb_build_object('session_id',session_id,'payment_method',p_payment_method,
      'guest_name',case when p_customer_id is null then trim(p_guest_name) else null end),auth.uid())
  returning id into transaction_id;

  update public.workstation_sessions set customer_id = session_record.customer_id,
    guest_name = case when p_customer_id is null then trim(p_guest_name) else null end,
    payment_method = p_payment_method, amount_paid = p_amount,
    transaction_id = purchase_workstation_session.transaction_id
  where id = session_id;
  return session_id;
end;
$$;
revoke all on function public.purchase_workstation_session(uuid,text,text,text,text,numeric) from public,anon;
grant execute on function public.purchase_workstation_session(uuid,text,text,text,text,numeric) to authenticated;
notify pgrst, 'reload schema';
commit;
