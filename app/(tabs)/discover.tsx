import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '../../themeContext';
import {
  formatArtworkPrice,
  formatCollectionYears,
  listPublishedArtworks,
  listPublishedCollections,
  type StudioArtwork,
  type StudioCollection,
} from '../../lib/studioCollections';

export default function Discover() {
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [collections, setCollections] = useState<StudioCollection[]>([]);
  const [artworks, setArtworks] = useState<StudioArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDiscover() {
      setLoading(true);
      setError('');
      try {
        const [nextCollections, nextArtworks] = await Promise.all([
          listPublishedCollections(),
          listPublishedArtworks(),
        ]);
        if (cancelled) return;
        setCollections(nextCollections);
        setArtworks(nextArtworks);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load Discover.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDiscover();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>JGA Studio</Text>
          <Text style={styles.title}>Discover</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)')}
          accessibilityLabel="Return home"
        >
          <Ionicons name="grid-outline" size={19} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.intro}>
        <Text style={styles.introTitle}>Bodies of work</Text>
        <Text style={styles.introText}>
          Series shaped by place, memory, mythology, and migration.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.mutedText}>Loading collections…</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={28} color="#A33A34" />
          <Text style={styles.emptyTitle}>Discover is unavailable</Text>
          <Text style={styles.mutedText}>{error}</Text>
        </View>
      ) : collections.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="albums-outline" size={30} color={theme.accent} />
          <Text style={styles.emptyTitle}>Collections are being prepared</Text>
          <Text style={styles.mutedText}>
            Published bodies of work will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.collectionList}>
          {collections.map((collection, collectionIndex) => (
            <Link
              key={collection.id}
              href={`/collection/${collection.id}`}
              asChild
            >
              <TouchableOpacity
                style={styles.collectionCard}
                activeOpacity={0.9}
              >
                <View style={styles.coverFrame}>
                  {collection.cover?.image_url ? (
                    <Image
                      source={{ uri: collection.cover.image_url }}
                      style={styles.coverImage}
                    />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons
                        name="image-outline"
                        size={30}
                        color={theme.accent}
                      />
                    </View>
                  )}
                  <View style={styles.coverIndex}>
                    <Text style={styles.coverIndexText}>
                      {String(collectionIndex + 1).padStart(2, '0')}
                    </Text>
                  </View>
                </View>

                <View style={styles.collectionCopy}>
                  <View style={styles.collectionMetaRow}>
                    <Text style={styles.collectionMeta}>
                      {formatCollectionYears(collection)}
                    </Text>
                    <Text style={styles.collectionMeta}>
                      {collection.artworks.length} work
                      {collection.artworks.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={styles.collectionTitle}>
                    {collection.title}
                  </Text>
                  {collection.description ? (
                    <Text style={styles.collectionDescription} numberOfLines={3}>
                      {collection.description}
                    </Text>
                  ) : null}

                  {collection.artworks.length > 1 ? (
                    <View style={styles.previewStrip}>
                      {collection.artworks.slice(0, 4).map((artwork) => (
                        <View key={artwork.id} style={styles.previewFrame}>
                          {artwork.image_url ? (
                            <Image
                              source={{ uri: artwork.image_url }}
                              style={styles.previewImage}
                            />
                          ) : (
                            <View style={styles.previewPlaceholder} />
                          )}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.collectionLink}>
                    <Text style={styles.collectionLinkText}>View collection</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={17}
                      color={theme.accent}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </Link>
          ))}
        </View>
      )}

      {!loading && artworks.length > 0 ? (
        <View style={styles.allWorksSection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>Studio catalog</Text>
              <Text style={styles.sectionTitle}>All available works</Text>
            </View>
            <Text style={styles.sectionCount}>{artworks.length}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.artworkRail}
          >
            {artworks.map((artwork) => (
              <Link key={artwork.id} href={`/artwork/${artwork.id}`} asChild>
                <TouchableOpacity style={styles.artworkCard} activeOpacity={0.9}>
                  {artwork.image_url ? (
                    <Image
                      source={{ uri: artwork.image_url }}
                      style={styles.artworkImage}
                    />
                  ) : (
                    <View style={styles.artworkPlaceholder}>
                      <Ionicons
                        name="image-outline"
                        size={25}
                        color={theme.accent}
                      />
                    </View>
                  )}
                  <Text style={styles.artworkTitle} numberOfLines={2}>
                    {artwork.title}
                  </Text>
                  <Text style={styles.artworkPrice}>
                    {formatArtworkPrice(artwork.price_usd)}
                  </Text>
                </TouchableOpacity>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingBottom: 120,
    },
    header: {
      minHeight: 108,
      paddingTop: Platform.OS === 'ios' ? 58 : 24,
      paddingHorizontal: 18,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: '#A36A2A',
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '700',
    },
    headerButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
    },
    intro: {
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    introTitle: {
      color: theme.text,
      fontFamily: 'serif',
      fontSize: 24,
      marginBottom: 7,
    },
    introText: {
      maxWidth: 520,
      color: theme.text,
      opacity: 0.68,
      fontSize: 14,
      lineHeight: 21,
    },
    loadingState: {
      minHeight: 230,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginHorizontal: 18,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    emptyState: {
      minHeight: 230,
      marginHorizontal: 18,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 10,
      marginBottom: 5,
      textAlign: 'center',
    },
    mutedText: {
      color: theme.text,
      opacity: 0.62,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
    collectionList: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    collectionCard: {
      paddingHorizontal: 18,
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    coverFrame: {
      width: '100%',
      aspectRatio: 1.25,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: theme.card,
      borderRadius: 8,
    },
    coverImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    coverPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverIndex: {
      minWidth: 40,
      height: 32,
      position: 'absolute',
      top: 12,
      left: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 9,
      backgroundColor: 'rgba(12, 12, 12, 0.82)',
      borderRadius: 4,
    },
    coverIndexText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    collectionCopy: {
      paddingTop: 16,
    },
    collectionMetaRow: {
      minHeight: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    collectionMeta: {
      color: '#A36A2A',
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    collectionTitle: {
      color: theme.text,
      fontFamily: 'serif',
      fontSize: 28,
      lineHeight: 34,
      marginTop: 5,
    },
    collectionDescription: {
      color: theme.text,
      opacity: 0.72,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 9,
    },
    previewStrip: {
      height: 66,
      flexDirection: 'row',
      gap: 6,
      marginTop: 16,
    },
    previewFrame: {
      width: 56,
      height: 66,
      overflow: 'hidden',
      backgroundColor: theme.card,
      borderRadius: 4,
    },
    previewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    previewPlaceholder: {
      flex: 1,
      backgroundColor: theme.card,
    },
    collectionLink: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 13,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    collectionLinkText: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    allWorksSection: {
      paddingTop: 34,
    },
    sectionHeading: {
      minHeight: 60,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    sectionEyebrow: {
      color: '#3E7569',
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    sectionTitle: {
      color: theme.text,
      fontFamily: 'serif',
      fontSize: 22,
    },
    sectionCount: {
      minWidth: 30,
      paddingHorizontal: 8,
      paddingVertical: 4,
      color: theme.text,
      backgroundColor: theme.card,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    artworkRail: {
      paddingHorizontal: 18,
      paddingRight: 6,
      gap: 10,
    },
    artworkCard: {
      width: 164,
      minHeight: 246,
    },
    artworkImage: {
      width: 164,
      height: 190,
      resizeMode: 'contain',
      backgroundColor: theme.card,
      borderRadius: 6,
    },
    artworkPlaceholder: {
      width: 164,
      height: 190,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      borderRadius: 6,
    },
    artworkTitle: {
      minHeight: 38,
      color: theme.text,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      marginTop: 9,
    },
    artworkPrice: {
      color: theme.text,
      opacity: 0.65,
      fontSize: 12,
      marginTop: 3,
    },
  });
