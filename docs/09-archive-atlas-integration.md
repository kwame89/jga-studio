# 09 — Archive Atlas Integration Spec

**Status:** Draft v0.1 · 2026-07-15
**Upstream:** [Archive Atlas](https://github.com/kwame89/archive-atlas) —
artist-first provenance registry with Stellar-anchored event trails
(MVP complete, per its PRD).

## 1. Division of truth

| Concern | System of record |
|---|---|
| Artwork identity: title, medium, dimensions, year, edition info, description, tags, images | **Archive Atlas** |
| Provenance: creation, ownership, custody, exhibitions, condition reports (Stellar-anchored) | **Archive Atlas** |
| Commerce: price, availability, size bucket, holds, orders, payments, auctions, rewards | **JGA Studio** |

Jay authors artwork records **once, in Archive Atlas**, and pushes them to
JGA Studio. JGA Studio never edits synced identity fields; Atlas never
knows about prices or orders (except the sale writeback, §6).

This also resolves the roadmap's "Layer 3 / JGAS registry" concept
(08 §8): **Archive Atlas is that layer**, implemented on Stellar rather
than XRPL. The Digital Artwork Passport the roadmap imagined is, in
substance, Atlas's public per-piece provenance page.

## 2. Sync mechanism (Atlas → Studio, one-way)

- JGA Studio exposes an **`atlas-import` Edge Function**. Service-to-
  service auth: HMAC signature over the payload with a shared secret held
  in both projects' env — no user tokens involved.
- Atlas side: a "Push to JGA Studio" action (per artwork or batch) sends
  the canonical record: `atlas_artwork_id`, title, medium, dimensions,
  year, edition info, description, tags, image manifest (storage URLs +
  primary flag + alt text), and the public provenance page URL.
- **Idempotent upsert** keyed on `art_pieces.atlas_artwork_id` (unique).
  New id → create as `draft`. Existing id → update identity fields only.
- **Images are copied**, not hotlinked: the import function downloads each
  manifest URL into JGA's own `artwork/` bucket (04 §2 path convention)
  and diffs by content hash on re-push — no cross-project runtime
  dependency for collectors. The ≥2000 px quality gate (08 §5) applies at
  import; undersized images are skipped and reported in the import result.
- **Guard:** only artworks whose Atlas `root_artist_id` is Jay's verified
  Atlas profile are accepted (config: `atlas_root_artist_id`). JGA Studio
  is single-artist; the import function is not a general ingest endpoint.

## 3. What sync must never touch

`price_cents`, `size_bucket`, `status`, `edition_size` locks, auction
lots, and all commerce state are JGA-owned. Two interaction rules:

1. **Publish still happens in JGA.** A pushed artwork lands as `draft`;
   Jay sets price/size bucket/availability in the JGA admin (04) as today.
2. **Post-sale locks beat sync.** Field locks from 04 §1 (e.g. edition
   size after first sale) apply to `atlas-import` updates exactly as they
   do to admin edits: a re-push that would violate a lock updates the
   unlocked fields, skips the locked ones, and reports the skips.

## 4. Provenance surfaced to collectors

- `art_pieces.provenance_url` (from the push payload) renders on the
  piece detail page as **"View provenance record"** → Atlas's public
  timeline. This delivers the collector-first pillars *verify
  authenticity* and *track ownership* (08 §7).
- Copy stays conservative, mirroring Atlas's own trust model: "provenance
  record" / "a claim made by the artist as of [date]" — never "verified
  authentic". Note: Atlas anchors on **Stellar testnet** today; wording
  must not imply mainnet permanence until Atlas migrates.

## 5. Conflict & failure behavior

- Import runs per artwork inside a transaction; a batch reports per-item
  success/skip/fail — one bad record never aborts the batch.
- Every import writes an `admin_audit_log` row (actor null/system,
  `action = 'atlas.import'`, before/after) so pushes are as auditable as
  admin edits.
- If Jay edits identity fields directly in JGA admin (allowed but
  discouraged), the next Atlas push overwrites them — the UI warns on
  those fields: "Managed by Archive Atlas; edits will be overwritten."

## 6. Sale writeback (deferred — next milestone)

The full loop is: JGA order `completed` → Atlas `ownership_transfer`
event (buyer as private collector party), making every studio sale part
of the anchored provenance chain automatically. Deferred because it needs
an Atlas-side authenticated ingest and a decision on how collector
identity maps to Atlas's private-collector profiles. **In beta 2, Jay
logs sales in Atlas manually**, as he would for any offline sale.

## 7. Beta 2 scope for this integration

| Item | Status |
|---|---|
| `atlas_artwork_id`, `atlas_synced_at`, `provenance_url` on `art_pieces` | **In** |
| `atlas-import` Edge Function (HMAC, idempotent, image copy, locks-aware) | **In** |
| Atlas-side "Push to JGA Studio" action | **In** (built in the Atlas repo) |
| "View provenance record" link on piece pages | **In** |
| Automated sale writeback to Atlas | **Out** — §6, manual for now |
| Atlas mainnet migration | Atlas's own decision, out of JGA scope |

## 8. Implementation status & deployment (2026-07-15)

Both sides are implemented and pushed; deployment is the remaining step.

| Piece | Where |
|---|---|
| `atlas-import` receiver | `supabase/functions/atlas-import/index.ts` (this repo) |
| Schema for it (Atlas columns, `art_images`, audit log, `artwork` bucket) | `supabase/migrations/20260715000000_atlas_import.sql` — written against the **live v1 schema** (bigint ids, `image_url`, `price_usd`), guarded so the beta 2 rebuild can run over it |
| `push-to-jga` sender + UI | archive-atlas repo: `supabase/functions/push-to-jga/`, `src/components/PushToJgaButton.tsx` (JGA Studio panel on the artwork page, root-artist controllers only) |

Deploy runbook:
1. Generate the shared secret once: `openssl rand -hex 32`.
2. **JGA project:** run the migration; `supabase functions deploy
   atlas-import --no-verify-jwt`; set secrets `ATLAS_SHARED_SECRET`,
   `ATLAS_ROOT_ARTIST_ID` (Jay's Atlas profile uuid).
3. **Atlas project:** `supabase functions deploy push-to-jga`; set secrets
   `JGA_IMPORT_URL`, `JGA_PUSH_SHARED_SECRET` (same value), `ATLAS_PUBLIC_URL`.
4. Smoke test: push one artwork from its Atlas page; confirm the piece
   appears in JGA `art_pieces` (unpriced), images land in the `artwork`
   bucket, and an `admin_audit_log` row exists. Re-push and confirm images
   report `unchanged`.

v1-specific behaviors (superseded by the beta 2 rebuild): edition info is
appended to the description (v1 has no edition columns); `image_url` is
kept pointed at the primary image copy so the current app renders it;
`alt_text` falls back to the title (Atlas doesn't capture alt text yet).

## 9. Open questions

- Where does the shared HMAC secret live and rotate? (Both projects'
  Supabase secrets; propose 90-day manual rotation to start.)
- Should tags pushed from Atlas merge with JGA-local tags or replace
  them? (Propose: Atlas replaces — one source of truth for identity
  metadata, and 08's curated-tag question then lives in Atlas.)
- Batch size limits / rate limiting on `atlas-import` for the initial
  back-catalog push.

## Changelog

- v0.3 (2026-07-15) — **Deployed to both projects and verified live**:
  migration applied, all five secrets set, unsigned requests 401, signed
  request with a foreign root artist correctly rejected + audit-logged.
  Atlas public origin: `https://beta.archiveatlas.art`.
- v0.2 (2026-07-15) — Both sides implemented (§8): `atlas-import` +
  migration in this repo, `push-to-jga` + artwork-page button in the
  archive-atlas repo. Deployment runbook added.
- v0.1 (2026-07-15) — Initial draft from the Archive Atlas PRD/schema
  review and Jay's proposal to use it as the artwork backend.
