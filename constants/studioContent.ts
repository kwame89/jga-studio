// Studio-authored content for the artist-first home screen and the artwork
// price tiers, kept in one editable place (per docs/08 — Malcolm's beta
// feedback: lead with the artist, and use named price tiers instead of raw
// dollar bands).
//
// EDIT THIS FILE to change the copy — everything here is plain text/numbers.
// The artist statement below is Jay's own words.

export type StudioSeries = {
  key: string;
  title: string;
  blurb: string;
  discoverCategory: 'illustration' | 'paint' | 'experimental';
};

export const STUDIO = {
  artistName: 'Jay Golding',

  // One-line welcome shown in the Home header, orienting first-time visitors
  // to what JGA Studio is.
  welcome:
    'The living archive and gallery of artist Jay Golding — every original documented, from the studio to your wall.',

  // One-line positioning shown under the artist name at the top of Home.
  tagline: 'Paintings of dreams and visions — migration, heritage, and mythology.',

  // Short third-person bio (the factual "who"), in Jay's own words.
  bio:
    'Jay Golding is a Jamaican-born descendant of the Accompong Maroons raised in the ' +
    'U.S., more specifically, immigrating to New Jersey at the age of seven. Jay’s work ' +
    'focuses primarily on realistic figurative portraits, typically set in landscaped and ' +
    'natural settings. He often creates vibrant paintings and drawings that explore ' +
    'indigenous cultures, mythology, and his personal migration story. Using acrylics, ' +
    'oils, and occasionally collage or impasto, Golding infuses Caribbean and African ' +
    'motifs to draw parallels between these communities. His transformative trips to ' +
    'places like Ghana and Mexico have deeply influenced his layered, symbolic work. Jay ' +
    'earned his BFA in Studio Art from Kean University in 2015.',

  // Artist statement, in Jay's own words. Each string is one paragraph.
  statement: [
    'My art is like painting dreams or visions onto the canvas. I pull inspiration ' +
      'from migration, the meeting of tribal cultures, my own heritage, mythology, and ' +
      'those fleeting, in-between states of mind. Childhood memories shape the dreamlike ' +
      'quality in some of my pieces—especially one vivid moment from when I was six, ' +
      'living in Jamaica. I watched my uncle sketch cars straight from his imagination, ' +
      'and something clicked. That day, I drew my first portrait, and I’ve been creating ' +
      'ever since. It’s one of the few bright spots I held onto from my early years before ' +
      'moving to the United States—a thread that keeps my connection to my birthplace ' +
      'alive and untainted.',
    'Traveling to places like Ethiopia, Ghana, and Mexico has deepened my work, too. ' +
      'The symbols and icons from those cultures, along with my own research, show up ' +
      'more and more in my paintings. Artists like Frida Kahlo, Caravaggio, Pablo Picasso, ' +
      'Ernie Barnes, Andrew Wyeth, Norman Rockwell, John Singer Sargent, Paul Gauguin, ' +
      'Van Gogh, and recently Wangechi Mutu have all left their mark on how I see and ' +
      'make art.',
    'No matter the subject, my aim is to capture an emotion or a raw, unguarded moment. ' +
      'These days, I’m pushing to be more real and open in my practice—letting the viewer ' +
      'in on something true.',
  ],

  // The series breakdown Malcolm asked for: illustration → paint → experimental.
  // Order here is the order shown on Home.
  series: [
    {
      key: 'illustration',
      title: 'Illustration',
      blurb: 'Line, character, and narrative work — drawings and prints.',
      discoverCategory: 'illustration',
    },
    {
      key: 'paint',
      title: 'Paint',
      blurb: 'Original paintings on canvas and panel.',
      discoverCategory: 'paint',
    },
    {
      key: 'experimental',
      title: 'Experimental',
      blurb: 'Mixed-media and process-driven pieces that break the frame.',
      discoverCategory: 'experimental',
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
  // An unpriced work ("Price on request") belongs to no band. Coercing null to
  // 0 filed every one of them under Affordable, which is both wrong and the
  // opposite of the intent — those are the works with no public price at all.
  if (priceUsd === null || priceUsd === undefined) return false;
  const price = Number(priceUsd);
  if (!Number.isFinite(price)) return false;
  return price >= tier.min && (tier.max === null || price < tier.max);
}

/** Reads a `?tier=` route param, falling back to 'all' for anything unknown. */
export function parsePriceTier(value: string | string[] | undefined): PriceTierKey {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
  if (!candidate) return 'all';
  return PRICE_TIERS.find((tier) => tier.key === candidate)?.key ?? 'all';
}
