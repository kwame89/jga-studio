-- JGA Studio presents a read-only provenance snapshot synchronized from
-- Archive Atlas. Archive Atlas remains the source of truth.

alter table public.art_pieces
  add column if not exists provenance_events jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'art_pieces_provenance_events_array'
      and conrelid = 'public.art_pieces'::regclass
  ) then
    alter table public.art_pieces
      add constraint art_pieces_provenance_events_array
      check (jsonb_typeof(provenance_events) = 'array');
  end if;
end
$$;

comment on column public.art_pieces.provenance_events is
  'Read-only public provenance snapshot synchronized from Archive Atlas.';
