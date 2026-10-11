-- Remove items from the catalog while retaining purchase/refund identity
-- and inventory history. Deleted items cannot be made ACTIVE.
begin;
alter table public.products_services add column if not exists deleted_at timestamptz;
do $$ begin
  if not exists(select 1 from pg_constraint
    where conrelid='public.products_services'::regclass and conname='deleted_catalog_item_inactive') then
    alter table public.products_services add constraint deleted_catalog_item_inactive
      check (deleted_at is null or (status is not null and status='INACTIVE'));
  end if;
end; $$;

create or replace function public.delete_catalog_item(p_business_id uuid,p_product_id text)
returns void language plpgsql security definer set search_path=public
as $$ begin
  if not public.user_has_business_role(p_business_id,array['OWNER','MANAGER']) then
    raise exception 'Only a business owner or manager can delete catalog items' using errcode='42501';
  end if;
  update public.products_services
    set status='INACTIVE',deleted_at=coalesce(deleted_at,now())
    where business_id=p_business_id and id::text=p_product_id;
  if not found then raise exception 'Catalog item was not found'; end if;
end; $$;
revoke all on function public.delete_catalog_item(uuid,text) from public,anon;
grant execute on function public.delete_catalog_item(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
