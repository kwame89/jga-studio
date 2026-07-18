# 02 — Auth & Permissions Spec

**Status:** Draft v0.1 · 2026-07-15

## 1. Division of responsibility: Privy vs Supabase

| Concern | Owner |
|---|---|
| Login (email, social, wallet), session tokens | **Privy** |
| Embedded wallet creation & signing | **Privy** |
| External wallet linking + ownership proof (SIWE) | **Privy** |
| Collector profile, orders, bids, rewards — all domain data | **Supabase** |
| Roles / admin access | **Supabase** (`user_roles`) |

**Rule: Privy authenticates; Supabase is the source of truth.** No domain
state is ever read from or written to Privy user metadata. If Privy were
swapped out, only the token-verification layer and wallet UX would change.

## 2. How collectors are identified

- Canonical identity is the **Privy DID** (`did:privy:...`), stored as
  `collectors.privy_did` (unique). The internal key for all foreign keys is
  `collectors.id` (uuid) — never the DID and never a wallet address.
- **First login:** client calls the `sync-user` Edge Function with the Privy
  access token. It verifies the token (Privy verification key), then upserts
  the `collectors` row and mirrors currently-linked wallets into
  `collector_wallets`.
- **Wallets are attributes, not identity.** A collector may link several
  wallets (`collector_wallets`, all verified via Privy's ownership proof).
  Exactly one is `is_primary` — reward claims pay out there (06 §5).
  Unlinking a wallet never orphans domain data because nothing is keyed on
  addresses.
- Email (from Privy) is mirrored to `collectors.email` for notifications and
  auction settlement links. Guest checkout does not exist: buying and bidding
  require a Privy login.

## 3. Request authentication

Every Edge Function that acts on behalf of a user:

1. Reads the Privy access token from the `Authorization` header.
2. Verifies signature, audience (our app id), and expiry against Privy's
   verification key. **Never trusts a client-supplied user id.**
3. Resolves `privy_did → collectors.id`; rejects with 401/404 if missing.
4. Executes with the **service-role** Supabase client.

The browser's Supabase anon client is **read-only** (RLS, §5). We do not mint
Supabase JWTs per user in beta 2 — private reads go through Edge Functions
too, which keeps exactly one auth path to audit.

## 4. How admin access is granted

- Table: `user_roles (collector_id, role, granted_by, granted_at)` with
  `role ∈ {admin}` for now. Seeded with Jay's collector row via migration.
- Every `admin-*` Edge Function, after token verification, requires an
  `admin` row for the caller; otherwise 403 + `admin_audit_log` entry
  (denied attempts are logged too).
- Granting/revoking admin is itself an admin action (`admin-grant-role`),
  audited. The seed admin cannot revoke their own last admin role
  (lockout guard).
- The admin UI is the same app behind a route guard; the guard is
  convenience only — **enforcement lives in the Edge Functions.**

**Live v1 bridge (2026-07-16):** until the beta 2 `collectors` and
`user_roles` rebuild lands, catalog administration uses the server-only
`studio_admins` allowlist keyed directly by Privy DID. The `admin-catalog`
Edge Function verifies the Privy access token and checks that allowlist before
calling the transactional catalog RPC. `collector_wallets.is_admin` and any
client-visible email check are explicitly non-authoritative.

**Decommissioning the bridge (required, not optional).** The allowlist is
safe *today* precisely because it is the only path: one server-side check,
no client input. The risk is the transition. When `user_roles` ships:

1. Migrate `admin-catalog` to the `user_roles` check in the same commit that
   removes the `studio_admins` check. **Never accept both** — an
   `is_studio_admin(x) OR has_role(x,'admin')` shape means revoking someone
   in `user_roles` silently leaves them an admin, which is the
   privilege-escalation bug this whole section exists to prevent.
2. Confirm no other function, RPC, or RLS policy still references
   `studio_admins` (`grep -rn studio_admins supabase/` must return only the
   drop migration).
3. Drop `studio_admins` and its RPC parameters in a migration, after
   verifying the current allowlist members exist in `user_roles` — dropping
   first would lock the studio out of its own catalog.

Until all three are done, the bridge is live and `user_roles` is not the
authority, whatever the rest of this document says.

## 5. Which writes must go through Edge Functions

**All of them, with one exception.**

| Writer | Allowed writes |
|---|---|
| Browser (anon client) | `notification_preferences` — own row only, via RLS (`collector_id = auth mapping`) |
| Edge Functions (service role) | Everything else |
| Nothing else | Direct table access with service key outside Edge Functions is prohibited by convention |

Why the strict rule: order state transitions, inventory holds, bid
validation, and reward accrual all have invariants (01 §2, 05 §3, 06 §3)
that RLS cannot express. One write path = one place invariants live.

**Edge Function inventory (beta 2):**

| Function | Caller | Purpose |
|---|---|---|
| `sync-user` | Any authenticated | Upsert collector + wallets from Privy token |
| `create-order` | Collector | Order + hold + checkout session / crypto quote |
| `submit-crypto-payment` | Collector | Record tx hash for confirmation |
| `cancel-order` | Collector | Pre-ship cancel per 01 §5 |
| `place-bid` | Collector | Validated bid insert (05 §3) |
| `request-claim` | Collector | Reward claim (06 §5) |
| `stripe-webhook` | Stripe | 01 §6 |
| `chain-webhook` | Alchemy | 01 §6 |
| `atlas-import` | Archive Atlas (HMAC shared secret, not a user token) | 09 §2 |
| `confirm-crypto-payments`, `expire-holds`, `close-auctions`, `process-claims`, `complete-orders`, `settlement-deadlines` | Cron | Scheduled workers |
| `admin-*` (artwork, images, availability, lots, orders, rewards, roles, notifications) | Admin | 04 |

## 6. RLS posture (summary — details in 03)

- Public catalog (`art_pieces`, `art_images`, `auction_lots`, bid history
  with amounts but masked bidder identity): `SELECT` for everyone.
- Everything else: no anon access; reads served by Edge Functions scoped to
  the verified caller.
- `notification_preferences`: the collector's own row, read/write.

## 7. Open questions

- Should collectors get direct RLS reads of their own orders/rewards in a
  later milestone (would require minting Supabase JWTs from Privy tokens)?
  Beta 2 says no — revisit if Edge Function latency hurts.
- Session length / refresh policy on the Privy side — defaults, or tighter
  for admin?

## Changelog

- v0.3 (2026-07-16) — Documented the live v1 `studio_admins` authorization
  bridge and removed client-side admin flags from the security boundary.
- v0.2 (2026-07-15) — Added `atlas-import` (HMAC service auth) to the
  function inventory.
- v0.1 (2026-07-15) — Initial draft.
