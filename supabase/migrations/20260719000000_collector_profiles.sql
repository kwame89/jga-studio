-- Collector profiles: a display name and avatar a signed-in collector sets
-- themselves.
--
-- Buyers authenticate with Privy, not Supabase Auth, so there is no auth.uid()
-- to hang own-row RLS on. Same shape as orders: the table is service-role only
-- and the collector-profile Edge Function (which verifies the Privy token) is
-- the sole read/write path.

create table if not exists public.collector_profiles (
  -- Privy DID, e.g. did:privy:cmo8edaql01j40dl2mzp0278g
  privy_did      text primary key,
  display_name   text,
  avatar_url     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.collector_profiles is
  'Self-serve collector display name and avatar, keyed by Privy DID. Written only by the collector-profile edge function.';

-- Keep a display name sane without being precious about it; the UI trims and
-- length-checks too, this is the backstop.
alter table public.collector_profiles
  drop constraint if exists collector_profiles_display_name_len;
alter table public.collector_profiles
  add constraint collector_profiles_display_name_len
  check (display_name is null or char_length(display_name) between 1 and 60);

alter table public.collector_profiles enable row level security;

-- No policies on purpose: with RLS enabled and no policy, anon and authenticated
-- get nothing. The service role bypasses RLS, so only the edge function reads
-- or writes here. This deliberately keeps the collector list from being
-- enumerable by anyone holding the anon key.

create or replace function public.touch_collector_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists collector_profiles_touch_updated_at on public.collector_profiles;
create trigger collector_profiles_touch_updated_at
  before update on public.collector_profiles
  for each row execute function public.touch_collector_profiles_updated_at();

-- Avatar storage --------------------------------------------------------------
-- Public read so <Image source={{ uri }} /> works without signing every URL;
-- avatars are not sensitive. Writes are service-role only (no insert/update
-- policy below), so a collector cannot upload directly with the anon key —
-- everything goes through the edge function, which namespaces the object under
-- the caller's own DID.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');
