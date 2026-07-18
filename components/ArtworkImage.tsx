// Renders an artwork thumbnail at the image's OWN aspect ratio.
//
// The grid previously forced every card into a fixed 0.8 frame with a tinted
// backdrop and resizeMode="contain", which letterboxed anything that wasn't
// 4:5 — the grey bars read as padding around the work. Galleries (Artsy et
// al.) instead let the file dictate the card's shape: a photo shot against a
// white wall shows that white, and a scan cropped to the canvas edge sits
// flush, with no studio-imposed frame either way.
//
// We have no pixel dimensions in the DB (art_images stores no width/height),
// so the ratio is measured at runtime with Image.getSize and cached
// module-wide — the same URL is measured once per session, not once per
// render or per grid.

import React, { useEffect, useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

const ratioCache = new Map<string, number>();

/** Shape used before measurement lands, matching the old grid so nothing jumps far. */
const FALLBACK_RATIO = 0.8;

export function ArtworkImage({
  uri,
  style,
  radius = 4,
}: {
  uri: string | null | undefined;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const [ratio, setRatio] = useState<number | null>(
    uri ? ratioCache.get(uri) ?? null : null
  );

  useEffect(() => {
    if (!uri) return;
    const cached = ratioCache.get(uri);
    if (cached) {
      setRatio(cached);
      return;
    }
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (!alive || !w || !h) return;
        const r = w / h;
        ratioCache.set(uri, r);
        setRatio(r);
      },
      // A measurement failure must not blank the card; the fallback shape
      // still renders the image.
      () => {
        if (alive) setRatio(FALLBACK_RATIO);
      }
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  return (
    <View
      style={[
        { width: '100%', aspectRatio: ratio ?? FALLBACK_RATIO, borderRadius: radius, overflow: 'hidden' },
        style,
      ]}
    >
      {!!uri && (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          // Once the frame matches the file's ratio, cover and contain agree;
          // cover just avoids hairline gaps from rounding.
          resizeMode="cover"
        />
      )}
    </View>
  );
}
