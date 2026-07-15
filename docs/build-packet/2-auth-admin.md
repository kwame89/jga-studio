# 2 — Auth · Permissions · Admin

## Identity

- **Privy authenticates; Supabase owns all domain data.** Nothing domain-
  level lives in Privy metadata.
- Canonical id: `collectors.privy_did` (unique). All FKs use
  `collectors.id` uuid — never DIDs, never wallet addresses.
- `sync-user` (called on login): verify Privy access token → upsert
  `collectors` + mirror linked wallets into `collector_wallets`. Exactly one
  `is_primary` wallet per collector (reward claims pay there).
- No guest checkout: buying and bidding require Privy login. Email mirrored
  for notifications/settlement links.

## Request auth (every user-facing Edge Function)

1. Verify Privy token from `Authorization` (signature, app id, expiry).
   Never trust a client-supplied user id.
2. Resolve `privy_did → collectors.id`; 401/404 if missing.
3. Execute with the service-role Supabase client.

Browser anon client is **read-only** (see RLS in 3-schema). Private reads
also go through Edge Functions — one auth path.

## Admin

- `user_roles` table (`role = 'admin'`), seeded with Jay via migration.
- Every `admin-*` function: token check → require admin row → act →
  `admin_audit_log` row (before/after jsonb). **Denied attempts logged too.**
- Role grant/revoke is itself an audited admin action; the last admin
  cannot self-revoke (lockout guard). UI route guard is convenience only.

## Write rule

All writes via Edge Functions. Single exception: collector updates their
own `notification_preferences` row via RLS.

## Edge Function inventory

Collector: `sync-user` · `create-order` · `submit-crypto-payment` ·
`cancel-order` · `place-bid` · `request-claim`
Webhooks: `stripe-webhook` · `chain-webhook`
Cron: `confirm-crypto-payments` · `expire-holds` · `close-auctions` ·
`settlement-deadlines` · `process-claims` · `complete-orders`
Admin: `admin-artwork` (CRUD) · `admin-upload-image` · `admin-set-availability`
· `admin-create-lot` / `admin-cancel-lot` / lot settlement actions ·
`admin-orders` (mark-preparing/shipped/delivered, approve-cancel,
record-crypto-refund) · `admin-grant-reward` · `admin-grant-role` ·
`admin-send-broadcast`

## Admin workflow rules (enforce in functions, not UI)

**Artwork:** created as `draft`. Publish requires ≥1 image + price (or
auction-only note) + edition size ≥1. After publish: text editable;
`price_cents` locked while held/on_auction/after any paid order; `kind` and
`edition_size` locked after first sale (size may only shrink to
`sold + held`, reason required). Delete only drafts with no history —
otherwise archive.

**Images:** signed-upload to Storage bucket `artwork/`, path
`art_pieces/{id}/{uuid}.{ext}`; JPEG/PNG/WebP ≤ 25 MB; `alt_text` required;
first image auto-primary; can't delete a published piece's last image.
Derivatives via Supabase image transforms — no pipeline.

**Availability:** admin may only do `draft→available`,
`available→archived` (no holds, no live/scheduled lot), `archived→available`.
`held`/`sold`/`on_auction` are set only by commerce/auction flows.

**Lots:** originals only; piece must be `available`. Min duration 24h
(warn <72h). Fully editable while `scheduled`; frozen once `live` — cancel
only (with bids: emergency-only, reason required, bidders notified).

**Orders/collectors views:** filters by status/rail/source; disputed badge;
crypto reconciliation queue for orphaned payments; collector detail shows
orders, bids, reward buckets, wallets, suspension. Suspend/unsuspend needs
a reason.

**Rewards/notifications:** manual grant needs a reason; grants >10,000 $JGA
need typed confirmation. Transactional notifications fire from flows only.
Admin broadcast = `studio_news` category, respects preferences, mandatory
preview-to-self before send.
