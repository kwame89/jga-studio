import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * The studio wordmark. Links to Home unless `link={false}`.
 *
 * HISTORY: an earlier attempt wrapped this in an expo-router `<Link asChild>`
 * and crashed React Native Web at render with "Failed to set an indexed
 * property [0] on CSSStyleDeclaration" — and because the logo sits in every
 * header, it took down the whole app at startup, not just the header (see the
 * revert in 78c5f19). The `asChild` anchor path was the trigger, hit with both
 * Pressable and TouchableOpacity as the child.
 *
 * This reintroduces the link WITHOUT `Link`: a plain TouchableOpacity, which
 * renders a div on web — the same element every other button in the app uses —
 * driven by an imperative router.push. That avoids the anchor/style path that
 * broke before. Verified on the local dev server against a non-home screen.
 */
export function StudioLogo({
  compact = false,
  link = true,
}: {
  compact?: boolean;
  link?: boolean;
}) {
  const router = useRouter();

  const mark = (
    <View style={[styles.viewport, compact && styles.viewportCompact]}>
      <Image
        source={require('../assets/jga-studio-logo.png')}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );

  // Non-linking placements (e.g. the empty-hero on Home, where linking to Home
  // is pointless) render the plain mark.
  if (!link) {
    return (
      <View accessibilityLabel="JGA Studio" accessibilityRole="image">
        {mark}
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => router.push('/')}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel="JGA Studio — go to Home"
    >
      {mark}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width: 140,
    height: 70,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  viewportCompact: {
    width: 112,
    height: 56,
  },
});
