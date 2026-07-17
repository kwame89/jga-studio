-- The app authenticates buyers with Privy, not Supabase auth, so orders are
-- keyed by the Privy user id (text did:privy:…) instead of auth.users. With
-- no Supabase JWT there is nothing for own-row RLS to match — order reads go
-- through the get-order Edge Function (Privy-verified) and RLS stays enabled
-- with no policies (service-role only).

drop policy if exists orders_select_own on orders;
drop policy if exists payments_select_own on payments;

alter table orders drop constraint if exists orders_user_id_fkey;
alter table orders alter column user_id type text using user_id::text;
