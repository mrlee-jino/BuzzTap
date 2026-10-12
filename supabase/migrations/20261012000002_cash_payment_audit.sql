begin;

-- Cash payments remain outside both BP wallets. Preserve one permanent
-- audit event per completed cash transaction, including workstation sales.
create unique index if not exists audit_logs_business_cash_payment_idx
  on public.audit_logs(target_type, target_id)
  where action = 'BUSINESS_CASH_PAYMENT';

create or replace function public.audit_business_cash_payment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'COMPLETED'
    and (new.type in ('CASH_PURCHASE','CASH_REFUND')
      or (new.type in ('CUSTOMER_PURCHASE','REFUND') and new.metadata->>'payment_method' = 'CASH')) then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,details)
    values(new.created_by,'BUSINESS_CASH_PAYMENT','BUSINESS_TRANSACTION',new.id,
      jsonb_build_object('business_id',new.business_id,'transaction_id',new.id,
        'type',new.type,'amount',new.amount,'payment_method','CASH',
        'customer_id',new.customer_id,'workstation_id',new.workstation_id,
        'transaction_created_at',new.created_at,'metadata',new.metadata))
    on conflict (target_type,target_id) where action = 'BUSINESS_CASH_PAYMENT' do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.audit_business_cash_payment() from public,anon,authenticated;
drop trigger if exists business_cash_payment_audit on public.business_transactions;
create trigger business_cash_payment_audit
  after insert or update of status on public.business_transactions
  for each row execute function public.audit_business_cash_payment();

-- Backfill prior recorded cash sales without changing cash or BP balances.
insert into public.audit_logs(actor_user_id,action,target_type,target_id,details)
select created_by,'BUSINESS_CASH_PAYMENT','BUSINESS_TRANSACTION',id,
  jsonb_build_object('business_id',business_id,'transaction_id',id,
    'type',type,'amount',amount,'payment_method','CASH','customer_id',customer_id,
    'workstation_id',workstation_id,'transaction_created_at',created_at,
    'metadata',metadata,'backfilled',true)
from public.business_transactions
where status in ('COMPLETED','REFUNDED')
  and (type in ('CASH_PURCHASE','CASH_REFUND')
    or (type in ('CUSTOMER_PURCHASE','REFUND') and metadata->>'payment_method' = 'CASH'))
on conflict (target_type,target_id) where action = 'BUSINESS_CASH_PAYMENT' do nothing;

commit;
