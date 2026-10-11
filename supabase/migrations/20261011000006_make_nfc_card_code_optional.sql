-- Permit cards identified by their internal ID to omit the display code.
-- Existing codes, indexes, and other card constraints remain intact.
begin;

-- Legacy installations created by this repository may not have card_code.
-- Add it as nullable there; otherwise relax only its NOT NULL constraint.
alter table public.nfc_cards
  add column if not exists card_code text;

alter table public.nfc_cards
  alter column card_code drop not null;

notify pgrst, 'reload schema';

commit;
