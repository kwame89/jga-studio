export type StudioCategoryKey = 'illustration' | 'paint' | 'experimental';

export type CategorizedArtwork = {
  art_type?: string | null;
  medium?: string | null;
  tags?: string[] | null;
};

export type StudioCategory = {
  key: StudioCategoryKey;
  label: string;
  shortDescription: string;
  description: string;
};

export const STUDIO_CATEGORIES: StudioCategory[] = [
  {
    key: 'illustration',
    label: 'Illustration',
    shortDescription: 'Line, print, and narrative',
    description:
      'Drawings, prints, and image-led narratives built through line and mark.',
  },
  {
    key: 'paint',
    label: 'Paint',
    shortDescription: 'Canvas, panel, and pigment',
    description:
      'Original paintings shaped through pigment, surface, and layered color.',
  },
  {
    key: 'experimental',
    label: 'Experimental',
    shortDescription: 'Material, process, and form',
    description:
      'Collage, mixed-media, sculptural, and process-driven works that cross boundaries.',
  },
];

const CATEGORY_TERMS: Record<StudioCategoryKey, string[]> = {
  illustration: [
    'illustration',
    'drawing',
    'drawings',
    'print',
    'prints',
    'printmaking',
    'screen print',
    'screenprint',
    'serigraph',
    'etching',
    'lithograph',
    'linocut',
    'woodcut',
    'graphite',
    'charcoal',
    'pencil',
    'ink on paper',
  ],
  paint: [
    'paint',
    'painting',
    'paintings',
    'acrylic',
    'oil on',
    'watercolor',
    'watercolour',
    'gouache',
    'tempera',
    'encaustic',
    'impasto',
  ],
  experimental: [
    'experimental',
    'mixed media',
    'mixed-media',
    'collage',
    'assemblage',
    'installation',
    'sculpture',
    'sculptural',
    'textile',
    'fiber',
    'fibre',
    'found object',
    'digital',
    'video',
    'performance',
  ],
};

const CATEGORY_MATCH_ORDER: StudioCategoryKey[] = [
  'experimental',
  'illustration',
  'paint',
];

const LEGACY_CATEGORY_ALIASES: Record<string, StudioCategoryKey> = {
  illustration: 'illustration',
  illustrations: 'illustration',
  drawing: 'illustration',
  drawings: 'illustration',
  print: 'illustration',
  prints: 'illustration',
  paint: 'paint',
  painting: 'paint',
  paintings: 'paint',
  experimental: 'experimental',
  'mixed media': 'experimental',
};

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryFromText(
  value: string | null | undefined,
): StudioCategoryKey | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  for (const categoryKey of CATEGORY_MATCH_ORDER) {
    if (
      CATEGORY_TERMS[categoryKey].some((term) =>
        normalized.includes(normalize(term)),
      )
    ) {
      return categoryKey;
    }
  }
  return null;
}

function explicitCategoryFromTags(
  tags: string[] | null | undefined,
): StudioCategoryKey | null {
  for (const tag of tags ?? []) {
    const normalized = normalize(tag)
      .replace(/^#/, '')
      .replace(/^(jga|category)\s*:\s*/, '')
      .trim();
    const exact = LEGACY_CATEGORY_ALIASES[normalized];
    if (exact) return exact;
  }
  return null;
}

export function getStudioCategory(
  artwork: CategorizedArtwork,
): StudioCategoryKey {
  const explicitTag = explicitCategoryFromTags(artwork.tags);
  if (explicitTag) return explicitTag;

  const artTypeCategory = categoryFromText(artwork.art_type);
  if (artTypeCategory) return artTypeCategory;

  for (const tag of artwork.tags ?? []) {
    const tagCategory = categoryFromText(tag);
    if (tagCategory) return tagCategory;
  }

  return categoryFromText(artwork.medium) ?? 'experimental';
}

export function getStudioCategoryDefinition(
  key: StudioCategoryKey,
): StudioCategory {
  return (
    STUDIO_CATEGORIES.find((category) => category.key === key) ??
    STUDIO_CATEGORIES[2]
  );
}

export function parseStudioCategory(
  value: string | string[] | undefined,
): StudioCategoryKey | 'all' {
  const candidate = normalize(Array.isArray(value) ? value[0] : value);
  if (!candidate || candidate === 'all') return 'all';
  return LEGACY_CATEGORY_ALIASES[candidate] ?? 'all';
}
