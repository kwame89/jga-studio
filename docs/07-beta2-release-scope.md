# 07 — Beta 2 Release Scope

**Status:** Draft v0.1 · 2026-07-15

The contract for the next milestone. If a feature isn't listed here, it's
out. "Placeholder" means the UI may show it, but it's visibly inert or
manual behind the scenes — never silently broken.

## 1. Definitely in beta 2

**Commerce (01)**
- Full order state machine, single-artwork orders, originals + editions
  with inventory holds
- Both rails: Stripe Checkout and USDC-on-Base wallet payment with
  server-side confirmation
- Self-serve pre-ship cancellation; Stripe refunds automated; crypto
  refunds admin-executed
- Webhook idempotency (`webhook_events`) and the crypto reconciliation queue

**Auth (02)**
- Privy login (email/social/wallet) with embedded wallets; multi-wallet
  linking with one primary
- `user_roles` admin gating; all writes via Edge Functions

**Auctions (05)**
- Live English auctions on originals: tiered increments, hidden reserve
  with met/not-met badge, 10-minute soft close with unlimited extensions
- Checkout-link settlement with 48h deadline, default strikes,
  admin-triggered underbidder offers

**Rewards (06)**
- Full accrual (purchase, auction win, participation, manual grants)
- **Onchain claiming of $JGA on Base** with retry/failure handling
- One live utility: holder priority access to new drops

**Admin (04)**
- Artwork CRUD + image upload + availability; lot creation; order and
  collector management; manual grants; studio-news broadcast;
  full audit log

**Notifications**
- Transactional email (order confirmed/shipped, outbid, auction won,
  settlement reminder, claim confirmed) driven by the outbox, respecting
  `notification_preferences`

## 2. Placeholder in beta 2

| Feature | What ships instead | Real version |
|---|---|---|
| **Onchain escrow bidding** | Everyone settles via checkout link; UI may show "instant-settle bidding coming soon" | Next milestone — designed in 05 §7 |
| **Shipping / carrier integration** | Admin marks shipped/delivered by hand; tracking number is a pasted string, link rendered best-effort | Carrier API + auto-delivery detection later |
| **Automated crypto refunds** | Admin sends the USDC refund and pastes the tx hash | Automated once treasury moves to a server wallet |
| **Delivery confirmation** | Manual `mark-delivered`; auto-complete after 30 days regardless | Comes free with carrier integration |

## 3. Explicitly out of scope for beta 2

- Proxy/maximum bidding, bid retraction, auto-charge of winners
- Multi-item cart / multi-artwork orders
- Editions in auctions
- Secondary market / collector-to-collector resale
- NFT twins of physical artworks
- Additional token utilities beyond priority access (no discounts, no
  gated content yet)
- Guest checkout
- Sales tax automation (manual handling; revisit before scaling)
- In-app push / SMS notifications (email only)
- Multi-artist support — JGA Studio is single-artist by design in beta 2

## 4. Exit criteria (definition of done)

1. A collector can buy an original and an edition on **each rail** and
   receive shipped/confirmation emails; refund-before-ship works on both.
2. An auction runs end-to-end: sniped final minute extends; reserve badge
   correct; winner pays via link; a simulated default walks the
   underbidder-offer path.
3. A collector accrues rewards from a purchase and a contested lot, claims,
   and sees $JGA in their wallet on Basescan; a forced claim failure lands
   in `needs_attention` and is manually resolvable without double-mint.
4. Every admin mutation appears in `admin_audit_log`; a non-admin calling
   any `admin-*` function gets 403 and a denied log row.
5. Replayed Stripe/Alchemy webhooks (same event id) are no-ops.

## Changelog

- v0.1 (2026-07-15) — Initial draft.
