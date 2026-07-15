# 3 — Schema (runnable DDL)

Conventions: every table gets `id uuid primary key default
gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at`
(trigger-maintained) — omitted below for brevity. Money = integer minor
units; token amounts = 18-decimal `numeric(78,0)`-style bigints stored as
`numeric` where they may exceed bigint.

```sql
-- enums
create type art_kind as enum ('original','edition');
create type size_bucket as enum ('print','small','medium','large');
create type ship_zone as enum ('us','canada','international');
create type art_status as enum ('draft','available','held','on_auction','sold','archived');
create type order_source as enum ('direct','auction');
create type order_status as enum ('pending_payment','paid','preparing','shipped',
  'delivered','completed','cancelled','refund_pending','refunded');
create type pay_rail as enum ('stripe','crypto');
create type pay_status as enum ('pending','processing','succeeded','failed','orphaned');
create type lot_status as enum ('draft','scheduled','live','extended',
  'closed_pending_settlement','settled','passed','cancelled');
create type bid_status as enum ('active','outbid','winning','won','lost','cancelled_default');
create type reward_kind as enum ('purchase','auction_win','bid_participation',
  'manual_grant','clawback');
create type reward_status as enum ('pending','claimable','claimed','voided');
create type claim_status as enum ('pending','submitted','confirmed','failed','needs_attention');
create type webhook_source as enum ('stripe','alchemy');
create type notif_status as enum ('queued','sent','failed','suppressed');

-- identity
create table collectors (
  privy_did text not null unique,
  email text,
  display_name text,
  bidding_suspended boolean not null default false
);

create table collector_wallets (
  collector_id uuid not null references collectors(id),
  address text not null unique,          -- checksummed Base address
  is_primary boolean not null default false,
  verified_at timestamptz
);
create unique index one_primary_wallet on collector_wallets (collector_id)
  where is_primary;

create table user_roles (
  collector_id uuid not null references collectors(id),
  role text not null check (role in ('admin')),
  granted_by uuid references collectors(id),
  granted_at timestamptz not null default now(),
  unique (collector_id, role)
);

-- catalog
create table art_pieces (
  title text not null, description text, medium text, dimensions text, year int,
  kind art_kind not null,
  size_bucket size_bucket not null default 'small',   -- drives shipping rates
  series text,                                        -- Home narrative grouping
  tags text[] not null default '{}',                  -- curated filter chips (GIN index)
  status art_status not null default 'draft',
  price_cents int,
  edition_size int, editions_sold int not null default 0,
  editions_held int not null default 0,
  published_at timestamptz,
  check (kind = 'edition' or edition_size is null),
  check (editions_sold + editions_held <= coalesce(edition_size, 0)
         or kind = 'original')
);

create type media_kind as enum ('image','video');  -- video display deferred

create table art_images (
  art_piece_id uuid not null references art_pieces(id),
  storage_path text not null,
  media_kind media_kind not null default 'image',
  sort_order int not null default 0,
  is_primary boolean not null default false,
  alt_text text not null
);
create index art_pieces_tags on art_pieces using gin (tags);

-- commerce
create table orders (
  collector_id uuid not null references collectors(id),
  art_piece_id uuid not null references art_pieces(id),
  quantity int not null default 1,
  source order_source not null default 'direct',
  auction_lot_id uuid,                    -- fk added after auction_lots
  status order_status not null default 'pending_payment',
  rail pay_rail not null,
  subtotal_cents int not null, shipping_cents int not null default 0,
  tax_cents int not null default 0,      -- NJ 6.625% on subtotal+shipping, NJ dest only
  total_cents int not null,              -- subtotal + shipping + tax
  shipping_address jsonb not null,        -- snapshot, never a live fk
  hold_expires_at timestamptz,
  tracking_number text, shipped_at timestamptz, delivered_at timestamptz,
  disputed boolean not null default false
);

create table payments (
  order_id uuid not null references orders(id),
  rail pay_rail not null,
  status pay_status not null default 'pending',
  amount_cents int, amount_usdc bigint, received_usdc bigint,
  stripe_session_id text, stripe_payment_intent text,
  tx_hash text unique,
  failure_reason text, refund_reference text
);
create unique index one_success_per_order on payments (order_id)
  where status = 'succeeded';

create table shipping_rates (          -- admin-editable config
  zone ship_zone not null,
  size_bucket size_bucket not null,
  amount_cents int,                    -- NULL = quote only: block instant checkout
  unique (zone, size_bucket)
);
-- seed: print 1500/3000/5000 · small 5000/9000/15000 ·
--       medium 10000/18000/30000 · large 25000/NULL/NULL (us/canada/intl)

create table webhook_events (
  source webhook_source not null,
  external_id text not null,
  payload jsonb,
  processed_at timestamptz,
  unique (source, external_id)            -- THE idempotency mechanism
);

-- auctions
create table auction_lots (
  art_piece_id uuid not null references art_pieces(id),
  status lot_status not null default 'draft',
  starts_at timestamptz, ends_at timestamptz,
  original_ends_at timestamptz,           -- immutable audit copy
  starting_bid_cents int not null,
  reserve_cents int,                      -- NEVER exposed to clients
  current_bid_cents int,
  winning_bid_id uuid,                    -- fk added after bids
  settlement_deadline timestamptz
);
alter table orders add constraint orders_lot_fk
  foreign key (auction_lot_id) references auction_lots(id);

create table bids (
  auction_lot_id uuid not null references auction_lots(id),
  collector_id uuid not null references collectors(id),
  amount_cents int not null,
  status bid_status not null default 'active',
  placed_at timestamptz not null default now()   -- server clock only
);
alter table auction_lots add constraint lots_winning_bid_fk
  foreign key (winning_bid_id) references bids(id);

-- rewards
create table reward_events (
  collector_id uuid not null references collectors(id),
  kind reward_kind not null,
  amount_tokens numeric not null,         -- 18-dec integer; negative = clawback
  status reward_status not null default 'pending',
  order_id uuid references orders(id),
  auction_lot_id uuid references auction_lots(id),
  reason text,                            -- required for manual_grant/clawback
  granted_by uuid references collectors(id),
  claim_id uuid,                          -- fk added after reward_claims
  check (kind not in ('manual_grant','clawback') or reason is not null)
);
create unique index one_participation_per_lot on reward_events
  (collector_id, auction_lot_id) where kind = 'bid_participation';

create table reward_claims (
  collector_id uuid not null references collectors(id),
  wallet_address text not null,           -- snapshot at claim time
  amount_tokens numeric not null,
  status claim_status not null default 'pending',
  idempotency_key text not null unique,   -- double-mint guard
  tx_hash text,
  attempt_count int not null default 0,
  last_error text
);
alter table reward_events add constraint events_claim_fk
  foreign key (claim_id) references reward_claims(id);
create unique index one_open_claim on reward_claims (collector_id)
  where status in ('pending','submitted');

-- notifications
create table notification_preferences (
  collector_id uuid not null unique references collectors(id),
  order_updates boolean not null default true,
  outbid_alerts boolean not null default true,
  auction_results boolean not null default true,
  reward_updates boolean not null default true,
  studio_news boolean not null default false
);

create table notifications (
  collector_id uuid not null references collectors(id),
  category text not null,                 -- matches a preference flag
  channel text not null default 'email',
  template text not null,
  payload jsonb,
  status notif_status not null default 'queued',
  sent_at timestamptz
);

-- audit (insert-only)
create table admin_audit_log (
  actor_collector_id uuid references collectors(id),  -- null = system/cron
  action text not null,                   -- e.g. 'order.mark_shipped'
  entity_type text not null, entity_id uuid,
  before jsonb, after jsonb,
  reason text,
  denied boolean not null default false
);
```

## RLS posture

- Enable RLS on **every** table.
- Anon `SELECT` policies only on: `art_pieces` (where `published_at is not
  null`), `art_images`, `auction_lots` **via a view that excludes
  `reserve_cents`** and hides `draft` lots, and `bids` **via a masked view**
  (amount + anonymized bidder label, no ids).
- `notification_preferences`: collector reads/writes own row (the sole
  client write in the system).
- No other anon/authenticated policies — every other read and write is an
  Edge Function using the service role.
