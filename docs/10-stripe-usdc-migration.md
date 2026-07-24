# 10 — Stripe-native USDC Migration

**Status:** v0.2 · 2026-07-24 · §6 step 2 IMPLEMENTED (create-order, BuyArtworkPanel, stripe-webhook) — awaiting the studio's live USDC checkout test (§6 step 3); manual-rail functions still deployed as rollback until step 4

Plan to replace the manual USDC-on-Base rail with Stripe-native USDC, so both
card and crypto run through the one processor already in use. Supersedes the
manual crypto rail described in [01 — Commerce Build Spec](01-commerce-build-spec.md)
and `build-packet/1-commerce.md`.

## 1. Why

Today there are two rails (`create-order` branches on `rail: "stripe" | "crypto"`):

- **Card** — Stripe Checkout, `stripe-webhook` confirms. Clean.
- **USDC on Base** — `create-order` returns the treasury address + an exact
  micro-USDC amount; the buyer sends manually; `submit-crypto-payment` records
  the tx hash; `confirm-crypto-payment` verifies the transfer on-chain (10
  confirmations) before the order is marked paid.

The manual crypto path is fragile: a buyer can underpay, overpay, use the wrong
network, or pay against an expired quote — the exact failure modes flagged in
the publication-readiness legal review (§6) and by the studio ("checkout should
set the correct network automatically").

Stripe added native stablecoin acceptance (built on its Bridge acquisition):
USDC as a payment method **inside the existing Stripe Checkout**, on Ethereum,
Solana, and **Base** (via Circle CCTP), at a flat **1.5%** fee. That lets USDC
become part of the card rail — one integration, one webhook, one dashboard —
and Stripe owns the network/address/amount, removing the whole class of manual
errors.

Sources (2026): Stripe stablecoin acceptance docs; Bridge acquisition analysis.
Confirm exact integration mechanics against Stripe's current crypto docs when
enabling, since the product is evolving.

## 2. Settlement (REVISED 2026-07-24 — corrected against Stripe's own docs)

Original intent: USDC payments held as USDC and paid out to the Base treasury;
card payments to USD.

**Reality check:** payouts to an external crypto wallet are a Stripe *Connect*
feature (platforms paying their sellers), US-only, and currently limited to
individuals/sole proprietors — not available to a standard merchant account,
and explicitly not to companies (docs.stripe.com/connect/stablecoin-payouts).
The earlier "Settings → Payouts → add USDC wallet" instruction came from
third-party articles and does not exist for this account.

**Settled position:** all revenue — card and USDC — settles to USD in the
studio bank account (1.5% fee on the USDC side). The accumulate-USDC goal is
served separately: periodically buy USDC into the Base treasury from settled
USD, or, if volume ever justifies it, open a direct Bridge account. The old
manual direct-to-treasury rail remains the only true direct-to-wallet receipt
path; it stays available as the §6 rollback until step 4.

## 3. What changes

### Delete
- `supabase/functions/submit-crypto-payment/` — no buyer-submitted tx hash.
- `supabase/functions/confirm-crypto-payment/` — Stripe confirms, not the
  on-chain verifier.
- The `crypto` branch of `create-order` (treasury address, `amountUsdc`,
  micro-USDC math).

### Change
- **`create-order`** → one path: a Stripe Checkout session with card **and**
  crypto enabled. Drop the `rail` param, or pin it to `"stripe"`.
- **`components/BuyArtworkPanel.tsx`** → remove the manual USDC UI (address
  display, tx-hash entry, confirm-polling). One "Proceed to checkout" button;
  the buyer picks card or USDC on Stripe's hosted page.
- **`stripe-webhook`** → per Stripe (2026), existing webhooks work unchanged
  for stablecoin charges; the paid event fires the same, with
  `payment_method.type` = `crypto` instead of `card`. Likely no code change —
  still smoke-test a real USDC session, and use `payment_method.type` if orders
  should record which method paid.

### Keep
- `orders.rail` and the `payments` columns (`amount_usdc`, `tx_hash`) — leave
  for historical records; new orders may all be `stripe`.
- `get-order`, the Stripe path of `create-order`, and the
  `/checkout/success` · `/checkout/cancelled` routes.

## 4. Rewards — verify, don't assume

Investigated (2026-07-21): **nothing in the repo creates a `reward_events` row
on purchase.** `create-order` doesn't, no migration/trigger does, and the
rewards spec ([06 §"State of reality"](06-rewards.md)) admits the reward tables
"exist in the live DB, but no migration creates them." The `purchase` accrual
(10 $JGA / $1 at `paid`, per [06 §2](06-rewards.md)) is **specified but not
implemented**; the one existing reward was a manual/legacy insert.

So this migration cannot break rewards — there is no live purchase→reward link.
And when accrual is built, it should hang off the `paid` transition, which the
Stripe rail fires identically for card and USDC. The migration is compatible
with the intended design; accrual is a separate future task.

## 5. Prerequisites (studio, before any code)

1. Enable stablecoin / "pay with crypto" on the Stripe account; confirm
   eligibility and that **Base** is available.
2. Configure settlement per §2 (USDC held for crypto, USD for card) and confirm
   USDC payout to an external wallet.
3. Confirm the crypto payment method can be enabled on Checkout sessions.

## 6. Sequence

The old rail stays deployed until the new one is proven — that is the rollback.

1. **Studio:** §5 prerequisites.
2. Enable crypto as a Checkout payment method; collapse `create-order` to one
   path; simplify `BuyArtworkPanel`. Old crypto functions stay deployed but
   unreferenced.
3. Test-mode purchase end-to-end — card **and** USDC; verify the webhook marks
   the order paid and settlement lands per §2.
4. Delete `submit-crypto-payment` and `confirm-crypto-payment`; update the Terms.

## 7. Trade-offs (accepted)

- **1.5% fee** on USDC vs. near-zero (gas only) on the manual rail — the price
  of killing the fragile flow and running one processor.
- **Stripe/Bridge custody** in the flow + a payout step to reach the treasury,
  vs. direct-to-wallet receipt today.

## 8. Legal follow-through

Once live, this closes legal-review §6 (crypto edge cases) and the
"correct-network-automatically" concern — Stripe owns network/address/amount.
The Payment section of the Terms ([constants/legalContent.ts]) can then drop the
"send only to the address shown; wrong network = permanent loss" warnings.
