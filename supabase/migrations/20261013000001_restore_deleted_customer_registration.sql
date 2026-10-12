begin;

-- Re-registration restores the business customer record and its original identifiers.
create or replace function public.register_business_customer(
  p_business_id uuid, p_profile_id uuid, p_name text, p_email text,
  p_customer_code text, p_card_id text
)
returns text language plpgsql security definer set search_path = public
as $$
declare
  account public.profiles%rowtype;
  customer public.customers%rowtype;
  card public.nfc_cards%rowtype;
  customer_name text;
  customer_email text;
  matched_count integer;
  date_prefix text;
  next_number integer;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to register customers' using errcode = '42501';
  end if;
  if p_profile_id is not null then
    select * into account from public.profiles
      where id = p_profile_id and role = 'CUSTOMER' and status = 'ACTIVE' for share;
    if not found then raise exception 'Active Customer account was not found'; end if;
    customer_name := account.full_name;
    customer_email := account.email;
  else
    customer_name := trim(p_name);
    customer_email := trim(p_email);
  end if;
  if nullif(trim(customer_name),'') is null or nullif(trim(customer_email),'') is null then
    raise exception 'Customer name and email are required';
  end if;
  -- Serialize all registration entry points for this business.
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  select count(*) into matched_count from public.customers
    where business_id = p_business_id
      and (lower(trim(email)) = lower(customer_email)
        or (p_profile_id is not null and profile_id = p_profile_id));
  if matched_count > 1 then
    raise exception 'Multiple customer records match this account. Contact your manager';
  end if;
  select * into customer from public.customers
    where business_id = p_business_id
      and (lower(trim(email)) = lower(customer_email)
        or (p_profile_id is not null and profile_id = p_profile_id)) for update;
  if found then
    if customer.status is distinct from 'DELETED' then
      raise exception 'This customer is already registered with your business';
    end if;
    -- An email alone must not restore or take over a linked BuzzTap profile.
    if customer.profile_id is not null and customer.profile_id is distinct from p_profile_id then
      raise exception 'This deleted customer is linked to a BuzzTap account. Register using their BuzzTap NFC card';
    end if;
    update public.customers set status = 'ACTIVE', name = customer_name,
      email = customer_email, profile_id = coalesce(customer.profile_id, p_profile_id)
      where id = customer.id and business_id = p_business_id;
  else
    date_prefix := to_char(current_timestamp at time zone 'Asia/Shanghai', 'YYYYMMDD');
    select coalesce(max(right(customer_code, 3)::integer), 0) + 1
      into next_number from public.customers
      where business_id = p_business_id and customer_code ~ '^[0-9]{11}$'
        and left(customer_code, 8) = date_prefix;
    if next_number > 999 and nullif(trim(p_customer_code), '') is null then
      raise exception 'The daily limit of 999 customer IDs has been reached';
    end if;
    customer.id := gen_random_uuid()::text;
    insert into public.customers(id,business_id,name,email,status,profile_id,customer_code)
      values(customer.id,p_business_id,customer_name,customer_email,'ACTIVE',p_profile_id,
        coalesce(nullif(trim(p_customer_code),''), date_prefix || lpad(next_number::text,3,'0')));
  end if;
  if p_card_id is not null then
    if nullif(trim(p_card_id),'') is null then raise exception 'Enter an NFC card ID'; end if;
    card.id := trim(p_card_id);
    card.customer_id := customer.id::text;
    select * into card from public.nfc_cards where id::text = trim(p_card_id) for update;
    if found then
      if card.business_id is distinct from p_business_id or card.customer_id is not null
        or card.status not in ('ACTIVE','UNASSIGNED') then
        raise exception 'Card is already linked, unavailable, or belongs to another business';
      end if;
      card.customer_id := customer.id::text;
      update public.nfc_cards set customer_id = card.customer_id,status = 'ACTIVE'
        where id = card.id and business_id = p_business_id;
    else
      card.id := trim(p_card_id);
      card.customer_id := customer.id::text;
      insert into public.nfc_cards(id,business_id,customer_id,status)
        values(card.id,p_business_id,card.customer_id,'ACTIVE');
    end if;
  end if;
  return customer.id::text;
end;
$$;

revoke all on function public.register_business_customer(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.register_business_customer(uuid,uuid,text,text,text,text) to authenticated;

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

  -- The registration function restores deleted matches before allocating a new code.
  return public.register_business_customer(
    p_business_id,linked_profile_id,p_name,p_email,null,null
  );
end;
$$;

revoke all on function public.register_customer_with_card_code(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.register_customer_with_card_code(uuid,uuid,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
