-- Supersedes the nullable-card-code decision. Never invent card codes or
-- substitute account UUIDs for physical card identifiers.
begin;

alter table public.nfc_cards add column if not exists card_code text;

do $$
begin
  if exists (select 1 from public.nfc_cards where card_code is null) then
    raise exception 'Cannot require card_code: existing cards have no code'
      using hint = 'Populate NULL card_code values with each card''s real code from NFC inventory, then rerun this migration. Do not use customer profile IDs.';
  end if;
end;
$$;

alter table public.nfc_cards alter column card_code set not null;

create or replace function public.register_customer_with_card_code(
  p_business_id uuid, p_profile_id uuid, p_name text, p_email text,
  p_customer_code text, p_card_code text
)
returns text language plpgsql security definer set search_path = public
as $$
declare
  matched_card public.nfc_cards%rowtype;
  registered_id text;
begin
  if not public.user_has_business_role(p_business_id, array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to register customers' using errcode = '42501';
  end if;

  if p_card_code is not null then
    if nullif(trim(p_card_code), '') is null then
      raise exception 'Enter the real NFC card code';
    end if;
    -- Resolve only cards owned by this business. Never claim another
    -- business's card or create an incomplete card from a typed account ID.
    begin
      select * into strict matched_card from public.nfc_cards
      where business_id = p_business_id and card_code = trim(p_card_code)
      for update;
    exception
      when no_data_found then
        raise exception 'Card code was not found in your business NFC inventory';
      when too_many_rows then
        raise exception 'Multiple cards have this code. Correct the NFC inventory before linking it';
    end;
    if matched_card.customer_id is not null
      or matched_card.status is null
      or matched_card.status not in ('ACTIVE','UNASSIGNED') then
      raise exception 'This card is already linked or unavailable';
    end if;
  end if;

  -- The existing registration function validates the CUSTOMER profile and
  -- creates the business customer; pass no card ID to its old insert path.
  registered_id := public.register_business_customer(
    p_business_id, p_profile_id, p_name, p_email, p_customer_code, null
  );

  if p_card_code is not null then
    -- Assignment respects the live customer_id column type (UUID or text).
    matched_card.customer_id := registered_id;
    update public.nfc_cards
      set customer_id = matched_card.customer_id, status = 'ACTIVE'
      where id = matched_card.id and business_id = p_business_id;
    if not found then raise exception 'NFC card could not be linked'; end if;
  end if;
  return registered_id;
end;
$$;

revoke all on function public.register_customer_with_card_code(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.register_customer_with_card_code(uuid,uuid,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
