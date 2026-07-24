import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePrivy } from '../lib/privy';
import { callCommerceFunction } from '../lib/commerceApi';
import { useTheme } from '../themeContext';

// Checkout panel, shared by the web and native artwork detail pages: dual
// rail, one processor (docs/10). Both buttons create a server-priced order via
// create-order and open a Stripe Checkout URL — "card" lands on the card page,
// "USDC on Base" on Stripe's stablecoin page. Stripe owns network/address/
// amount; the webhook marks the order paid. Requires sign-in (no guest
// checkout, per spec).

type Quote = {
  orderId: string;
  totalCents: number;
};

type Rail = 'stripe' | 'crypto';

export function BuyArtworkPanel({
  artPieceId,
  priceUsd,
  soldAt,
}: {
  artPieceId: number;
  priceUsd: number | null | undefined;
  soldAt: string | null | undefined;
}) {
  const theme = useTheme();
  const router = useRouter();
  const styles = createStyles(theme);

  const { user, isReady, getAccessToken } = usePrivy();
  const signedIn = isReady ? !!user : null;
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [busyRail, setBusyRail] = useState<Rail | null>(null);
  const [error, setError] = useState('');

  const addressComplete = useMemo(
    () => [name, line1, city, state, zip].every((v) => v.trim().length > 0),
    [name, line1, city, state, zip]
  );

  async function createOrder(rail: Rail) {
    setError('');
    setBusyRail(rail);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Please sign in again to purchase.');
      const data = await callCommerceFunction<Quote & { url?: string }>('create-order', accessToken, {
        artPieceId,
        rail,
        shipping: { name, line1, line2: line2 || undefined, city, state, zip },
      });

      // Both rails are Stripe Checkout now (docs/10): "stripe" lands on the
      // card page, "crypto" on Stripe's USDC payment page. Stripe owns the
      // network, address, and amount — no more manual send-and-verify.
      if (!data?.url) throw new Error('Stripe did not return a checkout link');
      if (Platform.OS === 'web') {
        window.location.assign(data.url);
      } else {
        // In-app browser (SFSafariViewController / Chrome Custom Tab) so the
        // collector stays inside the app and returns when done. The order is
        // created server-side and marked paid by the Stripe webhook, so
        // fulfillment does not depend on the browser returning.
        const WebBrowser = await import('expo-web-browser');
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
    } finally {
      setBusyRail(null);
    }
  }

  if (soldAt) {
    return (
      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.soldBadge, { color: theme.accent }]}>Sold</Text>
        <Text style={[styles.help, { color: theme.text }]}>
          This work has found its collector. Explore more available works on Discover.
        </Text>
      </View>
    );
  }

  if (!priceUsd || priceUsd <= 0) {
    return (
      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Price on request</Text>
        <Text style={[styles.help, { color: theme.text }]}>
          Contact the studio to inquire about this work.
        </Text>
      </View>
    );
  }

  if (signedIn === false) {
    return (
      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Collect this work</Text>
        <Text style={[styles.help, { color: theme.text }]}>
          Sign in to purchase — your order history and certificate link to your account.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
          onPress={() => router.push('/profile')}
        >
          <Text style={styles.primaryBtnText}>Sign in to continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>Collect this work</Text>
      <Text style={[styles.help, { color: theme.text }]}>
        Ships within the US · flat-rate shipping added at checkout · NJ orders include sales tax.
      </Text>

      <View style={styles.form}>
            <TextInput style={[styles.input, inputTheme(theme)]} placeholder="Full name" placeholderTextColor={ph(theme)} value={name} onChangeText={setName} />
            <TextInput style={[styles.input, inputTheme(theme)]} placeholder="Address line 1" placeholderTextColor={ph(theme)} value={line1} onChangeText={setLine1} />
            <TextInput style={[styles.input, inputTheme(theme)]} placeholder="Address line 2 (optional)" placeholderTextColor={ph(theme)} value={line2} onChangeText={setLine2} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.rowItem, inputTheme(theme)]} placeholder="City" placeholderTextColor={ph(theme)} value={city} onChangeText={setCity} />
              <TextInput style={[styles.input, styles.rowItemSmall, inputTheme(theme)]} placeholder="State" placeholderTextColor={ph(theme)} autoCapitalize="characters" maxLength={2} value={state} onChangeText={setState} />
              <TextInput style={[styles.input, styles.rowItemSmall, inputTheme(theme)]} placeholder="ZIP" placeholderTextColor={ph(theme)} value={zip} onChangeText={setZip} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.accent }, (!addressComplete || !!busyRail) && styles.disabled]}
            disabled={!addressComplete || !!busyRail}
            onPress={() => createOrder('stripe')}
          >
            {busyRail === 'stripe' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Pay with card</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: theme.accent }, (!addressComplete || !!busyRail) && styles.disabled]}
            disabled={!addressComplete || !!busyRail}
            onPress={() => createOrder('crypto')}
          >
            {busyRail === 'crypto' ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>
                Pay with USDC on Base
              </Text>
            )}
          </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function inputTheme(theme: ReturnType<typeof useTheme>) {
  return {
    color: theme.text,
    backgroundColor: theme.background,
    borderColor: theme.border,
  };
}

function ph(theme: ReturnType<typeof useTheme>) {
  return theme.isDark ? '#8C8C8C' : '#8A8A8A';
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    panel: {
      borderRadius: 6,
      borderWidth: 1,
      padding: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
    },
    soldBadge: {
      fontSize: 18,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    help: {
      fontSize: 14,
      lineHeight: 21,
      opacity: 0.75,
      marginBottom: 14,
    },
    form: {
      gap: 10,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    // minWidth: 0 is required or RNW flex items won't shrink below their
    // content width — the City/State/ZIP row then overflows the card and ZIP
    // is pushed off-screen. City gets 2 shares, State and ZIP 1 each.
    rowItem: {
      flex: 2,
      minWidth: 0,
    },
    rowItemSmall: {
      flex: 1,
      minWidth: 0,
    },
    input: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 15,
    },
    primaryBtn: {
      paddingVertical: 14,
      borderRadius: 6,
      alignItems: 'center',
      marginBottom: 10,
    },
    primaryBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    secondaryBtn: {
      paddingVertical: 14,
      borderRadius: 6,
      alignItems: 'center',
      borderWidth: 1,
    },
    secondaryBtnText: {
      fontWeight: '700',
      fontSize: 16,
    },
    disabled: {
      opacity: 0.5,
    },
    error: {
      color: '#C7654D',
      marginTop: 10,
      fontSize: 14,
    },
  });
