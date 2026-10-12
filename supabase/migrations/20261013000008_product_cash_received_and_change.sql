begin;
-- Cash received is tender; sales use catalog price times quantity. Excess is change.
create or replace function public.checkout_product_purchase(
  p_business_id uuid,p_product_id text,p_quantity integer,p_customer_id text,
  p_guest_name text,p_payment_method text,p_cash_amount numeric,p_request_id uuid
)
returns uuid language plpgsql security definer set search_path=public
as $$
declare
  prior public.product_checkout_requests%rowtype;
  product public.products_services%rowtype;
  customer public.customers%rowtype;
  transaction_record public.business_transactions%rowtype;
  movement public.product_inventory_movements%rowtype;
  payload_value jsonb;
  transfer_id uuid;
  transaction_id_value uuid;
  sale_total numeric;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to process product payments' using errcode='42501';
  end if;
  if p_request_id is null or p_quantity is null or p_quantity<1 then
    raise exception 'Request ID and positive quantity are required';
  end if;
  if p_payment_method is null or p_payment_method not in ('CASH','BUZZPOINTS') then
    raise exception 'Choose Cash or BuzzPoints';
  end if;
  payload_value:=jsonb_build_object('business',p_business_id,'product',p_product_id,
    'quantity',p_quantity,'customer',p_customer_id,'guest',nullif(trim(p_guest_name),''),
    'method',p_payment_method,'cash_amount',p_cash_amount);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into prior from public.product_checkout_requests where request_id=p_request_id;
  if found then
    if prior.payload is distinct from payload_value then
      raise exception 'Request ID already used for different checkout details';
    end if;
    return prior.transaction_id;
  end if;
  -- Do not reuse a previous BP purchase request through a different checkout.
  if exists(select 1 from public.business_customer_bp_transfers where request_id=p_request_id) then
    raise exception 'Request ID already used for another payment';
  end if;
  if not exists(select 1 from public.businesses where id=p_business_id and status='ACTIVE') then
    raise exception 'Business is not active';
  end if;
  if p_customer_id is null then
    if p_payment_method<>'CASH' then raise exception 'Local customers can pay with cash only'; end if;
    if nullif(trim(p_guest_name),'') is null or length(trim(p_guest_name))>160 then
      raise exception 'Enter a local customer name';
    end if;
  else
    select * into customer from public.customers
      where business_id=p_business_id and id::text=p_customer_id and status='ACTIVE' for share;
    if not found or customer.profile_id is null then
      raise exception 'Select an active customer linked to a BuzzTap account';
    end if;
    if not exists(select 1 from public.profiles where id=customer.profile_id
      and role='CUSTOMER' and status='ACTIVE') then
      raise exception 'Customer account is frozen, closed, or inactive';
    end if;
  end if;
  if p_payment_method='BUZZPOINTS' then
    if p_cash_amount is not null then raise exception 'Cash amount is only valid for cash payments'; end if;
    -- The existing checked purchase uses the database price, locks stock and
    -- shared wallets, records the transfer, and preserves the refund flow.
    transfer_id:=public.purchase_shared_product(p_business_id,p_customer_id,p_product_id,p_quantity,p_request_id);
    select local_transaction_id into transaction_id_value
      from public.business_customer_bp_transfers where id=transfer_id;
  else
    if p_cash_amount is null or p_cash_amount::text in ('NaN','Infinity','-Infinity')
      or p_cash_amount<=0 or p_cash_amount<>round(p_cash_amount,2) or p_cash_amount>=1000000000000 then
      raise exception 'Enter a positive cash total with at most two decimal places';
    end if;
    select * into product from public.products_services
      where business_id=p_business_id and id::text=p_product_id and status='ACTIVE'
      and item_type='PRODUCT' for update;
    if not found then raise exception 'Active stock product was not found'; end if;
    if product.stock is null or product.stock<p_quantity then raise exception 'Insufficient product stock'; end if;
    if product.price is null or product.price<0 or product.price::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Set a valid product price';
    end if;
    sale_total:=round(product.price*p_quantity,2);
    if p_cash_amount<sale_total then raise exception 'Insufficient cash received. Total due: %',sale_total; end if;
    transaction_record.customer_id:=p_customer_id;
    insert into public.business_transactions(business_id,customer_id,type,amount,status,metadata,created_by)
      values(p_business_id,transaction_record.customer_id,'CASH_PURCHASE',sale_total,'COMPLETED',
        jsonb_build_object('cash_received',p_cash_amount,'change_due',p_cash_amount-sale_total,'sale_total',sale_total,'payment_method','CASH','product_id',p_product_id,'quantity',p_quantity,
          'guest_name',case when p_customer_id is null then trim(p_guest_name) else null end,
          'profile_id',customer.profile_id,'catalog_price_bp',product.price,'request_id',p_request_id),auth.uid())
      returning id into transaction_id_value;
    update public.products_services set stock=stock-p_quantity where id=product.id and business_id=p_business_id;
    movement.product_id:=product.id::text;
    insert into public.product_inventory_movements(business_id,product_id,movement_type,quantity,note,created_by)
      values(p_business_id,movement.product_id,'ISSUE',p_quantity,
        'Cash product purchase '||transaction_id_value::text,auth.uid());
  end if;
  insert into public.product_checkout_requests(request_id,business_id,payload,transaction_id)
    values(p_request_id,p_business_id,payload_value,transaction_id_value);
  return transaction_id_value;
end;
$$;
revoke all on function public.checkout_product_purchase(uuid,text,integer,text,text,text,numeric,uuid) from public,anon;
grant execute on function public.checkout_product_purchase(uuid,text,integer,text,text,text,numeric,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
