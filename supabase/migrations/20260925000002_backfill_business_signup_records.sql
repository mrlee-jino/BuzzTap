-- Backfill users who signed up before the business signup trigger was installed.
-- This only uses signup metadata and skips users that already have a profile.
do $$
declare
  auth_user record;
  business_id uuid;
  signup_data jsonb;
begin
  for auth_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    where not exists (
      select 1
      from public.profiles p
      where p.id = u.id
    )
  loop
    signup_data := coalesce(auth_user.raw_user_meta_data, '{}'::jsonb);

    if nullif(trim(signup_data ->> 'business_name'), '') is null
      or nullif(trim(signup_data ->> 'business_type'), '') is null
      or nullif(trim(signup_data ->> 'phone'), '') is null
      or nullif(trim(signup_data ->> 'address'), '') is null then
      continue;
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
      auth_user.id,
      nullif(trim(signup_data ->> 'business_name'), ''),
      '',
      auth_user.email,
      nullif(trim(signup_data ->> 'phone'), ''),
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
      nullif(trim(signup_data ->> 'business_name'), ''),
      nullif(trim(signup_data ->> 'business_type'), ''),
      auth_user.email,
      nullif(trim(signup_data ->> 'phone'), ''),
      nullif(trim(signup_data ->> 'address'), ''),
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
      auth_user.id,
      'OWNER',
      'ACTIVE',
      'ACCEPTED'
    );
  end loop;
end $$;
