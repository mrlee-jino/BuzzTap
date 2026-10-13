-- STAFF can view the requested business pages and process product checkouts.
-- Catalog/content/station edits, sessions, BP loads and refunds retain their
-- existing role requirements. Apply only after the customized-BP migration.
begin;

do $$
declare source_name text;
begin
  foreach source_name in array array[
    'customers','workstations','wallet_ledger','content_items',
    'purchase_requests','settlement_requests'
  ] loop
    execute format('grant select on public.%I to authenticated',source_name);
    execute format('drop policy if exists staff_page_read on public.%I',source_name);
    execute format(
      'create policy staff_page_read on public.%I for select to authenticated using (public.user_has_business_role(business_id,array[''STAFF'']))',source_name
    );
  end loop;
end $$;

-- Change only the specific authorization predicates in existing definitions.
-- Preserve the deployed financial implementation and its grants. Refuse an
-- unexpected definition instead of silently replacing payment behavior.
do $$
declare
  signature text;
  definition text;
  predicate text;
  expanded text;
  function_id regprocedure;
begin
  foreach signature in array array[
    'public.get_business_shared_bp(uuid)',
    'public.purchase_shared_product(uuid,text,text,integer,uuid)',
    'public.checkout_product_purchase_before_rebates(uuid,text,integer,text,text,text,numeric,uuid)',
    'public.checkout_product_purchase(uuid,text,integer,text,text,text,numeric,uuid)',
    'public.apply_business_shared_bp(uuid,text,text,numeric,uuid,uuid,jsonb)',
    'public.pay_business_customized_bp(uuid,text,numeric,uuid,jsonb)'
  ] loop
    function_id:=to_regprocedure(signature);
    if function_id is null then raise exception 'Required function missing: %',signature; end if;
    select pg_get_functiondef(function_id) into definition;
    if signature='public.pay_business_customized_bp(uuid,text,numeric,uuid,jsonb)' then
      predicate:='public.user_has_business_role(bid,array[''OWNER'',''MANAGER'',''CASHIER''])';
      expanded:='(public.user_has_business_role(bid,array[''OWNER'',''MANAGER'',''CASHIER'']) or public.user_has_business_role(bid,array[''STAFF'']))';
    else
      predicate:='public.user_has_business_role(p_business_id,array[''OWNER'',''MANAGER'',''CASHIER''])';
      if signature='public.apply_business_shared_bp(uuid,text,text,numeric,uuid,uuid,jsonb)' then
        -- This primitive is also used by load/refund RPCs. STAFF may pay only.
        expanded:='(public.user_has_business_role(p_business_id,array[''OWNER'',''MANAGER'',''CASHIER'']) or (p_kind=''PAYMENT'' and public.user_has_business_role(p_business_id,array[''STAFF''])))';
      else
        expanded:='(public.user_has_business_role(p_business_id,array[''OWNER'',''MANAGER'',''CASHIER'']) or public.user_has_business_role(p_business_id,array[''STAFF'']))';
      end if;
    end if;
    if strpos(definition,expanded)>0 then continue; end if;
    if strpos(definition,predicate)=0 then
      raise exception 'Authorization definition differs for %. Review before applying staff access',signature;
    end if;
    execute replace(definition,predicate,expanded);
  end loop;
end $$;

-- The card lookup used by checkout must not resolve unrelated global profiles
-- for STAFF. Owners/managers/cashiers retain the existing registration lookup.
create or replace function public.resolve_customer_card_account(p_business_id uuid,p_card_code text)
returns table(id uuid,full_name text,email text,card_code text)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER','STAFF']) then
    raise exception 'Not authorized to look up customer cards' using errcode='42501';
  end if;
  if nullif(trim(p_card_code),'') is null then raise exception 'Enter a card code'; end if;
  return query select profile.id,profile.full_name::text,profile.email::text,card.card_code::text
    from public.nfc_cards card join public.profiles profile on profile.id::text=card.customer_id::text
    where card.card_code=trim(p_card_code) and card.status='ACTIVE'
      and profile.role='CUSTOMER' and profile.status='ACTIVE'
      and (public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER'])
        or exists(select 1 from public.customers customer where customer.business_id=p_business_id
          and customer.profile_id=profile.id and customer.status='ACTIVE'));
  if not found then raise exception 'No active registered Customer account was found for this active card code'; end if;
end;
$$;
revoke all on function public.resolve_customer_card_account(uuid,text) from public,anon;
grant execute on function public.resolve_customer_card_account(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
