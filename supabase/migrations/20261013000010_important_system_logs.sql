begin;
create or replace function public.is_important_business_activity(source_name text,event_name text,event_details jsonb)
returns boolean language sql immutable set search_path=public
as $$
  select case
    when source_name='business_access_logs' then event_name in ('LOGIN','LOGOUT')
    when source_name='product_inventory_movements' then event_name in ('RESTOCK','ISSUE')
    when source_name='business_transactions' then event_details->'after'->>'status'='COMPLETED'
      and (event_name='INSERT' or event_details->'before'->>'status' is distinct from 'COMPLETED' or event_name in ('CHECKOUT','REFUND','CUSTOMER_LOAD'))
    when source_name in ('purchase_requests','settlement_requests') then event_name='INSERT'
      or event_details->'before'->>'status' is distinct from event_details->'after'->>'status'
    when source_name='content_items' then event_details->'after'->>'status' in ('SUBMITTED','PENDING','PENDING_REVIEW','PUBLISHED','REJECTED','ARCHIVED')
      and (event_name='INSERT' or event_details->'before'->>'status' is distinct from event_details->'after'->>'status')
    when source_name in ('customers','business_members') then event_name in ('INSERT','DELETE')
      or event_details->'before'->>'status' is distinct from event_details->'after'->>'status'
      or event_details->'before'->>'role' is distinct from event_details->'after'->>'role'
    when source_name='products_services' then event_name in ('INSERT','DELETE')
      or event_details->'before'->>'status' is distinct from event_details->'after'->>'status'
      or event_details->'before'->>'price' is distinct from event_details->'after'->>'price'
      or event_details->'before'->>'item_type' is distinct from event_details->'after'->>'item_type'
    when source_name='workstation_sessions' then event_details->'after'->>'status'='COMPLETED'
      and event_details->'before'->>'status' is distinct from 'COMPLETED'
    else false end;
$$;
revoke all on function public.is_important_business_activity(text,text,jsonb) from public,anon;
grant execute on function public.is_important_business_activity(text,text,jsonb) to authenticated;
create or replace function public.capture_business_system_activity()
returns trigger language plpgsql security definer set search_path=public
as $$
declare row_data jsonb; previous_data jsonb; bid uuid; actor uuid; actor_label text;
  category_value text; action_value text; before_values jsonb:='{}'; after_values jsonb:='{}'; field_name text;
begin
  if tg_op='UPDATE' and new is not distinct from old then return new; end if;
  row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous_data:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  bid:=case when tg_table_name='businesses' then (row_data->>'id')::uuid else (row_data->>'business_id')::uuid end;
  if bid is null or not exists(select 1 from public.businesses where id=bid) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  actor:=coalesce(auth.uid(),case when tg_table_name='business_access_logs' then (row_data->>'user_id')::uuid end);
  select coalesce(nullif(full_name,''),email) into actor_label from public.profiles where id=actor;
  category_value:=case tg_table_name
    when 'business_access_logs' then 'ACCESS'
    when 'product_inventory_movements' then 'INVENTORY'
    when 'products_services' then 'CATALOG'
    when 'customers' then 'CUSTOMERS'
    when 'workstations' then 'WORKSTATIONS'
    when 'workstation_sessions' then 'WORKSTATIONS'
    when 'content_items' then 'CONTENT'
    when 'business_members' then 'TEAM'
    when 'business_transactions' then 'FINANCE'
    when 'purchase_requests' then 'FINANCE'
    when 'settlement_requests' then 'FINANCE'
    else 'BUSINESS' end;
  action_value:=case when tg_table_name='business_access_logs' then row_data->>'event'
    when tg_table_name='product_inventory_movements' then coalesce(row_data->>'movement_type',tg_op)
    else tg_op end;
  -- Whitelist audit fields: never copy passwords, tokens, contact details or full profiles.
  foreach field_name in array array['name','title','type','status','role','stock','price','rate','item_type','movement_type','quantity','product_id','customer_id','workstation_id','payment_method','amount','amount_paid','duration_seconds','deleted_at'] loop
    if row_data ? field_name then after_values:=after_values||jsonb_build_object(field_name,row_data->field_name); end if;
    if previous_data ? field_name then before_values:=before_values||jsonb_build_object(field_name,previous_data->field_name); end if;
  end loop;
  if not coalesce(public.is_important_business_activity(tg_table_name,action_value,jsonb_build_object('before',before_values,'after',after_values)),false) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  if tg_table_name='business_transactions' then
    action_value:=case row_data->>'type' when 'REFUND' then 'REFUND' when 'CASH_REFUND' then 'REFUND'
      when 'CASH_PURCHASE' then 'CHECKOUT' when 'CUSTOMER_PURCHASE' then 'CHECKOUT' else coalesce(row_data->>'type',action_value) end;
  elsif tg_table_name='content_items' then action_value:='POST_'||(row_data->>'status');
  elsif tg_table_name='purchase_requests' then action_value:='BP_PURCHASE_'||coalesce(row_data->>'status','REQUESTED');
  elsif tg_table_name='settlement_requests' then action_value:='SETTLEMENT_'||coalesce(row_data->>'status','REQUESTED'); end if;
  insert into public.business_system_logs(business_id,actor_id,actor_name,category,action,source_table,source_id,details)
    values(bid,actor,coalesce(actor_label,'System'),category_value,action_value,tg_table_name,
      coalesce(row_data->>'id',row_data->>'business_id'),jsonb_build_object('before',before_values,'after',after_values));
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function public.capture_business_system_activity() from public,anon,authenticated;

-- Hide older routine entries without deleting the recorded audit history.
create or replace view public.business_important_system_logs with (security_invoker=true) as
select * from public.business_system_logs
where public.is_important_business_activity(source_table,
  case when source_table='content_items' and action like 'POST_%' then 'INSERT'
    when source_table in ('purchase_requests','settlement_requests') and action like '%PURCHASE_%' then 'INSERT'
    when source_table='settlement_requests' and action like 'SETTLEMENT_%' then 'INSERT'
    else action end,details);
revoke all on public.business_important_system_logs from public,anon;
grant select on public.business_important_system_logs to authenticated;
notify pgrst,'reload schema';
commit;