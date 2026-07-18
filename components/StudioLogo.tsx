import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';

/**
 * The studio wordmark. It links Home by default — a masthead logo is the
 * one navigation control web visitors expect to always work, and it appears
 * in the header of every screen.
 *
 * Pass `link={false}` where the logo is decorative (e.g. on Home itself, or
 * anywhere it already sits inside a Link).
 */
export function StudioLogo({
  compact = false,
  link = true,
}: {
  compact?: boolean;
  link?: boolean;
}) {
  const mark = (
    <Image
      source={require('../assets/jga-studio-logo.png')}
      style={styles.image}
      resizeMode="cover"
    />
  );

  if (!link) {
    return (
      <View
        style={[styles.viewport, compact && styles.viewportCompact]}
        accessibilityLabel="JGA Studio"
        accessibilityRole="image"
      >
        {mark}
      </View>
    );
  }

  // TouchableOpacity, not Pressable: `Link asChild` around a Pressable
  // crashes React Native Web at startup ("Failed to set an indexed property
  // on CSSStyleDeclaration"), because Pressable's function-style prop does
  // not survive the clone. TouchableOpacity is the pairing already used
  // elsewhere in this app (see the Discover grid).
  return (
    <Link href="/(tabs)" asChild>
      <TouchableOpacity
        style={[styles.viewport, compact && styles.viewportCompact]}
        accessibilityLabel="JGA Studio — go to the home page"
        accessibilityRole="link"
        activeOpacity={0.75}
      >
        {mark}
      </TouchableOpacity>
    </Link>
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
