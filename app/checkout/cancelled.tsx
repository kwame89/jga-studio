import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../themeContext';
import { useGoBack } from '../../lib/useGoBack';

// Stripe cancel_url target. The order's 30-minute hold expires on its own
// (lazily released), so nothing needs cleaning up here.

export default function CheckoutCancelled() {
  const { order } = useLocalSearchParams<{ order?: string }>();
  const goBack = useGoBack('/(tabs)/discover');
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Checkout cancelled</Text>
      <Text style={[styles.text, { color: theme.text }]}>
        No payment was taken. The work stays reserved for a few more minutes and then returns to
        the gallery{order ? ` (order ${order.slice(0, 8)}…)` : ''}.
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.accent }]}
        onPress={goBack}
      >
        <Text style={styles.buttonText}>Back to the artwork</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 520,
  },
  button: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
