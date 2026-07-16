-- Public, ordered JGA Studio collections imported from Archive Atlas.
--
-- Atlas owns collection identity and membership. JGA Studio owns publication
-- state, just as it does for individual artwork pricing and publication.

begin;

create table if not exists public.studio_collections (
  id uuid primary key default gen_random_uuid(),
  atlas_collection_id uuid not null unique,
  title text not null,
  description text,
  start_year int,
  end_year int,
  cover_art_piece_id bigint references public.art_pieces (id) on delete set null,
  display_order int not null default 0,
  published_at timestamptz,
  atlas_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_collections_title_not_blank
    check (length(trim(title)) > 0),
  constraint studio_collections_year_order
    check (start_year is null or end_year is null or start_year <= end_year)
);

create index if not exists studio_collections_public_order_idx
  on public.studio_collections (published_at, display_order, created_at);

create table if not exists public.studio_collection_artworks (
  collection_id uuid not null
    references public.studio_collections (id) on delete cascade,
  art_piece_id bigint not null
    references public.art_pieces (id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, art_piece_id),
  constraint studio_collection_artworks_sort_nonnegative
    check (sort_order >= 0)
);

create index if not exists studio_collection_artworks_order_idx
  on public.studio_collection_artworks (collection_id, sort_order, created_at);

alter table public.studio_collections enable row level security;
alter table public.studio_collection_artworks enable row level security;

drop policy if exists studio_collections_public_read
  on public.studio_collections;
create policy studio_collections_public_read
  on public.studio_collections
  for select
  to anon, authenticated
  using (published_at is not null);

drop policy if exists studio_collection_artworks_public_read
  on public.studio_collection_artworks;
create policy studio_collection_artworks_public_read
  on public.studio_collection_artworks
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.studio_collections collection
      where collection.id = studio_collection_artworks.collection_id
        and collection.published_at is not null
    )
    and exists (
      select 1
      from public.art_pieces piece
      where piece.id = studio_collection_artworks.art_piece_id
        and piece.published_at is not null
    )
  );

revoke all on table public.studio_collections
  from public, anon, authenticated;
revoke all on table public.studio_collection_artworks
  from public, anon, authenticated;
grant select on table public.studio_collections
  to anon, authenticated;
grant select on table public.studio_collection_artworks
  to anon, authenticated;
grant select, insert, update, delete on table public.studio_collections
  to service_role;
grant select, insert, update, delete on table public.studio_collection_artworks
  to service_role;

create or replace function public.apply_atlas_collection_manifest(
  p_collection_id uuid,
  p_art_piece_ids bigint[],
  p_cover_art_piece_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_art_piece_ids bigint[] :=
    coalesce(p_art_piece_ids, array[]::bigint[]);
  normalized_cover_id bigint;
begin
  if not exists (
    select 1
    from public.studio_collections
    where id = p_collection_id
  ) then
    raise exception 'Studio collection not found';
  end if;

  if cardinality(normalized_art_piece_ids) = 0 then
    raise exception 'A studio collection must contain at least one artwork';
  end if;

  if (
    select count(*) <> count(distinct art_piece_id)
    from unnest(normalized_art_piece_ids) art_piece_id
  ) then
    raise exception 'A studio collection cannot contain duplicate artworks';
  end if;

  if exists (
    select 1
    from unnest(normalized_art_piece_ids) requested_art_piece_id
    left join public.art_pieces piece
      on piece.id = requested_art_piece_id
    where piece.id is null
  ) then
    raise exception 'One or more studio collection artworks do not exist';
  end if;

  delete from public.studio_collection_artworks
  where collection_id = p_collection_id;

  insert into public.studio_collection_artworks (
    collection_id,
    art_piece_id,
    sort_order
  )
  select p_collection_id, art_piece_id, ordinality::int - 1
  from unnest(normalized_art_piece_ids)
    with ordinality ordered(art_piece_id, ordinality);

  normalized_cover_id :=
    case
      when p_cover_art_piece_id = any(normalized_art_piece_ids)
        then p_cover_art_piece_id
      else normalized_art_piece_ids[1]
    end;

  update public.studio_collections
  set cover_art_piece_id = normalized_cover_id,
      updated_at = now()
  where id = p_collection_id;
end;
$$;

revoke all on function public.apply_atlas_collection_manifest(
  uuid,
  bigint[],
  bigint
) from public, anon, authenticated;
grant execute on function public.apply_atlas_collection_manifest(
  uuid,
  bigint[],
  bigint
) to service_role;

create or replace function public.admin_update_studio_collection(
  p_actor_privy_user_id text,
  p_collection_id uuid,
  p_action text
)
returns public.studio_collections
language plpgsql
security definer
set search_path = public
as $$
declare
  before_collection public.studio_collections;
  after_collection public.studio_collections;
  audit_action text;
begin
  if not exists (
    select 1
    from public.studio_admins
    where privy_user_id = p_actor_privy_user_id
      and enabled
  ) then
    raise exception 'Studio admin access required';
  end if;

  select *
  into before_collection
  from public.studio_collections
  where id = p_collection_id
  for update;

  if not found then
    raise exception 'Studio collection not found';
  end if;

  if p_action = 'publish' then
    if not exists (
      select 1
      from public.studio_collection_artworks membership
      join public.art_pieces piece
        on piece.id = membership.art_piece_id
      where membership.collection_id = p_collection_id
        and piece.published_at is not null
    ) then
      raise exception 'Publish at least one collection artwork first';
    end if;

    update public.studio_collections
    set published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = p_collection_id
    returning * into after_collection;

    audit_action := 'studio_collection.published';
  elsif p_action = 'unpublish' then
    update public.studio_collections
    set published_at = null,
        updated_at = now()
    where id = p_collection_id
    returning * into after_collection;

    audit_action := 'studio_collection.unpublished';
  else
    raise exception 'Unsupported collection action';
  end if;

  insert into public.admin_audit_log (
    actor_privy_user_id,
    action,
    entity_type,
    entity_id,
    before,
    after
  )
  values (
    p_actor_privy_user_id,
    audit_action,
    'studio_collection',
    p_collection_id::text,
    to_jsonb(before_collection),
    to_jsonb(after_collection)
  );

  return after_collection;
end;
$$;

revoke all on function public.admin_update_studio_collection(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_studio_collection(text, uuid, text)
  to service_role;

commit;
