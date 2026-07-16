-- Keeps new Archive Atlas imports private until JGA Studio publishes them,
-- and applies each copied image manifest as one database transaction.

alter table public.art_pieces
  add column if not exists published_at timestamptz;

-- These works were already visible before published_at existed. Preserve that
-- behavior while future imports continue to default to unpublished (null).
update public.art_pieces
set published_at = coalesce(created_at, now())
where atlas_artwork_id is not null
  and published_at is null;

alter table public.art_pieces enable row level security;

-- Replace any legacy public-read policy. Service-role Edge Functions bypass
-- RLS, while collector-facing clients can only read published pieces.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'art_pieces'
      and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy %I on public.art_pieces', policy_record.policyname);
  end loop;
end
$$;

create policy art_pieces_public_read_published
  on public.art_pieces
  for select
  to anon, authenticated
  using (published_at is not null);

-- Do not expose image-manifest rows for unpublished pieces through PostgREST.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'art_images'
      and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy %I on public.art_images', policy_record.policyname);
  end loop;
end
$$;

create policy art_images_public_read_published
  on public.art_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.art_pieces piece
      where piece.id = art_images.art_piece_id
        and piece.published_at is not null
    )
  );

-- The Edge Function uploads any new files first, then calls this function to
-- atomically reconcile rows, primary status, ordering, and the v1 image_url.
create or replace function public.apply_atlas_image_manifest(
  p_art_piece_id bigint,
  p_images jsonb,
  p_primary_public_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  image_record jsonb;
begin
  if jsonb_typeof(coalesce(p_images, '[]'::jsonb)) <> 'array' then
    raise exception 'p_images must be a JSON array';
  end if;

  if not exists (
    select 1 from public.art_pieces where id = p_art_piece_id
  ) then
    raise exception 'art piece % does not exist', p_art_piece_id;
  end if;

  -- Demote first so changing or replacing the primary cannot collide with the
  -- one-primary partial unique index.
  update public.art_images
  set is_primary = false
  where art_piece_id = p_art_piece_id
    and is_primary;

  for image_record in
    select value
    from jsonb_array_elements(coalesce(p_images, '[]'::jsonb))
  loop
    update public.art_images
    set storage_path = image_record->>'storage_path',
        public_url = image_record->>'public_url',
        source_url = image_record->>'source_url',
        sort_order = (image_record->>'sort_order')::int,
        is_primary = coalesce((image_record->>'is_primary')::boolean, false),
        alt_text = image_record->>'alt_text'
    where art_piece_id = p_art_piece_id
      and content_hash = image_record->>'content_hash';

    if not found then
      insert into public.art_images (
        art_piece_id,
        storage_path,
        public_url,
        source_url,
        content_hash,
        sort_order,
        is_primary,
        alt_text
      )
      values (
        p_art_piece_id,
        image_record->>'storage_path',
        image_record->>'public_url',
        image_record->>'source_url',
        image_record->>'content_hash',
        (image_record->>'sort_order')::int,
        coalesce((image_record->>'is_primary')::boolean, false),
        image_record->>'alt_text'
      );
    end if;
  end loop;

  delete from public.art_images existing_image
  where existing_image.art_piece_id = p_art_piece_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_images, '[]'::jsonb)) manifest(image)
      where manifest.image->>'content_hash' = existing_image.content_hash
    );

  update public.art_pieces
  set image_url = p_primary_public_url
  where id = p_art_piece_id;
end;
$$;

revoke all on function public.apply_atlas_image_manifest(bigint, jsonb, text) from public;
revoke all on function public.apply_atlas_image_manifest(bigint, jsonb, text) from anon;
revoke all on function public.apply_atlas_image_manifest(bigint, jsonb, text) from authenticated;
grant execute on function public.apply_atlas_image_manifest(bigint, jsonb, text) to service_role;
