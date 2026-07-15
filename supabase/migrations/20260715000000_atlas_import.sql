-- Archive Atlas integration (docs/09-archive-atlas-integration.md).
-- Adds the Atlas linkage columns to the existing v1 art_pieces table, an
-- art_images table for the multi-image manifest, a minimal admin_audit_log,
-- and the storage bucket imports copy images into.
--
-- Written against the current v1 schema (art_pieces.id is the Supabase
-- default bigint identity; single image_url column; price_usd). The beta 2
-- rebuild (docs/03) supersedes parts of this — every statement is guarded so
-- the migration is safe to run on either shape.

create extension if not exists pgcrypto;

-- Atlas linkage + identity fields Atlas pushes that v1 didn't have yet.
alter table art_pieces add column if not exists atlas_artwork_id uuid;
alter table art_pieces add column if not exists atlas_synced_at timestamptz;
alter table art_pieces add column if not exists provenance_url text;
alter table art_pieces add column if not exists description text;
alter table art_pieces add column if not exists dimensions text;
alter table art_pieces add column if not exists year int;
alter table art_pieces add column if not exists tags text[] not null default '{}';

create unique index if not exists art_pieces_atlas_artwork_id_key
  on art_pieces (atlas_artwork_id)
  where atlas_artwork_id is not null;

-- Multi-image manifest (docs/03 art_images, adapted to v1's bigint ids).
-- source_url/content_hash exist so re-pushes from Atlas can diff instead of
-- re-copying: same hash = unchanged, missing from manifest = remove.
create table if not exists art_images (
  id uuid primary key default gen_random_uuid(),
  art_piece_id bigint not null references art_pieces (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  source_url text,
  content_hash text,
  media_kind text not null default 'image',
  sort_order int not null default 0,
  is_primary boolean not null default false,
  alt_text text,
  created_at timestamptz not null default now()
);

create unique index if not exists art_images_one_primary_per_piece
  on art_images (art_piece_id)
  where is_primary;

alter table art_images enable row level security;

drop policy if exists art_images_select on art_images;
create policy art_images_select on art_images
  for select
  using (true);
-- No insert/update/delete policies: writes go through Edge Functions
-- (service role) only, per docs/02.

-- Minimal audit log (docs/03 shape; entity_id is text because v1 mixes
-- bigint and uuid primary keys).
create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_collector_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  reason text,
  denied boolean not null default false,
  created_at timestamptz not null default now()
);

alter table admin_audit_log enable row level security;
-- No policies at all: service-role access only.

-- Public bucket the import copies Atlas images into.
insert into storage.buckets (id, name, public)
values ('artwork', 'artwork', true)
on conflict (id) do nothing;
