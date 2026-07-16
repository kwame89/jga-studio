-- Secure JGA Studio catalog administration.
--
-- Privy authenticates the person in the app. This allowlist is the
-- server-side authorization source of truth for commerce controls; the
-- collector_wallets.is_admin column is not trusted for authorization.

begin;

create table if not exists public.studio_admins (
  privy_user_id text primary key,
  display_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.studio_admins is
  'Server-only allowlist of Privy identities authorized to manage the JGA Studio catalog.';

alter table public.studio_admins enable row level security;

revoke all on table public.studio_admins from public, anon, authenticated;
grant select, insert, update, delete on table public.studio_admins to service_role;

-- Jay Golding's current Privy identity. Additional admins must be added
-- deliberately through a database migration or other service-role process.
insert into public.studio_admins (privy_user_id, display_name, enabled)
values ('did:privy:cmo8edaql01j40dl2mzp0278g', 'Jay Golding', true)
on conflict (privy_user_id) do update
set display_name = excluded.display_name,
    enabled = excluded.enabled,
    updated_at = now();

alter table public.admin_audit_log
  add column if not exists actor_privy_user_id text;

-- Keep the legacy collector flag non-authoritative and prevent browser
-- clients from elevating it. The studio_admins table above is authoritative.
create or replace function public.protect_collector_admin_flag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.is_admin := false;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.collector_wallets') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'collector_wallets'
        and column_name = 'is_admin'
    )
  then
    execute 'drop trigger if exists protect_collector_admin_flag_trigger
      on public.collector_wallets';
    execute 'create trigger protect_collector_admin_flag_trigger
      before insert or update on public.collector_wallets
      for each row
      execute function public.protect_collector_admin_flag()';
  end if;
end;
$$;

create or replace function public.admin_update_catalog_item(
  p_actor_privy_user_id text,
  p_art_piece_id bigint,
  p_action text,
  p_price_usd numeric default null
)
returns public.art_pieces
language plpgsql
security definer
set search_path = public
as $$
declare
  before_piece public.art_pieces;
  after_piece public.art_pieces;
  effective_price numeric;
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
  into before_piece
  from public.art_pieces
  where id = p_art_piece_id
  for update;

  if not found then
    raise exception 'Artwork not found';
  end if;

  if p_action = 'set_price' then
    if p_price_usd is not null and p_price_usd <= 0 then
      raise exception 'Price must be greater than zero';
    end if;

    update public.art_pieces
    set price_usd = p_price_usd
    where id = p_art_piece_id
    returning * into after_piece;

    audit_action := 'catalog.price_updated';
  elsif p_action = 'publish' then
    effective_price := coalesce(p_price_usd, before_piece.price_usd);

    if effective_price is null or effective_price <= 0 then
      raise exception 'Set a price greater than zero before publishing';
    end if;
    if nullif(trim(coalesce(before_piece.image_url, '')), '') is null then
      raise exception 'Add an artwork image before publishing';
    end if;

    update public.art_pieces
    set price_usd = effective_price,
        published_at = coalesce(published_at, now())
    where id = p_art_piece_id
    returning * into after_piece;

    audit_action := 'catalog.published';
  elsif p_action = 'unpublish' then
    update public.art_pieces
    set published_at = null
    where id = p_art_piece_id
    returning * into after_piece;

    audit_action := 'catalog.unpublished';
  else
    raise exception 'Unsupported catalog action';
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
    'art_piece',
    p_art_piece_id::text,
    to_jsonb(before_piece),
    to_jsonb(after_piece)
  );

  return after_piece;
end;
$$;

revoke all on function public.admin_update_catalog_item(text, bigint, text, numeric)
  from public, anon, authenticated;
grant execute on function public.admin_update_catalog_item(text, bigint, text, numeric)
  to service_role;

commit;
