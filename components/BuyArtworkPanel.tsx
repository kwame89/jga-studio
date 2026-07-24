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

// Web-first checkout panel (docs/build-packet 1-commerce): dual rail.
// - Card: create-order returns a Stripe Checkout URL; server owns the price.
// - USDC on Base: create-order returns the treasury address + exact amount;
//   the buyer sends from any wallet, pastes the tx hash, and
//   confirm-crypto-payment verifies it onchain before the order is paid.
// Requires sign-in (no guest checkout, per spec).

type Quote = {
  orderId: string;
  totalCents: number;
  usdc?: {
    network: string;
    token: string;
    to: string;
    amount: string;
    holdExpiresAt: string;
  };
};

type Rail = 'stripe' | 'crypto';

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

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
  const [cryptoQuote, setCryptoQuote] = useState<Quote | null>(null);
  const [txHash, setTxHash] = useState('');
  const [cryptoStatus, setCryptoStatus] = useState('');
  const [checking, setChecking] = useState(false);

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

      if (rail === 'stripe') {
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
        return;
      }
      setCryptoQuote(data as Quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
    } finally {
      setBusyRail(null);
    }
  }

  async function submitAndCheck() {
    if (!cryptoQuote) return;
    setError('');
    setChecking(true);
    setCryptoStatus('');
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Please sign in again to continue.');
      if (txHash.trim()) {
        await callCommerceFunction('submit-crypto-payment', accessToken, {
          orderId: cryptoQuote.orderId,
          txHash: txHash.trim(),
        });
      }
      const confirm = await callCommerceFunction<{ status: string; reason?: string }>(
        'confirm-crypto-payment',
        accessToken,
        { orderId: cryptoQuote.orderId }
      );
      if (confirm.status === 'confirmed') {
        router.push(`/checkout/success?order=${cryptoQuote.orderId}`);
        return;
      }
      setCryptoStatus(
        confirm.status === 'failed'
          ? `Payment check failed: ${confirm.reason ?? 'unknown reason'}`
          : confirm.reason ?? 'Still confirming — check again in a moment'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify payment');
    } finally {
      setChecking(false);
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

      {!cryptoQuote && (
        <>
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
        </>
      )}

      {cryptoQuote?.usdc && (
        <View style={styles.cryptoBox}>
          <Text style={[styles.cryptoHeading, { color: theme.text }]}>
            Send exactly {cryptoQuote.usdc.amount} USDC on Base
          </Text>
          <Text style={[styles.mono, { color: theme.text }]} selectable>
            {cryptoQuote.usdc.to}
          </Text>
          <Text style={[styles.help, { color: theme.text }]}>
            Total {dollars(cryptoQuote.totalCents)} · from any wallet on the Base network · your
            reservation holds for 30 minutes. After sending, paste the transaction hash:
          </Text>
          <TextInput
            style={[styles.input, inputTheme(theme)]}
            placeholder="0x… transaction hash"
            placeholderTextColor={ph(theme)}
            autoCapitalize="none"
            value={txHash}
            onChangeText={setTxHash}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.accent }, checking && styles.disabled]}
            disabled={checking}
            onPress={submitAndCheck}
          >
            {checking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>I sent it — verify payment</Text>
            )}
          </TouchableOpacity>
          {!!cryptoStatus && <Text style={[styles.help, { color: theme.text }]}>{cryptoStatus}</Text>}
        </View>
      )}

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
    cryptoBox: {
      marginTop: 6,
      gap: 10,
    },
    cryptoHeading: {
      fontSize: 16,
      fontWeight: '700',
    },
    mono: {
      fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
      fontSize: 13,
    },
    error: {
      color: '#C7654D',
      marginTop: 10,
      fontSize: 14,
    },
  });
