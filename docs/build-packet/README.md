# JGA Studio — Build Packet (Beta 2)

Four files, implementation-ready. Terse by design — the reasoning and edge
cases live in the full protocol docs one level up (`../00`–`07`). When this
packet and the full specs disagree, the full specs win.

| File | Contents | Full spec |
|---|---|---|
| [1-commerce.md](1-commerce.md) | Order machine, payments, webhooks, auctions, rewards | 01, 05, 06 |
| [2-auth-admin.md](2-auth-admin.md) | Identity, permissions, Edge Functions, admin rules | 02, 04 |
| [3-schema.md](3-schema.md) | Runnable Postgres DDL + RLS posture | 03 |
| [4-beta-checklist.md](4-beta-checklist.md) | Scope + exit criteria as checkboxes | 07 |
| [5-ux.md](5-ux.md) | IA, theme, search, media, auction voice (beta feedback) | 08 |

**Stack:** Privy (auth/wallets) · Supabase (Postgres, Edge Functions,
Storage — source of truth) · Stripe Checkout · USDC on Base · $JGA ERC-20
on Base.

**Onchain constants (Base, verified 2026-07-15):**
- Reward token `jga_studio`: `0xcc3b754f6f3c508518ba7d0920f944d800c14b9a`
  (18 decimals, 1B pre-minted → claims are transfers, never mints)
- Commerce treasury (USDC receive):
  `0x30c92610f22203a728f4762e40d23a652feba946` (EIP-7702 smart wallet,
  holds ETH for gas; still do NOT build automated outbound transfers from
  it — key-custody decision, refunds are admin-executed in beta 2)
- Rewards wallet (sends $JGA claims):
  `0xf840b0b61db60daa04a4038f69e9d4b39a31a7af` (EIP-7702 smart wallet;
  funded 2026-07-15 with the 8,000,000 $JGA starting float + ETH gas;
  claims pause when a claim would exceed the float)

**Golden rules (never violate):**
1. All writes via Edge Functions with service role — except a collector's
   own `notification_preferences` row.
2. Only webhook/cron handlers set `paid` and `refunded`.
3. Money = integer minor units. Server clock only. Every admin mutation →
   `admin_audit_log`.
4. Webhook idempotency = unique `(source, external_id)` insert into
   `webhook_events` before acting.
