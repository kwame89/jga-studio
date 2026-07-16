-- Preserve Archive Atlas taxonomy fields so JGA Studio can place each work
-- in its artist-authored Illustration, Paint, or Experimental category.

alter table public.art_pieces
  add column if not exists art_type text,
  add column if not exists subject_matter text;
