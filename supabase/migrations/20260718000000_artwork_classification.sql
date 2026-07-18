-- Mirror Archive Atlas's artwork classification (Atlas migration 0025).
--
-- The detail page inferred the edition label from edition_number and
-- edition_total alone, so a work with both blank rendered nothing at all —
-- indistinguishable from a work whose edition was never recorded. Atlas now
-- records the distinction explicitly and pushes it here.
--
-- Values: unique | limited_edition | open_edition | unknown_edition.
-- Null means Atlas has not recorded it yet, which stays deliberately
-- distinct from 'unique' (a positive claim that the work is one of a kind).

alter table public.art_pieces
  add column if not exists classification text;

comment on column public.art_pieces.classification is
  'Mirrored from Archive Atlas (artworks.classification). Null = not yet '
  'recorded upstream; never defaulted, since it is a provenance claim.';

-- No check constraint here on purpose: Atlas owns the validation, and this
-- table is a mirror. A constraint would turn an upstream data change into a
-- failed import rather than a synced value.
