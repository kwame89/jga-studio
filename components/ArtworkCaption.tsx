// The block of text under an artwork thumbnail: studio category, title,
// year · medium, price.
//
// This existed as three near-copies (Home rail, Discover grid, collection
// page), and each one pinned a `minHeight` on the title and meta lines so
// sibling cards would match height. In a masonry/rail layout that only
// stranded whitespace under short titles — the details drifted a full line
// away from the title they belong to. Centralising it here means the spacing
// is defined once, and a new surface (or an artwork pushed in from Archive
// Atlas) renders identically without anyone re-deriving these numbers.
//
// Deliberately no minHeight anywhere: let each caption be as tall as its own
// content.
import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../themeContext';

export type ArtworkCaptionProps = {
  /** Studio category label, shown small and in the accent colour. */
  category?: string | null;
  title: string;
  /** Usually `year · medium`. */
  meta?: string | null;
  /** Preformatted — callers pass formatArtworkPrice(...). */
  price?: string | null;
  /** `large` is the Home rail's bigger type; `default` suits grids. */
  size?: 'default' | 'large';
  /** Wider type on desktop web. */
  desktop?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ArtworkCaption({
  category,
  title,
  meta,
  price,
  size = 'default',
  desktop = false,
  style,
}: ArtworkCaptionProps) {
  const theme = useTheme();
  const styles = createStyles(theme, size, desktop);

  return (
    <View style={[styles.caption, style]}>
      {category ? (
        <Text style={styles.category} numberOfLines={1}>
          {category}
        </Text>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {meta ? (
        <Text style={styles.meta} numberOfLines={2}>
          {meta}
        </Text>
      ) : null}

      {price ? <Text style={styles.price}>{price}</Text> : null}
    </View>
  );
}

const createStyles = (
  theme: ReturnType<typeof useTheme>,
  size: 'default' | 'large',
  desktop: boolean,
) => {
  const large = size === 'large';
  return StyleSheet.create({
    caption: {
      width: '100%',
      minWidth: 0,
    },
    category: {
      color: theme.accent,
      fontSize: large ? 9 : 8,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginTop: 10,
      marginBottom: 3,
    },
    title: {
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: large ? 18 : desktop ? 19 : 16,
      lineHeight: large ? 21 : desktop ? 23 : 19,
    },
    meta: {
      color: theme.text,
      opacity: 0.52,
      fontSize: large ? 10 : desktop ? 11 : 9,
      lineHeight: large ? 15 : desktop ? 17 : 14,
      marginTop: 3,
    },
    price: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '800',
      marginTop: 3,
    },
  });
};
