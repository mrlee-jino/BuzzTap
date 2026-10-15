# BuzzTap finance terms

For the new customer approval requirement, wallet privacy, app integration and platform admin controls, see [Customer payment approval handoff](customer-payment-approval-handoff.md). That migration must be coordinated with the customer app release; it is not yet deployed.

| Term | Meaning |
| --- | --- |
| Cash sale | Actual catalog sale amount retained by the business. Cash tender and change are separate receipt fields. |
| BuzzPoints (BP) | Existing shared currency backed by customer/business BP wallets. Purchased BP, customer loads, collections, refunds and settlement requests continue to use these wallets. |
| Customized BuzzPoints (CBP) | Promotional rewards owed to a linked customer by one business. Separate balance for each `(business_id, profile_id)`. Redeemable only there; no transfer, cash withdrawal, or shared-BP settlement. |
| CBP issued | Whole rewards earned from eligible completed cash/BP sales, not from cash tender or change. |
| CBP redeemed | Rewards spent on products/workstation sessions; reported separately from cash receipts and shared BP collections. |
| Outstanding CBP | Positive balances still available to customers. No monetary conversion or cash value is inferred. |

## Promotion rules

Owners/managers create percentage or fixed-CBP promotions with a minimum sale amount, optional per-sale cap, purchase scope, payment eligibility and UTC+8 dates. The newest matching enabled promotion applies; promotions do not stack. Fractional rewards round down to whole CBP. Only active customers linked to active BuzzTap profiles earn rewards. Guest sales and CBP payments do not earn rebates. Already recorded sales are not retroactively awarded.

Refunds reverse the original earned rebate. If points were already spent, the issuing-business balance may become negative; future earnings repay it before more rewards can be redeemed. CBP refunds restore CBP to the same issuing-business wallet and restore product stock. Checkout retries do not award or debit twice. Existing shared BP balances are never relabeled as CBP or migrated into promotional wallets.

Products and workstation time use their catalog amount for full CBP redemption. CBP requires a whole-point price/payment. Mixed cash/BP/CBP tender and reward expiry are not part of this first implementation. Previously recorded cash payments retain their original amounts.

## Customer application integration

The customer application can read its own rows in `business_customized_bp_wallets` and `business_customized_bp_ledger` using its authenticated Supabase session. Display `balance` alongside `business_id`; never combine balances across businesses. The customer app's UI is maintained outside this checkout and still needs those fields connected.

## Setup

Apply `supabase/migrations/20261013000011_customized_buzzpoints_rebates.sql` after migrations 01–10. The new Rebates & Customized BP page manages promotions and shows customer balances. Cash, BP and CBP activity remain separate in dashboards, reports, exports, transactions and receipts. Existing BP top-up and settlement flows retain their current review process.
