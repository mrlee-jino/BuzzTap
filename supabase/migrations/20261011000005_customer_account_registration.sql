begin;
alter table public.customers
  add column if not exists profile_id uuid references public.profiles(id),
  add column if not exists customer_code text;
create unique index if not exists customers_business_profile_idx
  on public.customers(business_id, profile_id) where profile_id is not null;
create unique index if not exists customers_business_code_idx
  on public.customers(business_id, customer_code) where customer_code is not null;

-- Only registration staff may search active CUSTOMER profiles. Return only
-- the fields needed to identify and link an account, with bounded results.
create or replace function public.search_customer_accounts(p_business_id uuid, p_search text)
returns table(id uuid, full_name text, email text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER','CASHIER']) then
    raise exception 'Not authorized to register customers' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_search,''))) < 3 then return; end if;
  return query select p.id,p.full_name::text,p.email::text from public.profiles p
    where p.role = 'CUSTOMER' and p.status = 'ACTIVE'
      and (strpos(lower(coalesce(p.full_name,'')),lower(trim(p_search))) > 0
        or strpos(lower(coalesce(p.email,'')),lower(trim(p_search))) > 0)
    order by p.full_name,p.id limit 20;
end;
$$;

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
  if exists(select 1 from public.customers where business_id = p_business_id
    and (lower(email) = lower(customer_email) or (p_profile_id is not null and profile_id = p_profile_id))) then
    raise exception 'This customer is already registered with your business';
  end if;
  -- Separate the optional display code from UUID/text primary keys.
  customer.id := gen_random_uuid()::text;
  insert into public.customers(id,business_id,name,email,status,profile_id,customer_code)
    values(customer.id,p_business_id,customer_name,customer_email,'ACTIVE',p_profile_id,
      coalesce(nullif(trim(p_customer_code),''),'CUS-' || upper(substr(replace(customer.id::text,'-',''),1,12))));

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
revoke all on function public.search_customer_accounts(uuid,text) from public,anon;
revoke all on function public.register_business_customer(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.search_customer_accounts(uuid,text) to authenticated;
grant execute on function public.register_business_customer(uuid,uuid,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
