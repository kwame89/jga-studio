# 5 — UX Requirements (from beta 1 feedback)

Full reasoning in [../08-app-experience-spec.md](../08-app-experience-spec.md).

## IA
- **Home** = narrative: artist statement → bio → series breakdown
  (illustration / paint / experimental) → interleaved "available now"
  modules while scrolling. Never opens as a store shelf.
- **Discover** = the full commerce grid: every purchasable piece + live
  lots, filterable.
- Artwork cards: image, title, series, medium, price/tier badge,
  availability state — visually distinct at a glance.

## Theme
- Dark (near-black + purple accent) is the **default**; clean-white light
  theme behind a persisted toggle. Both must pass WCAG AA.

## Bugs to fix (regression-test these)
- B1: featured-release module must swipe as a real carousel (+ page dots).
- B2: typed search term + price filter tap breaks results → fixed by the
  apply model below.

## Search & filters
- Explicit **Apply** model: query + filter chips accumulate, one action
  executes, result count shown ("14 works") + one-tap Reset. No live
  re-query while typing.
- Filter chips: **tags** (curated list from `art_pieces.tags`), **series**,
  and **price tiers** from config bands — Affordable <$500 · Expensive
  $500–4,999 · Luxurious ≥$5,000 (labels/bands admin-editable).

## Media
- Upload gate: reject <2000 px long edge, warn <2400 px, in
  `admin-upload-image`.
- Piece detail: swipeable gallery with pinch-to-zoom for multi-shot works;
  mixed-media pieces get detail close-ups as extra shots.
- Video display: NOT beta 2 (`media_kind` column exists; don't build the
  player).

## Auction page voice
- Human copy, approved by Jay — no AI-sounding filler.
- Plain-language explainers (one short block each): how bidding works,
  what "reserve not met" means, what happens when you win (checkout link,
  48h). Card payment presented first, wallet second. No blockchain
  vocabulary a collector doesn't need.

## Acceptance lens
A collector must be able to: discover work · learn about the artist ·
verify authenticity · track ownership · join the community · stay
connected — without help. Any redesign that hurts one of the six is wrong.
