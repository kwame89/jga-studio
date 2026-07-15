# 1 — Commerce (orders · payments · auctions · rewards)

## Order states

`pending_payment → paid → preparing → shipped → delivered → completed`
Exits: `pending_payment → cancelled` (hold expiry / user cancel);
`paid|preparing → refund_pending → refunded`.

- Orders are single-artwork; `quantity > 1` only for editions.
- Creating an order holds inventory for **30 min** (`hold_expires_at`):
  originals → `art_pieces.status = held`; editions → `editions_held++`.
- `paid` commits inventory (original → `sold`; edition → `sold++`, `held--`)
  and writes `reward_events` (status `pending`).
- `shipped` requires a tracking number, closes the refund window, and flips
  the order's reward events to `claimable`.
- `delivered → completed` automatically after 30 days (cron).
- Refunds: **sales final once shipped.** Before ship: self-serve cancel →
  full refund. Stripe refund automated via API + webhook; crypto refund =
  admin sends USDC, pastes tx hash. Refund voids the order's reward events.
- Illegal transitions: reject + audit-log. Out-of-order webhooks: no-op, log.

**Shipping** (buyer pays; `shipping_rates` config table, zone × size
bucket, snapshotted to the order; null rate = quote-only → block instant
checkout, show "Contact the studio"):

| Bucket | US | Canada | Intl |
|---|---|---|---|
| `print` | $15 | $30 | $50 |
| `small` ≤24″ | $50 | $90 | $150 |
| `medium` ≤40″ | $100 | $180 | $300 |
| `large` >40″ | $250 | quote | quote |

Insured to sale price; signature for originals; **DDU** — import
duties/taxes are the collector's, stated at checkout.

**Excluded destinations** (config; country picker omits them): Cuba, Iran,
North Korea, Syria, Russia, Belarus, Crimea/Donetsk/Luhansk — US
embargoes / artwork export bans.

**Sales tax:** NJ-destined orders only: **6.625% on subtotal + shipping**
(NJ taxes delivery for taxable goods; artwork is taxable). Config value;
snapshot to `orders.tax_cents`; `total = subtotal + shipping + tax`. No
collection for other states in beta 2.

## Payment rails

**Stripe:** `create-order` makes a Checkout Session (30-min expiry,
`metadata.order_id`). Confirmation only via webhook.

**Crypto (USDC on Base):** `create-order` returns treasury address + exact
6-decimal amount. Frontend sends the transfer from the Privy wallet, then
calls `submit-crypto-payment(order_id, tx_hash)` → payments row
`processing`. A 1-min cron verifies onchain (recipient, token, amount ≥
quote, ≥10 confirmations, not reverted) → succeed/fail. Underpay = fail;
overpay = succeed, delta recorded for manual refund. Payment landing after
order cancellation → `orphaned` → admin reconciliation queue.

## Webhooks (verify signature → idempotency insert → act in one tx → 200)

| Event | Action |
|---|---|
| Stripe `checkout.session.completed` | payment `succeeded`; order `paid`; commit inventory; reward events; notify |
| Stripe `payment_intent.payment_failed` | payment `failed`; order unchanged (retry until hold expiry) |
| Stripe `checkout.session.expired` | cancel order, release hold |
| Stripe `charge.refunded` | order `refunded`; void reward events |
| Stripe `charge.dispute.created` | `disputed = true`; freeze rewards; notify admin |
| Alchemy address-activity (treasury) | backstop matching + orphan detection |
| Cron: `confirm-crypto-payments` 1m · `expire-holds` 5m · `close-auctions` 1m · `settlement-deadlines` 15m · `process-claims` 1m · `complete-orders` daily | as named |

## Auctions (English, straight bids, originals only)

Lot states: `draft → scheduled → live ⇄ extended → closed_pending_settlement
→ settled`, or `→ passed` (reserve unmet / offers exhausted), `→ cancelled`.

**Bid accept guards** (in `place-bid`, lot row locked): lot live/extended and
now < `ends_at`; bidder authed, not suspended, not current high bidder;
amount ≥ starting bid or ≥ current + increment:
`<$100:+$10 · $100–499:+$25 · $500–999:+$50 · $1k–4,999:+$100 ·
$5k–9,999:+$250 · ≥$10k:+$500`.
Accept → previous top bid `outbid` + notification. Typed error codes. Bids
binding; no retraction; no proxy bidding.

**Reserve:** hidden amount (column excluded from public view). UI shows only
"Reserve met / not met". Below-reserve bids accepted but can't win.
Immutable once live.

**Anti-snipe:** bid within final **10 min** → `ends_at = placed_at + 10 min`,
lot `extended`. Unlimited extensions. Keep `original_ends_at`.

**Settlement (beta 2 = checkout link):** close with reserve met → create
order (`source=auction`, hammer + shipping; **buyer's premium = 0%**,
config `buyers_premium_bps`), notify winner,
`settlement_deadline = close + 48h`, reminder at 24h. Paid → lot `settled`;
auction rewards written at payment, not hammer. Default → bid
`cancelled_default`, strike (2 strikes → `bidding_suspended`); admin chooses:
offer underbidder at their own last bid (new 48h order), relist, or pass.
Escrow bidding is next milestone — do not build, leave the seam.

## Rewards (`jga_studio` ERC-20 at `0xcc3b…4b9a` on Base — rates are admin config)

| Earn | When written | Rate | Claimable |
|---|---|---|---|
| `purchase` | order `paid` | 10 $JGA / $1 subtotal | on `shipped` |
| `auction_win` | auction order `paid` | purchase rate +25% on hammer | on `shipped` |
| `bid_participation` | lot close | 25 flat per (collector, lot); only lots with ≥3 distinct bidders; unique constraint | immediately |
| `manual_grant` / `clawback` | admin, reason required | any (negative for clawback) | immediately |

Event lifecycle: `pending → claimable → claimed`, or `→ voided`
(refund/dispute/clawback while unclaimed).

**Claim:** `request-claim` guards: primary wallet verified; balance ≥ 100
$JGA; no open claim. Atomically sweep claimable events → `reward_claims`
(`pending`, unique `idempotency_key`, wallet snapshot). Worker submits
ERC-20 **transfer** (supply is pre-minted — never mint) from the rewards
wallet `0xf840…a7af` (holds the $JGA float — 8M to start — plus gas;
studio pays gas; `request-claim` pauses claims that would exceed the
float) →
`submitted(tx_hash)` → 10 confs → `confirmed`.

**Failure:** backoff retries 1/5/25 min; before any resubmit, check receipt
for the existing tx — never two live txs per claim. Revert → retry once.
3 failures → `needs_attention` (admin queue; collector sees "processing").
Admin-cancelled claim releases its events back to `claimable` in the same
tx. Already-claimed clawbacks net against future earnings — no onchain
seizure.

**Utility (beta 2):** holders ≥ 1,000 $JGA (onchain check) see new drops 48h
early. Copy says "collector rewards" — never anything implying investment.
