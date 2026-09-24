-- Fields required by the existing inventory and content workflows.
alter table public.products_services
  add column if not exists stock integer not null default 0;

alter table public.content_items
  add column if not exists archived_at timestamptz;

create index if not exists content_items_business_status_idx
  on public.content_items(business_id, status);
