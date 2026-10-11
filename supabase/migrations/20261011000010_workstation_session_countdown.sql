begin;
alter table public.workstation_sessions
  add column if not exists customer_name text,
  add column if not exists hourly_rate numeric,
  add column if not exists duration_seconds bigint,
  add column if not exists ends_at timestamptz,
  add column if not exists timing_payload jsonb;

create or replace function public.start_timed_workstation_session(
  p_business_id uuid,p_workstation_id text,p_customer_id text,p_guest_name text,
  p_payment_method text,p_amount numeric,p_request_id uuid,p_duration_minutes integer
)
returns uuid language plpgsql security definer set search_path=public
as $$ declare
  station public.workstations%rowtype;
  previous public.workstation_sessions%rowtype;
  session_id uuid;
  purchased_seconds bigint;
  display_name text;
  payload_value jsonb;
begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER']) then
    raise exception 'Not authorized to start a session' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  payload_value:=jsonb_build_object('business',p_business_id,'station',p_workstation_id,
    'customer',p_customer_id,'guest',p_guest_name,'method',p_payment_method,
    'amount',p_amount,'minutes',p_duration_minutes);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into previous from public.workstation_sessions where purchase_request_id=p_request_id;
  if found and previous.timing_payload is not null then
    if previous.timing_payload<>payload_value then raise exception 'Request ID already used for different session details'; end if;
    return previous.id;
  elsif found then
    raise exception 'This request belongs to an older session without recorded timing';
  end if;
  select * into station from public.workstations
    where business_id=p_business_id and id::text=p_workstation_id for update;
  if not found or station.status is distinct from 'ACTIVE' then raise exception 'Workstation is not available'; end if;
  if p_payment_method='BUZZPOINTS' then
    if station.rate is null or station.rate<=0 or station.rate::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Set a positive hourly BP rate before starting a BP session';
    end if;
    if p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Enter a positive BP amount';
    end if;
    purchased_seconds:=ceil(p_amount/station.rate*3600)::bigint;
  elsif p_payment_method='CASH' then
    if p_duration_minutes is null or p_duration_minutes<1 then raise exception 'Enter the purchased cash session time in minutes'; end if;
    purchased_seconds:=p_duration_minutes::bigint*60;
  else raise exception 'Choose Cash or BuzzPoints'; end if;
  if p_customer_id is null then display_name:=trim(p_guest_name);
  else select name into display_name from public.customers where business_id=p_business_id and id::text=p_customer_id; end if;
  session_id:=public.start_shared_workstation_session(p_business_id,p_workstation_id,p_customer_id,
    p_guest_name,p_payment_method,p_amount,p_request_id);
  update public.workstation_sessions set customer_name=display_name,hourly_rate=station.rate,
    duration_seconds=purchased_seconds,ends_at=started_at + purchased_seconds*interval '1 second',
    timing_payload=payload_value where id=session_id;
  return session_id;
end; $$;
revoke all on function public.start_timed_workstation_session(uuid,text,text,text,text,numeric,uuid,integer) from public,anon;
grant execute on function public.start_timed_workstation_session(uuid,text,text,text,text,numeric,uuid,integer) to authenticated;
-- Old sessions deliberately retain NULL timing rather than guessing their
-- purchased duration or cash/BP conversion. New sessions save the rate snapshot.
notify pgrst,'reload schema';
commit;
