import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePrivy } from '../../lib/privy';
import { callCommerceFunction } from '../../lib/commerceApi';
import { useTheme } from '../../themeContext';

// Landing page after payment (Stripe redirect or crypto confirmation).
// Stripe's webhook may land a few seconds after the redirect, so this page
// polls get-order (Privy-verified; orders have no client-readable RLS)
// until the status flips to paid.

export default function CheckoutSuccess() {
  const { order } = useLocalSearchParams<{ order?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user, isReady, getAccessToken } = usePrivy();

  const [status, setStatus] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');

  useEffect(() => {
    if (!order || !isReady || !user) return;
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error('no token');
        const data = await callCommerceFunction<{ status: string; title: string | null }>(
          'get-order',
          accessToken,
          { orderId: order }
        );
        if (cancelled) return;
        setStatus(data.status);
        if (data.title) setTitle(data.title);
        if (data.status === 'paid' || attempts >= 15) return;
      } catch {
        if (cancelled) return;
        if (attempts >= 15) {
          setStatus('unknown');
          return;
        }
      }
      setTimeout(poll, 2000);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [order, isReady, user]);

  const paid = status === 'paid' || status === 'preparing' || status === 'shipped';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {status === null ? (
        <>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.text, { color: theme.text }]}>Confirming your payment…</Text>
        </>
      ) : paid ? (
        <>
          <Text style={[styles.title, { color: theme.text }]}>It’s yours.</Text>
          <Text style={[styles.text, { color: theme.text }]}>
            {title ? `“${title}” is` : 'Your artwork is'} confirmed and the studio has been
            notified. You’ll receive an email with shipping details.
          </Text>
        </>
      ) : status === 'pending_payment' ? (
        <>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.text, { color: theme.text }]}>
            Payment received by the processor — finalizing your order. This page refreshes
            automatically.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: theme.text }]}>Order status: {status}</Text>
          <Text style={[styles.text, { color: theme.text }]}>
            If you completed payment and this doesn’t resolve in a minute, contact the studio with
            your order id: {order}
          </Text>
        </>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/discover')}
      >
        <Text style={styles.buttonText}>Continue browsing</Text>
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
    fontSize: 28,
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
