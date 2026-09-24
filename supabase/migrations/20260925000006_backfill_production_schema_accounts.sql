-- Repair accounts created before the production-schema signup trigger was fixed.
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
      from public.business_members member
      where member.user_id = u.id
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
      full_name,
      email,
      phone,
      role,
      status
    )
    values (
      auth_user.id,
      nullif(trim(signup_data ->> 'business_name'), ''),
      auth_user.email,
      nullif(trim(signup_data ->> 'phone'), ''),
      'BUSINESS_OWNER',
      'ACTIVE'
    )
    on conflict (id) do update set
      full_name = excluded.full_name,
      email = excluded.email,
      phone = excluded.phone,
      role = excluded.role,
      status = excluded.status;

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
