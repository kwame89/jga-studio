import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../themeContext';

// Landing page after payment (Stripe redirect or crypto confirmation).
// Stripe's webhook may land a few seconds after the redirect, so this page
// polls the order (readable via own-row RLS) until it flips to paid.

export default function CheckoutSuccess() {
  const { order } = useLocalSearchParams<{ order?: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [status, setStatus] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      const { data } = await supabase
        .from('orders')
        .select('status, art_piece_id')
        .eq('id', order)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setStatus(data.status);
        if (!title) {
          const { data: piece } = await supabase
            .from('art_pieces')
            .select('title')
            .eq('id', data.art_piece_id)
            .maybeSingle();
          if (piece && !cancelled) setTitle(piece.title);
        }
        if (data.status === 'paid' || attempts >= 15) return;
      } else if (attempts >= 15) {
        setStatus('unknown');
        return;
      }
      setTimeout(poll, 2000);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [order]);

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
