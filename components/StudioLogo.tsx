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
