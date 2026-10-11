-- Admin-issued NFC cards reference profiles, not business customer records.
-- Registration must preserve the shared card/account link and card ownership.
begin;

create or replace function public.resolve_customer_card_account(p_business_id uuid, p_card_code text)
returns table(id uuid, full_name text, email text, card_code text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to register customers' using errcode = '42501';
  end if;
  if nullif(trim(p_card_code),'') is null then raise exception 'Enter a card code'; end if;
  return query select profile.id,profile.full_name::text,profile.email::text,card.card_code::text
    from public.nfc_cards card
    join public.profiles profile on profile.id = card.customer_id
    where card.card_code = trim(p_card_code) and card.status = 'ACTIVE'
      and profile.role = 'CUSTOMER' and profile.status = 'ACTIVE';
  if not found then
    raise exception 'No active Customer account was found for this active card code';
  end if;
end;
$$;

create or replace function public.register_customer_with_card_code(
  p_business_id uuid, p_profile_id uuid, p_name text, p_email text,
  p_customer_code text, p_card_code text
)
returns text language plpgsql security definer set search_path = public
as $$
declare
  linked_profile_id uuid;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to register customers' using errcode = '42501';
  end if;
  linked_profile_id := p_profile_id;
  if p_card_code is not null then
    if nullif(trim(p_card_code),'') is null then raise exception 'Enter a card code'; end if;
    select profile.id into linked_profile_id
      from public.nfc_cards card
      join public.profiles profile on profile.id = card.customer_id
      where card.card_code = trim(p_card_code) and card.status = 'ACTIVE'
        and profile.role = 'CUSTOMER' and profile.status = 'ACTIVE'
      for share of card,profile;
    if not found then
      raise exception 'No active Customer account was found for this active card code';
    end if;
    if p_profile_id is not null and p_profile_id <> linked_profile_id then
      raise exception 'The card belongs to a different customer. Look up the card again';
    end if;
  end if;
  return public.register_business_customer(
    p_business_id,linked_profile_id,p_name,p_email,p_customer_code,null
  );
end;
$$;

-- Business users can see only active cards for profiles already registered
-- with their business, without broad access to the global NFC inventory.
create or replace function public.get_registered_customer_cards(p_business_id uuid)
returns table(customer_id text,id text,card_code text,status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.user_is_active_business_member(p_business_id) then
    raise exception 'An active business membership is required' using errcode = '42501';
  end if;
  return query select customer.id::text,card.id::text,card.card_code::text,card.status::text
    from public.customers customer
    join public.nfc_cards card on card.customer_id = customer.profile_id
    where customer.business_id = p_business_id and card.status = 'ACTIVE'
    order by card.card_code;
end;
$$;

revoke all on function public.resolve_customer_card_account(uuid,text) from public,anon;
revoke all on function public.register_customer_with_card_code(uuid,uuid,text,text,text,text) from public,anon;
revoke all on function public.get_registered_customer_cards(uuid) from public,anon;
grant execute on function public.resolve_customer_card_account(uuid,text) to authenticated;
grant execute on function public.register_customer_with_card_code(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.get_registered_customer_cards(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
