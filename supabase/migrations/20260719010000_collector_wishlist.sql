-- Saved artworks follow the collector across devices.
--
-- The wishlist began as on-device AsyncStorage, which meant a work saved on a
-- phone was invisible on a laptop and clearing browser data lost it. Storing it
-- on the collector's profile row fixes both.
--
-- Kept as jsonb on collector_profiles rather than its own table: it is a small
-- unordered set read and written whole, always scoped to one collector, and
-- never queried across collectors. A join table would buy nothing here. If
-- saved works ever need querying in aggregate ("most-saved piece"), promote it
-- to its own table then.
--
-- Same access rules as the rest of the row: RLS on with no policies, so only
-- the collector-profile edge function (service role, Privy-verified) can read
-- or write it.

alter table public.collector_profiles
  add column if not exists wishlist jsonb not null default '[]'::jsonb;

comment on column public.collector_profiles.wishlist is
  'Array of saved artworks: [{id, title, image_url, price_usd}]. Written whole by the collector-profile edge function.';

-- Guard against a malformed write turning the column into something the client
-- cannot iterate.
alter table public.collector_profiles
  drop constraint if exists collector_profiles_wishlist_is_array;
alter table public.collector_profiles
  add constraint collector_profiles_wishlist_is_array
  check (jsonb_typeof(wishlist) = 'array');
