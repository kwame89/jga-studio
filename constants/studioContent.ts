// Studio-authored content for the artist-first home screen and the artwork
// price tiers, kept in one editable place (per docs/08 — Malcolm's beta
// feedback: lead with the artist, and use named price tiers instead of raw
// dollar bands).
//
// EDIT THIS FILE to change the copy — everything here is plain text/numbers.
// The bio and statement below are PLACEHOLDERS written in a neutral voice;
// replace them with Jay's own words.

export type StudioSeries = {
  key: string;
  title: string;
  blurb: string;
  // Mediums (as stored on art_pieces.medium) that belong to this series;
  // used to link a series to its works on Discover.
  mediums: string[];
  // Which Discover category chip a series card opens (Discover filters by a
  // single medium category). Best-fit; an approximation for multi-medium
  // series like Illustration.
  discoverCategory: 'Paintings' | 'Mixed Media' | 'Prints' | 'Drawings';
};

export const STUDIO = {
  artistName: 'Jay Golding',

  // One-line positioning shown under the artist name at the top of Home.
  tagline: 'Artist-run studio — paintings, works on paper, and experimental pieces.',

  // Short artist statement (the "why"). 1–3 sentences reads best here.
  // PLACEHOLDER — replace with Jay's real statement.
  statement:
    'JGA Studio is where I make and keep my work — an archive and a gallery in one. ' +
    'Each piece is documented from the moment it’s made, so its story travels with it.',

  // Longer bio (the "who"). A short paragraph.
  // PLACEHOLDER — replace with Jay's real bio.
  bio:
    'Jay Golding is a multidisciplinary artist working across painting, illustration, ' +
    'and mixed media. This studio brings the full body of work together in one place, ' +
    'from finished collectible pieces to experimental studies.',

  // The series breakdown Malcolm asked for: illustration → paint → experimental.
  // Order here is the order shown on Home.
  series: [
    {
      key: 'illustration',
      title: 'Illustration',
      blurb: 'Line, character, and narrative work — drawings and prints.',
      mediums: ['Drawing', 'Drawings', 'Print', 'Prints', 'Illustration'],
      discoverCategory: 'Drawings',
    },
    {
      key: 'paint',
      title: 'Paint',
      blurb: 'Original paintings on canvas and panel.',
      mediums: ['Painting', 'Paintings'],
      discoverCategory: 'Paintings',
    },
    {
      key: 'experimental',
      title: 'Experimental',
      blurb: 'Mixed-media and process-driven pieces that break the frame.',
      mediums: ['Mixed Media', 'mixed media', 'Mixed media', 'Experimental'],
      discoverCategory: 'Mixed Media',
    },
  ] as StudioSeries[],
} as const;

// --- Price tiers (docs/08 §4) ----------------------------------------------
// Bands are in whole US dollars (v1 art_pieces.price_usd is dollars).
// Labels are marketing-facing and can be renamed freely.

export type PriceTierKey = 'all' | 'affordable' | 'expensive' | 'luxurious';

export type PriceTier = {
  key: PriceTierKey;
  label: string;
  // Inclusive lower bound, exclusive upper bound (null = no upper bound).
  min: number;
  max: number | null;
};

export const PRICE_TIERS: PriceTier[] = [
  { key: 'all', label: 'All', min: 0, max: null },
  { key: 'affordable', label: 'Affordable', min: 0, max: 500 },
  { key: 'expensive', label: 'Expensive', min: 500, max: 5000 },
  { key: 'luxurious', label: 'Luxurious', min: 5000, max: null },
];

export function priceInTier(priceUsd: number | null | undefined, key: PriceTierKey): boolean {
  if (key === 'all') return true;
  const tier = PRICE_TIERS.find((t) => t.key === key);
  if (!tier) return true;
  const price = Number(priceUsd || 0);
  return price >= tier.min && (tier.max === null || price < tier.max);
}
