import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StudioLogo } from './StudioLogo';

export function StudioMasthead({
  desktop = false,
  eyebrow,
  title,
  action,
}: {
  desktop?: boolean;
  eyebrow?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={[styles.masthead, desktop && styles.mastheadDesktop]}>
      <StudioLogo compact={!desktop} />
      {title ? (
        <View style={styles.copy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
        </View>
      ) : (
        <View style={styles.spacer} />
      )}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: {
    minHeight: 94,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#080709',
    borderBottomWidth: 1,
    borderBottomColor: '#2A1E34',
  },
  mastheadDesktop: {
    minHeight: 104,
    paddingHorizontal: 42,
    paddingVertical: 16,
  },
  spacer: {
    flex: 1,
  },
  copy: {
    minWidth: 0,
    alignItems: 'flex-end',
    marginLeft: 18,
  },
  eyebrow: {
    color: '#B866FF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  titleDesktop: {
    fontSize: 28,
  },
});
