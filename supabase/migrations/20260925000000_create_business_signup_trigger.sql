-- Create the application records for a newly registered business owner.
-- This runs inside the database so it is not blocked by client-facing RLS.
create or replace function public.handle_new_business_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  business_id uuid;
  signup_data jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  business_name text := nullif(trim(signup_data ->> 'business_name'), '');
  business_type text := nullif(trim(signup_data ->> 'business_type'), '');
  phone text := nullif(trim(signup_data ->> 'phone'), '');
  address text := nullif(trim(signup_data ->> 'address'), '');
begin
  if business_name is null
    or business_type is null
    or phone is null
    or address is null then
    raise exception 'Business signup information is incomplete';
  end if;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    email,
    phone,
    role,
    status
  )
  values (
    new.id,
    business_name,
    '',
    new.email,
    phone,
    'OWNER',
    'ACTIVE'
  );

  insert into public.businesses (
    name,
    business_type,
    email,
    phone,
    address,
    status
  )
  values (
    business_name,
    business_type,
    new.email,
    phone,
    address,
    'ACTIVE'
  )
  returning id into business_id;

  insert into public.business_members (
    business_id,
    user_id,
    role,
    status,
    invitation_status
  )
  values (
    business_id,
    new.id,
    'OWNER',
    'ACTIVE',
    'ACCEPTED'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_business_signup on auth.users;

create trigger on_auth_user_created_business_signup
  after insert on auth.users
  for each row
  execute function public.handle_new_business_signup();

revoke all on function public.handle_new_business_signup() from public;
