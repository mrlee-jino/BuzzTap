begin;

-- Preserve the UUID primary key and NFC linkage; generate the displayed
-- customer code per business and calendar day (UTC+8).
create or replace function public.register_customer_with_card_code(
  p_business_id uuid, p_profile_id uuid, p_name text, p_email text,
  p_customer_code text, p_card_code text
)
returns text language plpgsql security definer set search_path = public
as $$
declare
  linked_profile_id uuid;
  date_prefix text := to_char(current_timestamp at time zone 'Asia/Shanghai', 'YYYYMMDD');
  next_number integer;
  generated_code text;
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

  -- Serialize registrations for a business, including callers with stale
  -- previews. Existing and soft-deleted customers both reserve their codes.
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  select coalesce(max(right(customer_code, 3)::integer), 0) + 1
    into next_number from public.customers
    where business_id = p_business_id
      and customer_code ~ '^[0-9]{11}$'
      and left(customer_code, 8) = date_prefix;
  if next_number > 999 then
    raise exception 'The daily limit of 999 customer IDs has been reached';
  end if;
  generated_code := date_prefix || lpad(next_number::text, 3, '0');
  return public.register_business_customer(
    p_business_id,linked_profile_id,p_name,p_email,generated_code,null
  );
end;
$$;

revoke all on function public.register_customer_with_card_code(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.register_customer_with_card_code(uuid,uuid,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
