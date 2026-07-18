import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * The studio wordmark.
 *
 * NOTE: this deliberately does NOT link Home right now. Wrapping it in an
 * expo-router `Link` (tried with both Pressable and TouchableOpacity)
 * crashes React Native Web during render with "Failed to set an indexed
 * property [0] on CSSStyleDeclaration", which takes down the entire app at
 * startup rather than degrading the header. Linking the logo needs to be
 * reintroduced against a local repro, not straight to production.
 *
 * The `link` prop is accepted and ignored so call sites do not have to
 * change when it comes back.
 */
export function StudioLogo({
  compact = false,
  link: _link = true,
}: {
  compact?: boolean;
  link?: boolean;
}) {
  return (
    <View
      style={[styles.viewport, compact && styles.viewportCompact]}
      accessibilityLabel="JGA Studio"
      accessibilityRole="image"
    >
      <Image
        source={require('../assets/jga-studio-logo.png')}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
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
