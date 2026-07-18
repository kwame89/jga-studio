# 4 — Beta 2 Scope Checklist

If it isn't on this page, it's out of scope. "Placeholder" = visible but
inert or manual — never silently broken.

## Build — in scope

**Commerce**
- [ ] Order state machine end-to-end (single-artwork orders, editions with quantity)
- [ ] 30-min inventory holds + `expire-holds` cron
- [ ] Stripe Checkout rail (session, webhooks, automated refunds)
- [ ] USDC-on-Base rail (quote, tx submit, server-side confirmation cron)
- [ ] Orphaned-payment reconciliation queue
- [ ] Self-serve pre-ship cancel; admin crypto-refund recording
- [ ] `shipping_rates` seeded (zone × bucket); quote-only combos block instant checkout; DDU notice at checkout
- [ ] Excluded-destinations config seeded (embargo list); country picker omits them
- [ ] NJ sales tax (6.625% on subtotal + shipping, NJ destinations only) computed into `tax_cents`
- [ ] `webhook_events` idempotency on every handler
- [ ] Auto-complete orders 30 days after delivered

- [ ] **Sales tax vetted by the studio's accountant** before any live NJ
      charge — nexus/registration, shipping taxability, resale exemptions
      (01 §7). Rates are currently researched, not confirmed.

**Auth**
- [ ] Privy login + embedded wallets; `sync-user` upsert
- [ ] Multi-wallet linking, single primary
- [ ] `user_roles` admin gating on every `admin-*` function (denials logged)
- [ ] **Decommission the `studio_admins` bridge** in the same commit that
      moves `admin-catalog` to `user_roles` — replace the check, never OR
      the two, then verify no reference survives and drop the table
      (02 §4). Two live authorization paths is the escalation window.
- [ ] RLS: public catalog reads only; reserve column excluded via view; bids masked via view; own-row `notification_preferences`

**Auctions**
- [ ] Lot lifecycle + `close-auctions` cron (server clock)
- [ ] `place-bid` with row lock, increment tiers, typed error codes
- [ ] Hidden reserve + met/not-met badge
- [ ] 10-min soft close, unlimited extensions, `original_ends_at` kept
- [ ] Settlement: auto-order + link, 48h deadline, 24h reminder
- [ ] Default strikes (2 → suspended) + admin underbidder-offer / relist / pass

**Rewards**
- [ ] Accrual: purchase 10/$1 · auction win +25% · participation 25 flat (≥3-bidder lots, unique per lot) · manual grants with reason
- [ ] Claimable-on-shipped for purchase/win; voiding on refund/dispute
- [ ] `request-claim` (primary wallet, ≥100 $JGA min, one open claim) + sweep
- [ ] `process-claims` worker: submit, confirm at 10 blocks, backoff retries, receipt-check before resubmit, `needs_attention` after 3 failures
- [ ] Utility: ≥1,000 $JGA holders see drops 48h early
- [x] Rewards wallet `0xf840…a7af` funded: 8M $JGA float + ETH gas (verified onchain 2026-07-15)
- [ ] Float-cap claim pause wired (`request-claim` refuses claims exceeding the wallet's live $JGA balance)

**Admin**
- [ ] Artwork CRUD with post-publish field locks; archive not delete
- [ ] Image upload (signed URL, alt text required, primary/reorder)
- [ ] Availability transitions (legal set only)
- [ ] Lot create/cancel with guards
- [ ] Orders view (filters, disputed badge, reconciliation queue) + fulfillment actions
- [ ] Collectors view (search, reward buckets, suspend with reason)
- [ ] Manual grants (>10k typed confirm) + broadcast with preview-to-self
- [ ] `admin_audit_log` row on every mutation

**Notifications**
- [ ] Email outbox worker respecting preferences (order confirmed/shipped, outbid, won, settlement reminder, claim confirmed, broadcast)

**Archive Atlas integration (spec 09)**
- [x] `atlas-import` Edge Function: HMAC auth, idempotent upsert on `atlas_artwork_id`, image copy + ≥2000px gate, lock-aware, per-item batch results, audit-logged — **deployed + auth path verified live 2026-07-15**
- [x] "Push to JGA Studio" action in the Atlas repo — deployed (fn + artwork-page button)
- [ ] "View provenance record" link on piece detail (conservative copy — no "verified authentic")

**App experience (beta feedback — see 5-ux.md)**
- [ ] Home/Discover IA split (narrative home; commerce grid on Discover)
- [ ] Dark theme (black + purple) default + light toggle, AA contrast
- [ ] Fix: featured-release carousel swipes
- [ ] Fix: search term + price filter combination (apply-model with result count + reset)
- [ ] Tag / series / price-tier filter chips (tier bands in config)
- [ ] Swipeable pinch-zoom gallery on piece detail
- [ ] Image upload quality gate (≥2000 px long edge)
- [ ] Human-voice auction copy + plain-language bidding explainer (Jay approves)

## Placeholder — ship the stub, not the feature

- [ ] Escrow bidding: "instant-settle bidding coming soon" copy only; leave the settlement seam
- [ ] Shipping: manual mark-shipped/delivered; tracking number is a pasted string
- [ ] Crypto refunds: admin-executed, tx hash pasted
- [ ] Delivery detection: manual + 30-day auto-complete

## Out — do not build

Proxy bidding · bid retraction · auto-charge winners · multi-item cart ·
editions in auctions · secondary market · NFT twins · extra token utilities ·
guest checkout · tax automation · push/SMS · multi-artist support

## Exit criteria (all must pass before beta 2 ships)

- [ ] 1. Buy an original AND an edition on EACH rail; emails arrive; pre-ship refund works on both rails
- [ ] 2. Full auction: last-minute bid extends; reserve badge correct; winner pays via link; simulated default walks the underbidder path
- [ ] 3. Rewards: accrue from a purchase + a contested lot, claim, tokens visible on Basescan; a forced claim failure lands in `needs_attention` and resolves manually with no double-mint
- [ ] 4. Every admin mutation audited; non-admin hitting any `admin-*` gets 403 + denied log row
- [ ] 5. Replayed Stripe/Alchemy webhooks (same event id) are no-ops
