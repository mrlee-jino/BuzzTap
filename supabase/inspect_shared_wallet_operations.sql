-- Read-only wallet function and trigger metadata. No balance/customer rows.
-- Run each SELECT separately to copy both results.
select namespace.nspname as schema_name, function.proname as function_name,
       pg_get_function_identity_arguments(function.oid) as arguments,
       pg_get_functiondef(function.oid) as definition
from pg_proc function
join pg_namespace namespace on namespace.oid = function.pronamespace
where namespace.nspname = 'public'
  and function.prokind = 'f'
  and (function.prosrc ilike '%customer_bp_wallets%'
    or function.prosrc ilike '%buzzpoint_wallets%'
    or function.prosrc ilike '%bp_wallet_ledger%'
    or function.prosrc ilike '%costumer_account_balance%'
    or function.prosrc ilike '%business_bp_wallets%'
    or function.proname in ('load_customer_points','purchase_workstation_session',
      'record_business_refund','user_has_business_role','start_workstation_session'))
order by function.proname;

select table_info.relname as table_name, trigger_info.tgname as trigger_name,
       pg_get_triggerdef(trigger_info.oid) as definition
from pg_trigger trigger_info
join pg_class table_info on table_info.oid = trigger_info.tgrelid
join pg_namespace namespace on namespace.oid = table_info.relnamespace
where namespace.nspname = 'public' and not trigger_info.tgisinternal
  and table_info.relname in ('customer_bp_wallets','buzzpoint_wallets',
    'business_bp_wallets','costumer_account_balance','bp_wallet_ledger','wallet_ledger',
    'business_transactions','customers','transactions')
order by table_info.relname,trigger_info.tgname;
