-- Repair UUID/text session comparisons without changing primary keys.
begin;

create or replace function public.start_workstation_session(
  p_business_id uuid,
  p_workstation_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  station public.workstations%rowtype;
  session_record public.workstation_sessions%rowtype;
  new_session_id uuid;
begin
  if not public.user_has_business_role(p_business_id, array['OWNER', 'MANAGER']) then
    raise exception 'Not authorized to start a workstation session'
      using errcode = '42501';
  end if;

  select * into station
  from public.workstations
  where business_id = p_business_id and id::text = p_workstation_id
  for update;

  if not found or station.status <> 'ACTIVE' then
    raise exception 'Workstation is not available'
      using errcode = 'P0001';
  end if;

  update public.workstations
  set status = 'IN_USE'
  where business_id = p_business_id and id = station.id;

  -- Assignment uses the actual session column type (UUID or text).
  session_record.workstation_id := p_workstation_id;

  insert into public.workstation_sessions (
    business_id, workstation_id, operator_id
  )
  values (p_business_id, session_record.workstation_id, auth.uid())
  returning id into new_session_id;

  return new_session_id;
end;
$$;

revoke all on function public.start_workstation_session(uuid, text)
  from public, anon;
grant execute on function public.start_workstation_session(uuid, text)
  to authenticated;

create or replace function public.end_workstation_session(
  p_business_id uuid,
  p_workstation_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.workstation_sessions%rowtype;
  station public.workstations%rowtype;
begin
  if not public.user_has_business_role(p_business_id, array['OWNER', 'MANAGER']) then
    raise exception 'Not authorized to end a workstation session'
      using errcode = '42501';
  end if;

  -- Lock the workstation first, matching the start function's lock order.
  select * into station
  from public.workstations
  where business_id = p_business_id and id::text = p_workstation_id
  for update;

  if not found or station.status <> 'IN_USE' then
    raise exception 'Workstation state is inconsistent'
      using errcode = 'P0001';
  end if;

  select * into active_session
  from public.workstation_sessions
  where business_id = p_business_id
    and workstation_id::text = p_workstation_id
    and status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'No active workstation session was found'
      using errcode = 'P0002';
  end if;

  update public.workstation_sessions
  set status = 'COMPLETED', ended_at = now()
  where id = active_session.id;

  update public.workstations
  set status = 'ACTIVE'
  where business_id = p_business_id
    and id = station.id
    and status = 'IN_USE';

  if not found then
    raise exception 'Workstation state is inconsistent'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.end_workstation_session(uuid, text)
  from public, anon;
grant execute on function public.end_workstation_session(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;

