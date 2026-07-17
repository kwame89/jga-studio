-- Commerce core (docs/build-packet 1-commerce + 3-schema, adapted to the
-- live v1 schema): orders, payments, webhook idempotency, and sold-state on
-- art_pieces. Money is integer cents; USDC is a 6-decimal integer.
--
-- Design notes:
--  - Single-piece orders on unique originals. Double-selling is prevented
--    structurally by a partial unique index: one live order per piece.
--  - Holds are lazy-expired by create-order (no cron needed): a pending
--    order past hold_expires_at is cancelled the next time someone tries
--    to buy that piece.
--  - Only Edge Functions write these tables (service role). Buyers get
--    read-only RLS on their own rows.

do $$ begin
  create type order_status as enum
    ('pending_payment','paid','preparing','shipped','delivered','completed',
     'cancelled','refund_pending','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pay_rail as enum ('stripe','crypto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pay_status as enum
    ('pending','processing','succeeded','failed','orphaned');
exception when duplicate_object then null; end $$;

alter table art_pieces add column if not exists sold_at timestamptz;

-- The v1 database may carry a vestigial 'orders' table from early Stripe
-- experiments (bigint id, never referenced by app code). It is incompatible
-- with the uuid schema below, so move it aside non-destructively.
do $$
declare
  orders_id_type text;
begin
  select data_type into orders_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'orders' and column_name = 'id';
  if orders_id_type is not null and orders_id_type <> 'uuid' then
    alter table orders rename to orders_legacy_v1;
  end if;
end $$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  email text,
  art_piece_id bigint not null references art_pieces (id),
  status order_status not null default 'pending_payment',
  rail pay_rail not null,
  subtotal_cents int not null,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,          -- NJ 6.625% on subtotal+shipping, NJ only
  total_cents int not null,
  shipping_address jsonb not null,           -- snapshot, never a live fk
  hold_expires_at timestamptz,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live order per piece: the structural no-double-sell guarantee.
create unique index if not exists one_active_order_per_piece
  on orders (art_piece_id)
  where status in ('pending_payment','paid','preparing','shipped','delivered','completed');

create index if not exists orders_user_idx on orders (user_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id),
  rail pay_rail not null,
  status pay_status not null default 'pending',
  amount_cents int,
  amount_usdc bigint,                        -- quoted, 6-decimal integer
  received_usdc bigint,
  stripe_session_id text,
  stripe_payment_intent text,
  tx_hash text,
  failure_reason text,
  refund_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_success_per_order
  on payments (order_id) where status = 'succeeded';
create unique index if not exists payments_tx_hash_key
  on payments (tx_hash) where tx_hash is not null;

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  payload jsonb,
  processed_at timestamptz default now(),
  unique (source, external_id)               -- THE idempotency mechanism
);

-- RLS: buyers read their own orders/payments; nobody writes from the client.
alter table orders enable row level security;
alter table payments enable row level security;
alter table webhook_events enable row level security;

drop policy if exists orders_select_own on orders;
create policy orders_select_own on orders
  for select using (auth.uid() = user_id);

drop policy if exists payments_select_own on payments;
create policy payments_select_own on payments
  for select using (
    exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
  );
-- webhook_events: no policies — service role only.
