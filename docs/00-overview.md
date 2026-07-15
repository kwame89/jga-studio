# JGA Studio Protocol — Spec Index

**Status:** Draft v0.1 · 2026-07-15
**Owner:** Jay Golding

These seven documents define how the JGA Studio platform behaves. They are the
source of truth: when code and spec disagree, either the code is wrong or the
spec gets a changelog entry.

## Documents

| # | Doc | Answers |
|---|-----|---------|
| 01 | [Commerce build spec](01-commerce-build-spec.md) | Order states, sale flow, refund/cancel/failed payment, webhooks, data writes |
| 02 | [Auth & permissions](02-auth-and-permissions.md) | Privy vs Supabase, collector identity, admin access, Edge Function write rules |
| 03 | [Data model](03-data-model.md) | Every table, key columns, relationships, RLS posture |
| 04 | [Admin workflows](04-admin-workflows.md) | Artwork CRUD, images, availability, lots, orders, rewards, notifications |
| 05 | [Auction rules](05-auction-rules.md) | Increments, reserve, anti-snipe, settlement, beta limits |
| 06 | [Rewards](06-rewards.md) | Earning, claimability, token utility, claim failure/retry |
| 07 | [Beta 2 release scope](07-beta2-release-scope.md) | In / placeholder / out |

## Locked architectural decisions (2026-07-15)

1. **Dual payment rails.** Fiat via Stripe Checkout; crypto via USDC on **Base**.
2. **Supabase is the source of truth** for all domain data. Privy provides
   identity and wallets only — no domain state lives in Privy.
3. **All domain writes go through Supabase Edge Functions** (service role).
   The single exception: a collector may update their own
   `notification_preferences` row directly under RLS.
4. **Admin access via a `user_roles` table** in Supabase, seeded with the
   studio owner. Edge Functions check it; no hardcoded email lists.
5. **Products are physical** — unique originals and limited editions/prints.
   Orders carry shipping states. No NFT twin of artworks.
6. **Auctions are fully live in beta 2** with soft-close anti-sniping and
   hidden reserves. Settlement in beta 2 is **checkout link + 48h deadline**
   for all winners. **Onchain escrow bidding is designed but deferred** to the
   next milestone (see 05 §7).
7. **Rewards are a real ERC-20 on Base.** Accrual and onchain claiming are
   both live in beta 2. Earned by purchases, auction wins, bid participation,
   and manual grants.
8. **Refund policy: sales are final once shipped.** Full-refund cancellation
   is available any time before the piece ships.
9. **Shipping is manual in beta 2** — admin marks shipped/delivered by hand;
   no carrier API.

## Conventions used across all docs

- State names are `snake_case` and match database enum values exactly.
- "Edge Function" always means a Supabase Edge Function running with the
  service-role key, verifying a Privy access token.
- Money is stored as integer minor units (`amount_cents` for USD,
  `amount_usdc` as 6-decimal integer). Never floats.
- Every doc ends with **Open questions** (unresolved, needs Jay) and a
  **Changelog**.
