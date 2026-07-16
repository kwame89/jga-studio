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
  tagline: 'Paintings of dreams and visions — migration, heritage, and mythology.',

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
