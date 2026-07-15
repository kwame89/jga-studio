# 04 — Admin Workflow Spec

**Status:** Draft v0.1 · 2026-07-15

Every workflow here = admin UI → `admin-*` Edge Function → role check (02 §4)
→ mutation → `admin_audit_log` row. The UI never writes tables directly.

## 1. Create / edit artwork

- **Create** starts as `status = draft`: title, description, medium,
  dimensions, year, `kind` (original | edition), `edition_size` (editions),
  `series`, and `tags` (chosen from the curated tag list — 08 §4; tags and
  series stay editable after publish).
- **Edit** is unrestricted while `draft`. Once published:
  - Text fields: editable anytime (typo fixes).
  - `price_cents`: editable while `available`; **locked** while `held`,
    `on_auction`, or after any `paid` order exists for the piece.
  - `kind` and `edition_size`: locked after first sale; `edition_size` may be
    **reduced** (never raised) down to `editions_sold + editions_held`
    — the "closing the edition" operation, requiring a `reason`.
- **Publish** (`draft → available`) requires: ≥1 image, price set (or a note
  that it's auction-only), and for editions a size ≥ 1.
- **Delete** is only allowed for `draft` pieces with no lot history;
  everything else uses **archive** (§4).

## 2. Upload images

- Upload goes through `admin-upload-image` which returns a signed Supabase
  Storage upload URL; bucket `artwork/`, path
  `art_pieces/{art_piece_id}/{uuid}.{ext}`.
- On completion the function writes `art_images` (sort_order appended,
  first image auto-`is_primary`, `alt_text` required — accessibility is not
  optional for an art site).
- Constraints: JPEG/PNG/WebP, ≤ 25 MB. **Quality gate (beta feedback,
  08 §5): reject uploads under 2000 px on the long edge; warn under
  2400 px.** Derivatives (thumb/display sizes) are produced by Supabase
  image transforms at request time — no separate pipeline in beta 2.
- Reorder and set-primary are batch operations in one function call.
- Deleting an image removes the row and the storage object; the last image
  of a **published** piece cannot be deleted.

## 3. Set availability

Single function `admin-set-availability` handling the legal transitions:

| From → To | Guard |
|---|---|
| `draft → available` | Publish checks (§1) |
| `available → archived` | No open holds; not in a live/scheduled lot |
| `archived → available` | — |
| `available ↔` price update | See §1 locks |

`held`, `sold`, `on_auction` are **never set by hand** — only by the
commerce (01) and auction (05) flows. The admin UI shows them read-only with
a link to the owning order/lot.

## 4. Create auction lots

- `admin-create-lot`: pick an `available` piece (originals only in beta 2 —
  editions don't auction), set `starting_bid_cents`, optional
  `reserve_cents`, `starts_at`, `ends_at` (min duration 24h, warn under 72h).
- Creating a lot sets the piece `on_auction` and the lot `scheduled`
  (or `draft` if unscheduled).
- **Editable while `scheduled`:** everything. **After `live`:** nothing —
  cancellation is the only lever (`admin-cancel-lot`, allowed while live only
  if there are no bids; with bids, cancellation requires a `reason` and
  notifies all bidders — reserved for genuine emergencies).
- Settlement actions (offer-to-underbidder, relist, mark-settled) are in
  05 §6 and surface in the lot detail view.

## 5. View orders and collectors

- **Orders list:** filter by status, rail, source, date; badge for
  `disputed` and for the crypto **reconciliation queue** (orphaned payments,
  01 §4). Detail view shows the full payment attempt history and the audit
  trail for that order.
- Order actions: `mark-preparing`, `mark-shipped` (tracking number
  required), `mark-delivered`, `approve-cancel` (executes refund per 01 §5),
  `record-crypto-refund` (paste refund tx hash).
- **Collectors list:** search by email/name/wallet; detail shows orders,
  bids, reward balance (pending / claimable / claimed), linked wallets,
  suspension flag. Actions: suspend/unsuspend bidding (reason required),
  grant role (02 §4).

## 6. Trigger rewards and notifications

- **Manual reward grant** (`admin-grant-reward`): collector, token amount,
  required `reason`; writes a `reward_events` row (`manual_grant`,
  immediately `claimable`). Negative adjustments use `clawback` kind, same
  function, same audit trail. Sanity cap: grants above a configured
  threshold (default 10,000 tokens) require a typed confirmation.
- **Notifications:** transactional messages are enqueued automatically by
  the flows in 01/05/06 — admin does not trigger those by hand. Admin *can*
  send a **studio-news broadcast** (`admin-send-broadcast`): template +
  audience (all collectors / buyers only / bidders of a lot), which enqueues
  `notifications` rows respecting `studio_news` preferences. A preview-to-self
  step is mandatory before the real send.

## 7. Open questions

- Should editions be auctionable later (lot per print number)? Out for beta 2.
- Bulk CSV import of back-catalog artworks — needed for launch content?

## Changelog

- v0.2 (2026-07-15) — Beta feedback: image quality gate (≥2000 px),
  tags/series on artwork create-edit.
- v0.1 (2026-07-15) — Initial draft.
