-- Business members can read notifications for their active business.
-- The mark-as-read RPC changes only read_at and validates membership itself.

create table if not exists public.business_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists business_notifications_business_created_at_idx
  on public.business_notifications(business_id, created_at desc);

alter table public.business_notifications enable row level security;

drop policy if exists business_notifications_member_read
  on public.business_notifications;
create policy business_notifications_member_read
  on public.business_notifications for select to authenticated
  using (public.user_is_active_business_member(business_id));
grant select on public.business_notifications to authenticated;

create or replace function public.mark_business_notification_read(
  p_notification_id uuid,
  p_business_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or not public.user_is_active_business_member(p_business_id) then
    raise exception 'Not authorized to update this notification'
      using errcode = '42501';
  end if;

  update public.business_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and business_id = p_business_id;

  if not found then
    raise exception 'Notification not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mark_business_notification_read(uuid, uuid)
  from public, anon;
grant execute on function public.mark_business_notification_read(uuid, uuid)
  to authenticated;