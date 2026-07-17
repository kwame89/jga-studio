-- Full artwork mirror from Archive Atlas (decision 2026-07-17): Atlas is the
-- source of all artwork data including the sale price (its value doubles as
-- the price). JGA still gates publish. All columns are additive/non-destructive.
--
--  - price_overridden: once an admin sets a price in JGA, re-pushes stop
--    touching it ("JGA edit wins after you set it"). atlas-import checks this
--    before writing the Atlas value; admin-catalog sets it true on a manual
--    price edit.
--  - The structured detail fields let the JGA detail page mirror the Atlas
--    record fully.

alter table art_pieces add column if not exists price_overridden boolean not null default false;
alter table art_pieces add column if not exists edition_number int;
alter table art_pieces add column if not exists edition_total int;
alter table art_pieces add column if not exists signature_notes text;
alter table art_pieces add column if not exists height numeric;
alter table art_pieces add column if not exists width numeric;
alter table art_pieces add column if not exists depth numeric;
alter table art_pieces add column if not exists is_circa boolean;

-- Pieces that already carry a manually-set price should be treated as
-- overridden so the first full-sync re-push doesn't stomp them.
update art_pieces set price_overridden = true where price_usd is not null;
