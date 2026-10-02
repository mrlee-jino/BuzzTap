-- Return only published feed fields and the related business display name.
-- This keeps business profile details protected by the businesses table RLS.
create or replace function public.get_published_business_content()
returns table (
  id uuid,
  business_id uuid,
  content_id text,
  title text,
  content text,
  description text,
  type text,
  start_date date,
  end_date date,
  media_url text,
  call_to_action text,
  status text,
  created_at timestamptz,
  business_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.business_members member
    where member.user_id = auth.uid()
      and member.status = 'ACTIVE'
  ) then
    raise exception 'An active business membership is required to read the community feed'
      using errcode = '42501';
  end if;

  return query
    select
      item.id,
      item.business_id,
      item.content_id,
      item.title,
      item.content,
      item.description,
      item.type,
      item.start_date,
      item.end_date,
      item.media_url,
      item.call_to_action,
      item.status,
      item.created_at,
      business.name
    from public.content_items item
    join public.businesses business on business.id = item.business_id
    where item.status = 'PUBLISHED'
    order by item.created_at desc;
end;
$$;

revoke all on function public.get_published_business_content() from public, anon;
grant execute on function public.get_published_business_content() to authenticated;
