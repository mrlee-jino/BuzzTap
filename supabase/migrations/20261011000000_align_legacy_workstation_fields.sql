-- CREATE TABLE IF NOT EXISTS in the operations migration leaves existing
-- workstation tables unchanged. Add fields used by the workstation form and
-- listing without replacing existing columns or records.
begin;

alter table public.workstations
  add column if not exists name text,
  add column if not exists type text,
  add column if not exists location text,
  add column if not exists rate numeric(14,2) not null default 0,
  add column if not exists device text,
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- PostgREST must discover the new columns before accepting workstation saves.
notify pgrst, 'reload schema';

commit;
