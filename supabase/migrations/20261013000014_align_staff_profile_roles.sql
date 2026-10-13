-- Correct staff provisioning's historical BUSINESS_OWNER label. Review/apply
-- before deploying login validation and the updated create-staff-account function.
begin;

-- The deployed profiles.role is text. Preserve existing single-column CHECK
-- conditions and extend only that column's allowed values for business staff.
-- This does not alter ADMIN/CUSTOMER values or membership authorization.
do $$
declare role_column smallint; constraint_row record; definition text;
begin
  select attnum into role_column from pg_attribute
  where attrelid='public.profiles'::regclass and attname='role' and not attisdropped;
  if role_column is null then raise exception 'profiles.role column missing'; end if;
  if (select atttypid from pg_attribute where attrelid='public.profiles'::regclass and attnum=role_column) <> 'text'::regtype then
    raise exception 'Expected text profiles.role. Review its deployed type before applying';
  end if;
  for constraint_row in
    select conname,conkey,pg_get_expr(conbin,conrelid) as expression
    from pg_constraint where conrelid='public.profiles'::regclass
      and contype='c' and role_column=any(conkey)
  loop
    if cardinality(constraint_row.conkey)<>1 then
      raise exception 'Role constraint % also validates other columns; review it manually',constraint_row.conname;
    end if;
    definition:=constraint_row.expression;
    if strpos(definition,'MANAGER')>0 and strpos(definition,'CASHIER')>0 and strpos(definition,'STAFF')>0 then continue; end if;
    execute format('alter table public.profiles drop constraint %I',constraint_row.conname);
    execute format('alter table public.profiles add constraint %I check ((%s) or role in (''MANAGER'',''CASHIER'',''STAFF''))',constraint_row.conname,definition);
  end loop;
end $$;

-- Do not infer a global role for users with different roles across businesses.
-- Include inactive memberships so a suspended owner is never relabeled STAFF.
with consistent_staff as (
  select user_id,min(role) as role
  from public.business_members
  group by user_id
  having count(distinct role)=1
     and bool_and(role is not null and role in ('MANAGER','CASHIER','STAFF'))
)
update public.profiles p
set role=member.role,updated_at=now()
from consistent_staff member
where p.id=member.user_id and p.role='BUSINESS_OWNER';

notify pgrst,'reload schema';
commit;
