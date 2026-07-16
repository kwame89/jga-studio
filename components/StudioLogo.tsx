import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export function StudioLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={[styles.viewport, compact && styles.viewportCompact]}
      accessibilityLabel="JGA Studio"
      accessibilityRole="image"
    >
      <Image
        source={require('../assets/jga-studio-logo.png')}
        style={[styles.image, compact && styles.imageCompact]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width: 114,
    height: 52,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: 132,
    height: 132,
    position: 'absolute',
    top: -36,
    left: -9,
  },
  viewportCompact: {
    width: 92,
    height: 42,
  },
  imageCompact: {
    width: 108,
    height: 108,
    top: -29,
    left: -8,
  },
});
