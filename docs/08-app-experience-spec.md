# 08 — App Experience Spec (Beta 1 Feedback)

**Status:** Draft v0.1 · 2026-07-15
**Sources:** TestFlight beta feedback from Malcolm and Jordan (JGA Studio v2
Roadmap doc). Items the protocol already covered (per-piece descriptions,
multi-image data model, purchase-flow testing) are omitted.

## 1. Information architecture

Restructure the app around **narrative first, commerce one tab away**
(Malcolm):

- **Home** — about the artist, not a store shelf:
  1. Artist statement
  2. Artist bio
  3. Series breakdown (illustration → paint → experimental), each series
     linking into its pieces
  4. Interleaved "available now" modules as the user scrolls — sales are
     present on Home but never the opening note
- **Discover** — the full commerce surface: every purchasable piece and
  live auction lot in one browsable, filterable grid.
- Every artwork card must be **visually self-differentiating** at a glance
  (Malcolm: "can't differentiate between the pieces they're acquiring"):
  card shows image, title, series, medium, price/tier badge, and
  availability state — no two cards should read as interchangeable.

## 2. Theme

- **Default: dark mode** — near-black surface with the purple accent
  (Jordan: "way better in dark mode with black and purple").
- A clean-white light theme remains available; the toggle persists per
  device. Exact hex values live in the app theme config, tuned once with
  Jay against WCAG AA contrast on both themes.

## 3. Known bugs (fix in beta 2 — from live beta testing)

| # | Bug | Required behavior |
|---|---|---|
| B1 | Featured-release module does not scroll horizontally | Make it a true swipeable carousel with page indicators |
| B2 | Typing a search term and then tapping the price filter breaks search | See §4 — move to explicit apply-filters model |

## 4. Search & filtering (Jordan)

- **Explicit apply model:** free-text query + filter selections accumulate
  into a pending state; a single **Apply** action runs the combined query
  (the e-commerce "filter by brand" pattern). No live re-query racing the
  user's typing — this is also the structural fix for bug B2.
- **Result count** displays with the applied filters (e.g. "14 works") and
  a one-tap **Reset**.
- **Tags, not just prices:** filterable tag chips sourced from
  `art_pieces.tags` (e.g. series name, medium, subject). Admin assigns
  tags at artwork creation/edit (04 §1).
- **Price tiers** (Malcolm) as friendly filter chips instead of raw dollar
  inputs, derived from `price_cents` via config bands (admin-editable):

| Tier | Default band |
|---|---|
| Affordable | under $500 |
| Expensive | $500 – $4,999 |
| Luxurious | $5,000 and up |

Tier labels are marketing-facing copy and may be renamed in config without
schema changes.

## 5. Media quality & gallery view

- **Minimum upload standard** (enforced in `admin-upload-image`, 04 §2):
  2000 px on the long edge, no visible compression artifacts; the admin UI
  warns below 2400 px. Listing hero images should be shot in consistent
  lighting per series so Discover reads as a curated grid (Malcolm's
  "photo quality must be raised").
- **Gallery view per piece** (Jordan): pieces with multiple shots open
  into a swipeable gallery with pinch-to-zoom; mixed-media works should
  include detail/texture close-ups as additional shots.
- **Video as a media type** is schema-ready (`art_images.media_kind`) but
  video *display* is a stretch goal — see 07.

## 6. Auction page voice (Jordan)

- Rewrite auction-page copy in the studio's human voice — no generic
  AI-sounding filler. Jay writes or approves final copy.
- Assume some bidders are older and not crypto-native: the page must
  explain, in plain language and one short block each, (a) how bidding
  works, (b) what "reserve not met" means, (c) what happens when you win
  (checkout link, 48h). Card payment is presented as the default,
  wallet payment as the alternative.
- No blockchain vocabulary anywhere a collector doesn't strictly need it
  — the chain is invisible infrastructure.

## 7. Collector-first acceptance lens

Every screen change above is judged against the six things a collector
must be able to do without help: **discover work · learn about the artist
· verify authenticity · track ownership · join the community · stay
connected.** If a redesign hurts any of the six, it's wrong regardless of
how it looks.

## 8. Future direction (recorded, NOT beta 2)

From the roadmap's ecosystem discussion — logged so the beta 2 build
doesn't paint us into a corner, but none of it ships now:

- **Three-token separation:** `jaygoldingart89` (artist identity, Zora),
  `jga_studio` (studio identity), and a possible **JGAS**
  artwork/provenance layer (possibly XRPL) for COAs, registry, and
  ownership records. *Update 2026-07-15: the registry-layer role is
  materially filled by **Archive Atlas** on Stellar (spec 09) — a
  separate JGAS token remains hypothetical.*
  ⚠ **Tension to resolve before that migration:** beta 2 already uses
  `jga_studio` as the purchase-rewards token (06, funded wallet) — under
  the three-layer model, purchase rewards would arguably belong to the
  JGAS layer. If JGAS materializes, decide whether reward balances migrate
  or `jga_studio` keeps the rewards role. `reward_events` provenance rows
  make an accounting migration possible either way.
- **Digital Artwork Passport:** per-work record of image, title, medium,
  dimensions, date, exhibition history, ownership history, certificate
  status. *Update 2026-07-15: this substantially exists as Archive
  Atlas's per-piece provenance record, synchronized as a read-only
  `provenance_events` snapshot and rendered inside JGA piece detail
  (spec 09 §4).*

## 9. Open questions

- Final hex palette for the dark theme (Jordan suggested black + purple;
  needs Jay's pick against AA contrast).
- Tag vocabulary: free-form, or a curated list Jay controls? (Recommend
  curated — consistent chips make Discover feel institutional.)

## Changelog

- v0.2 (2026-07-15) — §8 updated: Archive Atlas fills the registry-layer
  and Artwork Passport roles (spec 09).
- v0.1 (2026-07-15) — Initial draft from Malcolm's and Jordan's beta
  feedback; ChatGPT ecosystem notes recorded as future direction only.
