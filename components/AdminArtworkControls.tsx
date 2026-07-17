import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePrivy } from '../lib/privy';
import { callCommerceFunction } from '../lib/commerceApi';
import { useTheme } from '../themeContext';

// Studio-admin price/publish control rendered directly on an artwork detail
// page, so pricing doesn't require the Profile > Artwork catalog screen.
// Reuses the admin-catalog Edge Function exactly as StudioCatalogManager
// does; authorization is server-side (studio_admins allowlist) and this
// component follows the established self-hiding pattern — non-admins and
// signed-out visitors render nothing.

type CatalogItem = {
  id: number;
  price_usd: number | null;
  published_at: string | null;
};

type CatalogResponse = {
  items: CatalogItem[];
};

export function AdminArtworkControls({
  artPieceId,
  onChanged,
}: {
  artPieceId: number;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { user, isReady, getAccessToken } = usePrivy();

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadItem = useCallback(async () => {
    if (!isReady || !user) return;
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const data = await callCommerceFunction<CatalogResponse>(
        'admin-catalog',
        accessToken,
        undefined,
        'GET'
      );
      const match = data.items.find((entry) => entry.id === artPieceId) ?? null;
      setItem(match);
      if (match?.price_usd != null) setPriceDraft(String(match.price_usd));
    } catch {
      // 401/403 (not an admin) or transient failure: stay hidden.
      setItem(null);
    }
  }, [artPieceId, isReady, user, getAccessToken]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  if (!item) return null;

  const isPublished = !!item.published_at;

  async function runAction(action: 'set_price' | 'publish' | 'unpublish') {
    setError('');
    setNotice('');
    setBusy(action === 'set_price' ? 'save' : 'publish');
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Please sign in again.');
      const priceUsd = Number(priceDraft);
      const body: Record<string, unknown> = { artPieceId, action };
      if (action !== 'unpublish') {
        if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
          throw new Error('Enter a price greater than zero');
        }
        body.priceUsd = priceUsd;
      }
      await callCommerceFunction('admin-catalog', accessToken, body);
      setNotice(
        action === 'set_price'
          ? 'Price saved'
          : action === 'publish'
            ? 'Published to the studio'
            : 'Unpublished'
      );
      await loadItem();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.accent }]}>
      <Text style={[styles.heading, { color: theme.accent }]}>Studio admin</Text>
      <Text style={[styles.meta, { color: theme.text }]}>
        {isPublished ? 'Published' : 'Draft — not visible to collectors'}
        {item.price_usd != null ? ` · listed at $${item.price_usd}` : ' · no price set'}
      </Text>

      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          ]}
          placeholder="Price (USD)"
          placeholderTextColor={theme.isDark ? '#8C8C8C' : '#8A8A8A'}
          keyboardType="decimal-pad"
          value={priceDraft}
          onChangeText={setPriceDraft}
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }, busy && styles.disabled]}
          disabled={!!busy}
          onPress={() => runAction('set_price')}
        >
          {busy === 'save' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save price</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buttonOutline, { borderColor: theme.accent }, busy && styles.disabled]}
          disabled={!!busy}
          onPress={() => runAction(isPublished ? 'unpublish' : 'publish')}
        >
          {busy === 'publish' ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <Text style={[styles.buttonOutlineText, { color: theme.accent }]}>
              {isPublished ? 'Unpublish' : 'Publish'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {!!notice && <Text style={[styles.notice, { color: theme.text }]}>{notice}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    panel: {
      borderRadius: 6,
      borderWidth: 1,
      padding: 16,
    },
    heading: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    meta: {
      fontSize: 14,
      opacity: 0.75,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    input: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      minWidth: 130,
      flexGrow: 1,
    },
    button: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 6,
      alignItems: 'center',
    },
    buttonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    buttonOutline: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 6,
      alignItems: 'center',
      borderWidth: 1,
    },
    buttonOutlineText: {
      fontWeight: '700',
      fontSize: 14,
    },
    disabled: {
      opacity: 0.5,
    },
    notice: {
      marginTop: 10,
      fontSize: 13,
      opacity: 0.8,
    },
    error: {
      marginTop: 10,
      fontSize: 13,
      color: '#C7654D',
    },
  });
