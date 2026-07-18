// Collector-facing edition labels, mirrored from Archive Atlas
// (src/lib/classification.ts there — keep the two in step).
//
// JGA is a read-only mirror of Atlas for artwork identity, so this file
// deliberately carries no validation: it only formats what Atlas recorded.

export type ArtworkClassification =
  | 'unique'
  | 'limited_edition'
  | 'open_edition'
  | 'unknown_edition';

/**
 * Renders the Edition row, e.g. "Unique" or "Edition 3 of 25".
 *
 * Returns null when there is nothing truthful to say — an unclassified work
 * with no edition numbers shows no Edition row at all, rather than implying
 * it is one of a kind.
 */
export function formatEditionLabel(
  classification: string | null | undefined,
  editionNumber: number | null,
  editionTotal: number | null,
): string | null {
  switch (classification) {
    case 'unique':
      return 'Unique';
    case 'limited_edition':
      return editionNumber
        ? `Edition ${editionNumber} of ${editionTotal}`
        : `Limited edition of ${editionTotal}`;
    case 'open_edition':
      return editionNumber ? `Open edition, no. ${editionNumber}` : 'Open edition';
    case 'unknown_edition':
      return 'Edition size unknown';
    default:
      // Not yet classified upstream: say only what the numbers support.
      return editionNumber && editionTotal
        ? `Edition ${editionNumber} of ${editionTotal}`
        : null;
  }
}
