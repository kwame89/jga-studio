import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../themeContext';
import { supabaseAnonKey, supabaseUrl } from '../supabaseClient';

type CatalogItem = {
  id: number;
  atlas_artwork_id: string | null;
  title: string;
  image_url: string | null;
  price_usd: number | null;
  published_at: string | null;
  atlas_synced_at: string | null;
};

type CatalogCollection = {
  id: string;
  atlas_collection_id: string;
  title: string;
  description: string | null;
  start_year: number | null;
  end_year: number | null;
  cover_art_piece_id: number | null;
  cover_image_url: string | null;
  artwork_count: number;
  artwork_ids: number[];
  published_artwork_count: number;
  published_at: string | null;
  atlas_synced_at: string | null;
};

type CatalogResponse = {
  is_admin?: boolean;
  items?: CatalogItem[];
  collections?: CatalogCollection[];
  item?: CatalogItem;
  collection?: CatalogCollection;
  error?: string;
};

type Props = {
  getAccessToken: () => Promise<string | null>;
  onAuthorizationChange: (isAuthorized: boolean) => void;
};

export default function StudioCatalogManager({
  getAccessToken,
  onAuthorizationChange,
}: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [collections, setCollections] = useState<CatalogCollection[]>([]);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null);
  const [focusedCollectionId, setFocusedCollectionId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const request = useCallback(
    async (method: 'GET' | 'POST', body?: Record<string, unknown>) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Please sign in again to manage the catalog.');

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-catalog`, {
        method,
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => ({}))) as CatalogResponse;

      if (!response.ok) {
        const requestError = new Error(payload.error || 'The catalog request failed.');
        (requestError as Error & { status?: number }).status = response.status;
        throw requestError;
      }
      return payload;
    },
    [getAccessToken],
  );

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await request('GET');
      const nextItems = payload.items ?? [];
      setItems(nextItems);
      setCollections(payload.collections ?? []);
      setPrices(
        Object.fromEntries(
          nextItems.map((item) => [
            item.id,
            item.price_usd === null ? '' : String(item.price_usd),
          ]),
        ),
      );
      setIsAuthorized(true);
      onAuthorizationChange(true);
    } catch (loadError) {
      const status = (loadError as Error & { status?: number }).status;
      setIsAuthorized(false);
      onAuthorizationChange(false);
      if (status !== 401 && status !== 403) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load catalog.');
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthorizationChange, request]);

  useEffect(() => {
    loadCatalog();
    return () => onAuthorizationChange(false);
  }, [loadCatalog, onAuthorizationChange]);

  const focusedCollection =
    collections.find((collection) => collection.id === focusedCollectionId) ?? null;
  const visibleItems = focusedCollection
    ? (focusedCollection.artwork_ids ?? [])
        .map((artworkId) => items.find((item) => item.id === artworkId))
        .filter((item): item is CatalogItem => Boolean(item))
    : items;

  function parsePrice(itemId: number, requirePrice: boolean) {
    const raw = (prices[itemId] ?? '').trim();
    if (!raw && !requirePrice) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Enter a price greater than zero.');
    }
    return value;
  }

  async function updateItem(
    item: CatalogItem,
    action: 'set_price' | 'publish' | 'unpublish',
  ) {
    setBusyId(item.id);
    setError('');
    try {
      const priceUsd =
        action === 'unpublish' ? undefined : parsePrice(item.id, action === 'publish');
      const payload = await request('POST', {
        artPieceId: item.id,
        action,
        priceUsd,
      });
      if (!payload.item) throw new Error('JGA Studio returned no updated artwork.');

      setItems((current) =>
        current.map((candidate) => (candidate.id === item.id ? payload.item! : candidate)),
      );
      const wasPublished = Boolean(item.published_at);
      const isPublished = Boolean(payload.item.published_at);
      if (wasPublished !== isPublished) {
        const countChange = isPublished ? 1 : -1;
        setCollections((current) =>
          current.map((collection) =>
            (collection.artwork_ids ?? []).includes(item.id)
              ? {
                  ...collection,
                  published_artwork_count: Math.max(
                    0,
                    collection.published_artwork_count + countChange,
                  ),
                }
              : collection,
          ),
        );
      }
      setPrices((current) => ({
        ...current,
        [item.id]: payload.item?.price_usd === null ? '' : String(payload.item?.price_usd),
      }));
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'The catalog update failed.';
      setError(message);
      Alert.alert('Catalog update failed', message);
    } finally {
      setBusyId(null);
    }
  }

  async function updateCollection(
    collection: CatalogCollection,
    action: 'publish' | 'unpublish',
  ) {
    setBusyCollectionId(collection.id);
    setError('');
    try {
      const payload = await request('POST', {
        entityType: 'collection',
        collectionId: collection.id,
        action,
      });
      if (!payload.collection) {
        throw new Error('JGA Studio returned no updated collection.');
      }

      setCollections((current) =>
        current.map((candidate) =>
          candidate.id === collection.id
            ? { ...candidate, ...payload.collection }
            : candidate,
        ),
      );
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : 'The collection update failed.';
      setError(message);
      Alert.alert('Collection update failed', message);
    } finally {
      setBusyCollectionId(null);
    }
  }

  if (loading && isAuthorized === null) {
    return null;
  }
  if (!isAuthorized) {
    return error ? (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Studio catalog</Text>
        <View style={styles.notice}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.outlineButton} onPress={loadCatalog}>
            <Ionicons name="refresh" size={16} color={theme.accent} />
            <Text style={styles.outlineButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.eyebrow}>Private studio controls</Text>
          <Text style={styles.sectionTitle}>Studio catalog</Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={loadCatalog}
          accessibilityLabel="Refresh studio catalog"
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Ionicons name="refresh" size={19} color={theme.accent} />
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.catalogSubsection}>
        <View style={styles.subsectionHeading}>
          <View>
            <Text style={styles.subsectionTitle}>Discover collections</Text>
            <Text style={styles.subsectionCopy}>Collection visibility</Text>
          </View>
          <Text style={styles.subsectionCount}>{collections.length}</Text>
        </View>

        {collections.length === 0 ? (
          <View style={styles.notice}>
            <Text style={styles.mutedText}>
              Push a collection from Archive Atlas to prepare it for Discover.
            </Text>
          </View>
        ) : (
          collections.map((collection) => {
            const isPublished = Boolean(collection.published_at);
            const isBusy = busyCollectionId === collection.id;
            const publishBlocked =
              !isPublished && collection.published_artwork_count === 0;
            const isFocused = focusedCollectionId === collection.id;
            return (
              <View key={collection.id} style={styles.collectionRow}>
                {collection.cover_image_url ? (
                  <Image
                    source={{ uri: collection.cover_image_url }}
                    style={styles.collectionCover}
                  />
                ) : (
                  <View style={styles.collectionCoverPlaceholder}>
                    <Ionicons name="albums-outline" size={25} color={theme.accent} />
                  </View>
                )}

                <View style={styles.collectionBody}>
                  <View style={styles.itemHeading}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {collection.title}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isPublished ? styles.liveBadge : styles.draftBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isPublished ? styles.liveText : styles.draftText,
                        ]}
                      >
                        {isPublished ? 'Live' : 'Draft'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.collectionMeta}>
                    {collection.artwork_count} works · {collection.published_artwork_count} live
                  </Text>

                  {!isPublished ? (
                    <Text style={styles.collectionGuidance}>
                      {publishBlocked
                        ? 'Set a price and publish at least one member work before this collection can appear on Discover.'
                        : `Only ${collection.published_artwork_count} of ${collection.artwork_count} works will appear when this collection is published.`}
                    </Text>
                  ) : null}

                  <View style={styles.collectionActions}>
                    <TouchableOpacity
                      style={styles.outlineButton}
                      onPress={() =>
                        setFocusedCollectionId(isFocused ? null : collection.id)
                      }
                      accessibilityLabel={
                        isFocused
                          ? `Show all artworks instead of ${collection.title}`
                          : `Review artworks in ${collection.title}`
                      }
                    >
                      <Ionicons
                        name={isFocused ? 'albums-outline' : 'list-outline'}
                        size={16}
                        color={theme.accent}
                      />
                      <Text style={styles.outlineButtonText}>
                        {isFocused ? 'Show all works' : 'Review member works'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.publishButton,
                        isPublished ? styles.unpublishButton : styles.goLiveButton,
                        publishBlocked && styles.disabledButton,
                      ]}
                      onPress={() =>
                        updateCollection(
                          collection,
                          isPublished ? 'unpublish' : 'publish',
                        )
                      }
                      disabled={isBusy || publishBlocked}
                    >
                      {isBusy ? (
                        <ActivityIndicator
                          size="small"
                          color={isPublished ? theme.text : '#fff'}
                        />
                      ) : (
                        <Ionicons
                          name={isPublished ? 'eye-off-outline' : 'eye-outline'}
                          size={17}
                          color={isPublished ? theme.text : '#fff'}
                        />
                      )}
                      <Text
                        style={[
                          styles.publishButtonText,
                          isPublished && styles.unpublishButtonText,
                        ]}
                      >
                        {isPublished
                          ? 'Remove from Discover'
                          : publishBlocked
                            ? 'Publish member works first'
                            : 'Publish to Discover'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.subsectionHeading}>
        <View>
          <Text style={styles.subsectionTitle}>
            {focusedCollection ? `${focusedCollection.title} works` : 'Artwork catalog'}
          </Text>
          <Text style={styles.subsectionCopy}>
            {focusedCollection
              ? 'Set prices and publish the works that should appear in this collection.'
              : 'Set price and publication per work.'}
          </Text>
        </View>
        <Text style={styles.subsectionCount}>{visibleItems.length}</Text>
      </View>

      {visibleItems.length === 0 ? (
        <View style={styles.notice}>
          <Text style={styles.mutedText}>
            {focusedCollection
              ? 'No member artworks were found for this collection.'
              : 'No artworks have been sent from Archive Atlas yet.'}
          </Text>
        </View>
      ) : (
        visibleItems.map((item) => {
          const isPublished = Boolean(item.published_at);
          const isBusy = busyId === item.id;
          return (
            <View key={item.id} style={styles.catalogRow}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Ionicons name="image-outline" size={24} color={theme.accent} />
                </View>
              )}

              <View style={styles.itemBody}>
                <View style={styles.itemHeading}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isPublished ? styles.liveBadge : styles.draftBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isPublished ? styles.liveText : styles.draftText,
                      ]}
                    >
                      {isPublished ? 'Live' : 'Draft'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>Price in USD</Text>
                <View style={styles.priceRow}>
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.currency}>$</Text>
                    <TextInput
                      value={prices[item.id] ?? ''}
                      onChangeText={(value) =>
                        setPrices((current) => ({ ...current, [item.id]: value }))
                      }
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      placeholder="0.00"
                      placeholderTextColor={theme.text + '66'}
                      style={styles.priceInput}
                      editable={!isBusy}
                      accessibilityLabel={`Price for ${item.title}`}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={() => updateItem(item, 'set_price')}
                    disabled={isBusy}
                  >
                    <Ionicons name="save-outline" size={16} color={theme.accent} />
                    <Text style={styles.outlineButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.publishButton,
                    isPublished ? styles.unpublishButton : styles.goLiveButton,
                  ]}
                  onPress={() => updateItem(item, isPublished ? 'unpublish' : 'publish')}
                  disabled={isBusy}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color={isPublished ? theme.text : '#fff'} />
                  ) : (
                    <Ionicons
                      name={isPublished ? 'eye-off-outline' : 'eye-outline'}
                      size={17}
                      color={isPublished ? theme.text : '#fff'}
                    />
                  )}
                  <Text
                    style={[
                      styles.publishButtonText,
                      isPublished && styles.unpublishButtonText,
                    ]}
                  >
                    {isPublished ? 'Unpublish' : 'Publish'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: 18,
      marginTop: 30,
    },
    sectionHeader: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    eyebrow: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '700',
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    notice: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 16,
      gap: 12,
    },
    catalogSubsection: {
      paddingBottom: 24,
      marginBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    subsectionHeading: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 10,
    },
    subsectionTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 3,
    },
    subsectionCopy: {
      maxWidth: 310,
      color: theme.text,
      opacity: 0.65,
      fontSize: 12,
      lineHeight: 17,
    },
    subsectionCount: {
      minWidth: 27,
      paddingHorizontal: 8,
      paddingVertical: 4,
      color: theme.accent,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    collectionRow: {
      minHeight: 132,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 12,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    collectionCover: {
      width: 92,
      minHeight: 118,
      borderRadius: 6,
      backgroundColor: theme.background,
    },
    collectionCoverPlaceholder: {
      width: 92,
      minHeight: 118,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    collectionBody: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'space-between',
    },
    collectionMeta: {
      color: theme.text,
      opacity: 0.66,
      fontSize: 12,
      marginBottom: 10,
    },
    collectionGuidance: {
      color: theme.text,
      opacity: 0.76,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 10,
    },
    collectionActions: {
      gap: 8,
    },
    catalogRow: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    thumbnail: {
      width: 76,
      height: 92,
      borderRadius: 6,
      backgroundColor: theme.background,
    },
    thumbnailPlaceholder: {
      width: 76,
      height: 92,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemBody: {
      flex: 1,
      minWidth: 0,
    },
    itemHeading: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 10,
    },
    itemTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
      lineHeight: 21,
    },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    liveBadge: {
      backgroundColor: theme.isDark ? '#17382C' : '#DDF4E8',
    },
    draftBadge: {
      backgroundColor: theme.isDark ? '#39331E' : '#F6EDCF',
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    liveText: {
      color: theme.isDark ? '#78D7AA' : '#176B45',
    },
    draftText: {
      color: theme.isDark ? '#E6C96E' : '#745E10',
    },
    inputLabel: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 5,
      opacity: 0.72,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 9,
    },
    priceInputWrap: {
      flex: 1,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      backgroundColor: theme.background,
      paddingLeft: 11,
    },
    currency: {
      color: theme.text,
      fontWeight: '700',
      marginRight: 3,
    },
    priceInput: {
      color: theme.text,
      flex: 1,
      minHeight: 40,
      paddingHorizontal: 4,
      paddingVertical: 8,
      fontSize: 15,
    },
    outlineButton: {
      minHeight: 42,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.accent,
      backgroundColor: theme.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    outlineButtonText: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 13,
    },
    publishButton: {
      minHeight: 42,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 12,
    },
    goLiveButton: {
      backgroundColor: theme.accent,
    },
    disabledButton: {
      opacity: 0.45,
    },
    unpublishButton: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    publishButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    unpublishButtonText: {
      color: theme.text,
    },
    mutedText: {
      color: theme.text,
      opacity: 0.66,
      lineHeight: 20,
    },
    errorText: {
      color: '#B3261E',
      lineHeight: 20,
      marginBottom: 8,
    },
  });
