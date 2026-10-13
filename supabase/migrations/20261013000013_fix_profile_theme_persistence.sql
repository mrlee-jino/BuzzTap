-- Restore the theme-aware RPCs if the original profile migration was applied
-- later or the theme migration was missed. Preserve saved colors for older
-- clients that update other details without sending theme_color.
begin;

create or replace function public.get_public_business_profile(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to view business profiles' using errcode='42501'; end if;
  select jsonb_build_object('business_id',b.id,'display_name',b.name,'business_type',b.business_type,'theme_color','#F5C400')
    || coalesce(p.profile,'{}'::jsonb) into result
    from public.businesses b left join public.business_public_profiles p on p.business_id=b.id
    where b.id=p_business_id and b.status='ACTIVE';
  if result is null then raise exception 'Active business not found'; end if;
  return result;
end;
$$;

create or replace function public.save_public_business_profile(p_business_id uuid,p_profile jsonb)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare cleaned jsonb; field_name text; value text; saved_color text;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER']) then
    raise exception 'Only owners and managers can edit the public profile' using errcode='42501';
  end if;
  if jsonb_typeof(p_profile) is distinct from 'object' then raise exception 'Invalid profile'; end if;
  -- Serializes profile updates without changing the business's account fields.
  perform 1 from public.businesses where id=p_business_id and status='ACTIVE' for update;
  if not found then raise exception 'Active business not found'; end if;
  select profile->>'theme_color' into saved_color from public.business_public_profiles where business_id=p_business_id;
  cleaned:='{}'::jsonb;
  foreach field_name in array array['display_name','business_type','about','logo_url','cover_url','address','phone','email','website','opening_hours','theme_color'] loop
    if p_profile ? field_name and jsonb_typeof(p_profile->field_name) is distinct from 'string' then raise exception 'Profile fields must be text'; end if;
    value:=trim(coalesce(p_profile->>field_name,''));
    if length(value)>(case when field_name='about' then 2000 else 500 end) then raise exception 'Profile field is too long: %',field_name; end if;
    if field_name in ('logo_url','cover_url','website') and value<>'' and value !~* '^https?://[^[:space:]]+$' then raise exception 'Use an http or https URL for %',field_name; end if;
    if field_name='theme_color' then
      if not (p_profile ? 'theme_color') and saved_color ~ '^#[0-9A-Fa-f]{6}$' then value:=saved_color; end if;
      if value='' then value:='#F5C400'; end if;
      if value !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Theme color must be a six-digit hex color'; end if;
      value:=upper(value);
    end if;
    cleaned:=cleaned||jsonb_build_object(field_name,value);
  end loop;
  if cleaned->>'display_name'='' then raise exception 'Business display name is required'; end if;
  insert into public.business_public_profiles(business_id,profile) values(p_business_id,cleaned)
    on conflict(business_id) do update set profile=excluded.profile,updated_at=now();
  return public.get_public_business_profile(p_business_id);
end;
$$;
revoke all on function public.get_public_business_profile(uuid) from public,anon;
revoke all on function public.save_public_business_profile(uuid,jsonb) from public,anon;
grant execute on function public.get_public_business_profile(uuid) to authenticated;
grant execute on function public.save_public_business_profile(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
