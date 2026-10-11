-- Read-only diagnostics for Admin-issued NFC card/account relationships.
-- Returns schema metadata only; no passwords or customer personal data.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (table_name in ('nfc_cards', 'customers', 'profiles')
    or table_name like 'customer_account%'
    or table_name like 'costumer_account%')
order by table_name, ordinal_position;

select source.relname as source_table,
       constraint_info.conname as constraint_name,
       pg_get_constraintdef(constraint_info.oid) as definition
from pg_constraint constraint_info
join pg_class source on source.oid = constraint_info.conrelid
join pg_namespace namespace on namespace.oid = source.relnamespace
where namespace.nspname = 'public'
  and source.relname in ('nfc_cards', 'customers')
order by source.relname, constraint_info.conname;
