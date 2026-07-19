// Sharing a work outward — the promotional path, so it has to land somewhere
// useful rather than silently do nothing.
//
// Web: the native share sheet where the browser offers one (iOS/Android
// Safari and Chrome), falling back to copying the link. navigator.share is
// absent on desktop browsers and throws AbortError when the user dismisses the
// sheet, which is a cancellation, not a failure.
//
// Native: React Native's Share.
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

const SITE_URL = 'https://jgastudio.art';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

export type ShareArtworkInput = {
  id: number | string;
  title: string;
  year?: number | string | null;
  medium?: string | null;
};

export function artworkUrl(id: number | string) {
  return `${SITE_URL}/artwork/${id}`;
}

export async function shareArtwork({
  id,
  title,
  year,
  medium,
}: ShareArtworkInput): Promise<ShareOutcome> {
  const url = artworkUrl(id);
  const detail = [year, medium].filter(Boolean).join(' · ');
  const message = detail
    ? `${title} — ${detail}, by Jay Golding`
    : `${title} — by Jay Golding`;

  if (Platform.OS === 'web') {
    const nav =
      typeof navigator === 'undefined'
        ? undefined
        : (navigator as Navigator & {
            share?: (data: ShareData) => Promise<void>;
          });

    if (nav?.share) {
      try {
        await nav.share({ title, text: message, url });
        return 'shared';
      } catch (error) {
        // Dismissing the sheet is not an error worth surfacing.
        if ((error as Error)?.name === 'AbortError') return 'cancelled';
        // Anything else falls through to the clipboard so the collector still
        // ends up with something they can paste.
      }
    }

    await Clipboard.setStringAsync(url);
    return 'copied';
  }

  const result = await Share.share({
    title,
    message: `${message}\n${url}`,
    url,
  });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
