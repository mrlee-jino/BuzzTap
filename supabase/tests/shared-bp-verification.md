Shared BP migration verification
===============================

Run the isolated PostgreSQL fixture suite:

```
npm install --prefix .tmp/db-tools --no-save --package-lock=false @electric-sql/pglite
node supabase/tests/shared-bp-transfers.cjs
```

The fixture exercises the migration's actual SQL against a small PostgreSQL
schema. It does not verify the live baseline constraints, Admin UI, or concurrent
connections: PGlite serializes its query queue.

Before applying migration 20261011000009 to production, run it against a staging
copy with the existing Admin definitions. Verify a customer registered in two
businesses shows the same customer_bp_wallets balance in both apps; a load reduces
only the sending business_bp_wallets balance; payments credit only the receiving
business; full refunds reverse the original verified transfer once. Treasury
balances must remain unchanged.

Repeat identical request IDs and reject changed payloads. Using separate database
connections, submit competing debits, duplicate purchases/refunds, and concurrent
Admin loads. Confirm no negative balance, duplicate charge, partial stock update,
or unrecorded transfer. Check actual authenticated roles, blocked/frozen profiles,
insufficient funds, foreign-business customer IDs, cash sessions, and legacy
transactions that must not be refundable through the shared transfer functions.

New ledger: business_customer_bp_transfers records both sides of each shared
transfer and the associated Admin transactions and business_transactions IDs.
It has RLS enabled and no direct authenticated access. Existing bp_wallet_ledger
and bp_business_wallet_ledger remain treasury funding ledgers. No balances from
buzzpoint_wallets or local wallet_ledger are automatically merged. Admin ledger
and refund views may need a follow-up to recognize the new shared transfer flow;
refund_customer_transaction still targets the separate buzzpoint_wallets system;
this migration adds a guard rejecting transactions marked
wallet_source=customer_bp_wallets. Its existing definition must match the supplied
inspection, otherwise the entire migration aborts for review.

Apply migration 00009 after workstation payments (00004), customer registration
(00005), and Admin-linked cards (00008). It revokes authenticated access to the
old tenant-local loading, workstation purchase, and audit-only refund RPCs, and
exposes their shared-wallet replacements. Run the migration once through the
migration system or SQL Editor. The updated migration supports rerunning against
the same schema: it preserves existing columns, transfer records, and balances,
and replaces function definitions. If 00010 ran first, rerun 00009 followed by
00010 in full. Unexpected legacy refund definitions still abort for review.
