-- Read-only schema inspection. No customer balances or personal data.
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema = 'public'
  and (table_name = 'customer_bp_wallets'
    or table_name like '%account_balance%'
    or table_name like '%wallet%')
order by table_name,ordinal_position;

select source.relname as source_table, details.conname as constraint_name,
       pg_get_constraintdef(details.oid) as definition
from pg_constraint details
join pg_class source on source.oid = details.conrelid
join pg_namespace namespace on namespace.oid = source.relnamespace
where namespace.nspname = 'public'
  and (source.relname = 'customer_bp_wallets'
    or source.relname like '%account_balance%'
    or source.relname like '%wallet%')
order by source.relname,details.conname;

select tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname = 'public'
  and (tablename = 'customer_bp_wallets'
    or tablename like '%account_balance%'
    or tablename like '%wallet%')
order by tablename,policyname;
