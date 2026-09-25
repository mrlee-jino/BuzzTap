alter table public.business_invitations
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

alter table public.business_invitations
  add column if not exists name text;