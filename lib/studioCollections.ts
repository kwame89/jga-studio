import { supabase } from '../supabaseClient';

export type StudioArtwork = {
  id: number;
  title: string;
  image_url: string | null;
  price_usd: number | null;
  medium: string | null;
  art_type: string | null;
  subject_matter: string | null;
  tags: string[];
  year: number | null;
};

export type StudioCollection = {
  id: string;
  title: string;
  description: string | null;
  start_year: number | null;
  end_year: number | null;
  cover_art_piece_id: number | null;
  published_at: string;
  artworks: StudioArtwork[];
  cover: StudioArtwork | null;
};

type CollectionRow = Omit<StudioCollection, 'artworks' | 'cover'>;

async function loadPublishedCollections(
  collectionId?: string,
): Promise<StudioCollection[]> {
  let collectionQuery = supabase
    .from('studio_collections')
    .select(
      'id, title, description, start_year, end_year, cover_art_piece_id, published_at',
    )
    .not('published_at', 'is', null)
    .order('display_order', { ascending: true })
    .order('published_at', { ascending: false });

  if (collectionId) {
    collectionQuery = collectionQuery.eq('id', collectionId);
  }

  const { data: collectionData, error: collectionError } =
    await collectionQuery;
  if (collectionError) throw collectionError;

  const collections = (collectionData ?? []) as CollectionRow[];
  if (collections.length === 0) return [];

  const collectionIds = collections.map((collection) => collection.id);
  const { data: membershipData, error: membershipError } = await supabase
    .from('studio_collection_artworks')
    .select('collection_id, art_piece_id, sort_order')
    .in('collection_id', collectionIds)
    .order('sort_order', { ascending: true });
  if (membershipError) throw membershipError;

  const memberships = membershipData ?? [];
  const pieceIds = [...new Set(memberships.map((row) => row.art_piece_id))];
  if (pieceIds.length === 0) {
    return [];
  }

  const { data: artworkData, error: artworkError } = await supabase
    .from('art_pieces')
    .select('*')
    .in('id', pieceIds)
    .not('published_at', 'is', null);
  if (artworkError) throw artworkError;

  const artworkById = new Map(
    ((artworkData ?? []) as StudioArtwork[]).map((artwork) => [
      artwork.id,
      artwork,
    ]),
  );

  return collections
    .map((collection) => {
      const artworks = memberships
        .filter((membership) => membership.collection_id === collection.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((membership) => artworkById.get(membership.art_piece_id))
        .filter((artwork): artwork is StudioArtwork => Boolean(artwork));
      const cover =
        (collection.cover_art_piece_id
          ? artworkById.get(collection.cover_art_piece_id)
          : null) ??
        artworks[0] ??
        null;

      return { ...collection, artworks, cover };
    })
    .filter((collection) => collection.artworks.length > 0);
}

export function listPublishedCollections(): Promise<StudioCollection[]> {
  return loadPublishedCollections();
}

export async function getPublishedCollection(
  collectionId: string,
): Promise<StudioCollection | null> {
  const collections = await loadPublishedCollections(collectionId);
  return collections[0] ?? null;
}

export async function listPublishedArtworks(): Promise<StudioArtwork[]> {
  const { data, error } = await supabase
    .from('art_pieces')
    .select('*')
    .not('atlas_artwork_id', 'is', null)
    .not('published_at', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudioArtwork[];
}

export function formatCollectionYears(
  collection: Pick<StudioCollection, 'start_year' | 'end_year'>,
) {
  if (collection.start_year && collection.end_year) {
    return collection.start_year === collection.end_year
      ? String(collection.start_year)
      : `${collection.start_year}–${collection.end_year}`;
  }
  if (collection.start_year) return `${collection.start_year}–present`;
  if (collection.end_year) return `Through ${collection.end_year}`;
  return 'Ongoing';
}

export function formatArtworkPrice(price: number | null) {
  if (price === null || !Number.isFinite(Number(price))) {
    return 'Price on request';
  }
  return `$${Number(price).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}
