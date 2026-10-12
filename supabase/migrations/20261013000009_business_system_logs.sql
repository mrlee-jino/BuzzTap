begin;
create table if not exists public.business_system_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid,
  actor_name text not null default 'System',
  category text not null,
  action text not null,
  source_table text not null,
  source_id text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists business_system_logs_time_idx on public.business_system_logs(business_id,occurred_at desc);
alter table public.business_system_logs enable row level security;
revoke all on public.business_system_logs from public,anon,authenticated;
grant select on public.business_system_logs to authenticated;
drop policy if exists business_system_logs_read on public.business_system_logs;
create policy business_system_logs_read on public.business_system_logs for select to authenticated
  using(public.user_has_business_role(business_id,array['OWNER','MANAGER']));

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
  foreach field_name in array array['name','title','status','role','stock','price','rate','item_type','movement_type','quantity','product_id','customer_id','workstation_id','payment_method','amount','amount_paid','duration_seconds','deleted_at'] loop
    if row_data ? field_name then after_values:=after_values||jsonb_build_object(field_name,row_data->field_name); end if;
    if previous_data ? field_name then before_values:=before_values||jsonb_build_object(field_name,previous_data->field_name); end if;
  end loop;
  insert into public.business_system_logs(business_id,actor_id,actor_name,category,action,source_table,source_id,details)
    values(bid,actor,coalesce(actor_label,'System'),category_value,action_value,tg_table_name,
      coalesce(row_data->>'id',row_data->>'business_id'),jsonb_build_object('before',before_values,'after',after_values));
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function public.capture_business_system_activity() from public,anon,authenticated;

do $$ declare table_name text; begin
  foreach table_name in array array['business_access_logs','product_inventory_movements','products_services','customers','workstations','workstation_sessions','content_items','business_members','business_public_profiles','businesses','business_preferences','business_transactions','purchase_requests','settlement_requests'] loop
    if to_regclass('public.'||table_name) is not null then
      execute format('drop trigger if exists capture_business_system_activity on public.%I',table_name);
      execute format('create trigger capture_business_system_activity after insert or update or delete on public.%I for each row execute function public.capture_business_system_activity()',table_name);
    end if;
  end loop;
end $$;

-- Recover existing access and stock movement history without inventing prior changes.
insert into public.business_system_logs(business_id,actor_id,actor_name,category,action,source_table,source_id,occurred_at)
select a.business_id,a.user_id,coalesce(p.full_name,p.email,'Unknown member'),'ACCESS',a.event,'business_access_logs',a.id::text,a.occurred_at
from public.business_access_logs a left join public.profiles p on p.id=a.user_id
where not exists(select 1 from public.business_system_logs l where l.source_table='business_access_logs' and l.source_id=a.id::text);
insert into public.business_system_logs(business_id,actor_id,actor_name,category,action,source_table,source_id,details,occurred_at)
select m.business_id,m.created_by,coalesce(p.full_name,p.email,'Unknown member'),'INVENTORY',m.movement_type,'product_inventory_movements',m.id::text,
  jsonb_build_object('after',jsonb_build_object('product_id',m.product_id,'quantity',m.quantity,'movement_type',m.movement_type)),m.created_at
from public.product_inventory_movements m left join public.profiles p on p.id=m.created_by
where not exists(select 1 from public.business_system_logs l where l.source_table='product_inventory_movements' and l.source_id=m.id::text);
commit;
