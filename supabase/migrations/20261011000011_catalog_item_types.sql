-- Existing catalog entries retain PRODUCT until explicitly classified in the UI.
-- Preserve old stock and history; services/workstations never use inventory actions.
begin;
alter table public.products_services
  add column if not exists item_type text not null default 'PRODUCT'
  check (item_type in ('PRODUCT','SERVICE','WORKSTATION'));

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
  select * into product from public.products_services where business_id=p_business_id and id::text=p_product_id and status='ACTIVE' and item_type='PRODUCT' for update;
  if not found then raise exception 'Active stock product was not found'; end if;
  if product.stock<p_quantity then raise exception 'Insufficient stock'; end if;
  transfer_id:=public.apply_business_shared_bp(p_business_id,p_customer_id,'PAYMENT',product.price*p_quantity,
    p_request_id,null,jsonb_build_object('product_id',p_product_id,'quantity',p_quantity));
  update public.products_services set stock=stock-p_quantity where business_id=p_business_id and id=product.id;
  movement.product_id:=product.id::text;
  insert into public.product_inventory_movements(business_id,product_id,movement_type,quantity,note,created_by)
    values(p_business_id,movement.product_id,'ISSUE',p_quantity,'Shared BP purchase '||transfer_id::text,auth.uid());
  return transfer_id;
end; $$;

create or replace function public.issue_product_inventory(
  p_business_id uuid,
  p_product_id text,
  p_quantity integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock integer;
  movement_id uuid;
begin
  if not public.user_has_business_role(
    p_business_id, array['OWNER', 'MANAGER', 'CASHIER', 'STAFF']
  ) then
    raise exception 'Not authorized to issue product inventory'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be greater than zero'
      using errcode = '22023';
  end if;

  select stock into current_stock
  from public.products_services
  where business_id = p_business_id
    and id::text = p_product_id
    and status = 'ACTIVE'
    and item_type = 'PRODUCT'
  for update;

  if not found then
    raise exception 'Active stock product was not found'
      using errcode = 'P0002';
  end if;

  if current_stock < p_quantity then
    raise exception 'Insufficient product stock'
      using errcode = '22023';
  end if;

  update public.products_services
  set stock = stock - p_quantity
  where business_id = p_business_id and id::text = p_product_id;

  insert into public.product_inventory_movements (
    business_id, product_id, movement_type, quantity, note, created_by
  )
  values (
    p_business_id, p_product_id, 'ISSUE', p_quantity,
    nullif(trim(p_note), ''), auth.uid()
  )
  returning id into movement_id;

  return movement_id;
end;
$$;

revoke all on function public.issue_product_inventory(uuid, text, integer, text)
  from public, anon;
grant execute on function public.issue_product_inventory(uuid, text, integer, text)
  to authenticated;

create or replace function public.restock_product_inventory(
  p_business_id uuid,
  p_product_id text,
  p_quantity integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  movement_id uuid;
begin
  if not public.user_has_business_role(
    p_business_id, array['OWNER', 'MANAGER']
  ) then
    raise exception 'Only a business owner or manager can restock inventory'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Restock quantity must be greater than zero'
      using errcode = '22023';
  end if;

  update public.products_services
  set stock = stock + p_quantity
  where business_id = p_business_id
    and id::text = p_product_id
    and status = 'ACTIVE'
    and item_type = 'PRODUCT';

  if not found then
    raise exception 'Active stock product was not found'
      using errcode = 'P0002';
  end if;

  insert into public.product_inventory_movements (
    business_id, product_id, movement_type, quantity, note, created_by
  )
  values (
    p_business_id, p_product_id, 'RESTOCK', p_quantity,
    nullif(trim(p_note), ''), auth.uid()
  )
  returning id into movement_id;

  return movement_id;
end;
$$;

revoke all on function public.restock_product_inventory(uuid, text, integer, text)
  from public, anon;
grant execute on function public.restock_product_inventory(uuid, text, integer, text)
  to authenticated;


-- Preserve existing authenticated permissions on replaced functions.
notify pgrst,'reload schema';
commit;
