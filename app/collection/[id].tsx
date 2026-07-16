import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../themeContext';
import { StudioLogo } from '../../components/StudioLogo';
import {
  formatArtworkPrice,
  formatCollectionYears,
  getPublishedCollection,
  type StudioCollection,
} from '../../lib/studioCollections';

export default function CollectionDetail() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 960;
  const styles = createStyles(theme, desktopWeb);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const collectionId = typeof id === 'string' ? id : '';
  const [collection, setCollection] = useState<StudioCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!collectionId) {
      setError('Collection not found.');
      setLoading(false);
      return;
    }

    getPublishedCollection(collectionId)
      .then((nextCollection) => {
        if (cancelled) return;
        if (!nextCollection) {
          setError('This collection is not available.');
          return;
        }
        setCollection(nextCollection);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load this collection.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={styles.centeredText}>Loading collection…</Text>
      </View>
    );
  }

  if (!collection || error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="albums-outline" size={32} color={theme.accent} />
        <Text style={styles.errorTitle}>Collection unavailable</Text>
        <Text style={styles.centeredText}>{error}</Text>
        <TouchableOpacity style={styles.backToDiscover} onPress={() => router.replace('/discover')}>
          <Text style={styles.backToDiscoverText}>Return to Discover</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
        </TouchableOpacity>
        <StudioLogo compact />
        <View style={styles.iconButtonSpacer} />
      </View>

      <View style={styles.heroStory}>
        <View style={styles.hero}>
          {collection.cover?.image_url ? (
            <Image
              source={{ uri: collection.cover.image_url }}
              style={styles.heroImage}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="image-outline" size={32} color={theme.accent} />
            </View>
          )}
        </View>

        <View style={styles.statement}>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{formatCollectionYears(collection)}</Text>
            <Text style={styles.meta}>
              {collection.artworks.length} work
              {collection.artworks.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={styles.title}>{collection.title}</Text>
          {collection.description ? (
            <Text style={styles.description}>{collection.description}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.worksHeading}>
        <Text style={styles.worksEyebrow}>The series</Text>
        <Text style={styles.worksTitle}>Works in this collection</Text>
      </View>

      <View style={styles.grid}>
        {collection.artworks.map((artwork, index) => (
          <Link key={artwork.id} href={`/artwork/${artwork.id}`} asChild>
            <TouchableOpacity style={styles.card} activeOpacity={0.9}>
              <View style={styles.imageFrame}>
                {artwork.image_url ? (
                  <Image
                    source={{ uri: artwork.image_url }}
                    style={styles.artworkImage}
                  />
                ) : (
                  <View style={styles.artworkPlaceholder}>
                    <Ionicons
                      name="image-outline"
                      size={24}
                      color={theme.accent}
                    />
                  </View>
                )}
                <View style={styles.sequenceBadge}>
                  <Text style={styles.sequenceText}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>
              </View>
              <Text style={styles.artworkTitle} numberOfLines={2}>
                {artwork.title}
              </Text>
              <Text style={styles.artworkMeta} numberOfLines={1}>
                {[artwork.year, artwork.medium].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.price}>
                {formatArtworkPrice(artwork.price_usd)}
              </Text>
            </TouchableOpacity>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useTheme>,
  desktopWeb = false,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      width: '100%',
      maxWidth: desktopWeb ? 1200 : 760,
      alignSelf: 'center',
      paddingBottom: 72,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      backgroundColor: theme.background,
    },
    centeredText: {
      maxWidth: 360,
      color: theme.text,
      opacity: 0.65,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 10,
      textAlign: 'center',
    },
    errorTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '700',
      marginTop: 12,
    },
    backToDiscover: {
      minHeight: 42,
      justifyContent: 'center',
      marginTop: 20,
      paddingHorizontal: 16,
      backgroundColor: theme.accent,
      borderRadius: 6,
    },
    backToDiscoverText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    topBar: {
      minHeight: Platform.OS === 'ios' ? 104 : 72,
      paddingTop: Platform.OS === 'ios' ? 52 : 18,
      paddingHorizontal: 18,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#09090A',
    },
    iconButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#171519',
      borderWidth: 1,
      borderColor: '#343037',
      borderRadius: 6,
    },
    iconButtonSpacer: {
      width: 40,
      height: 40,
    },
    hero: {
      width: desktopWeb ? '62%' : '100%',
      aspectRatio: desktopWeb ? 1.18 : 1.06,
      backgroundColor: theme.card,
    },
    heroStory: {
      flexDirection: desktopWeb ? 'row' : 'column',
      backgroundColor: theme.background,
    },
    heroImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    heroPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statement: {
      minWidth: 0,
      flex: desktopWeb ? 1 : 0,
      justifyContent: desktopWeb ? 'center' : undefined,
      paddingHorizontal: desktopWeb ? 42 : 18,
      paddingTop: desktopWeb ? 42 : 24,
      paddingBottom: desktopWeb ? 42 : 30,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    meta: {
      color: '#A36A2A',
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    title: {
      color: theme.text,
      fontFamily: 'serif',
      fontSize: desktopWeb ? 46 : 34,
      lineHeight: desktopWeb ? 53 : 40,
    },
    description: {
      color: theme.text,
      opacity: 0.74,
      fontSize: 15,
      lineHeight: 23,
      marginTop: 14,
    },
    worksHeading: {
      paddingHorizontal: desktopWeb ? 36 : 18,
      paddingTop: desktopWeb ? 48 : 30,
      paddingBottom: desktopWeb ? 22 : 16,
    },
    worksEyebrow: {
      color: '#3E7569',
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    worksTitle: {
      color: theme.text,
      fontFamily: 'serif',
      fontSize: desktopWeb ? 32 : 23,
    },
    grid: {
      paddingHorizontal: desktopWeb ? 36 : 18,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: desktopWeb ? 38 : 24,
    },
    card: {
      width: desktopWeb ? '23.5%' : '48.3%',
      minWidth: 0,
    },
    imageFrame: {
      width: '100%',
      aspectRatio: 0.78,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: theme.card,
      borderRadius: 6,
    },
    artworkImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    artworkPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sequenceBadge: {
      minWidth: 32,
      height: 26,
      position: 'absolute',
      top: 8,
      left: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 7,
      backgroundColor: 'rgba(12, 12, 12, 0.8)',
      borderRadius: 4,
    },
    sequenceText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
    artworkTitle: {
      minHeight: 39,
      color: theme.text,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      marginTop: 9,
    },
    artworkMeta: {
      minHeight: 17,
      color: theme.text,
      opacity: 0.58,
      fontSize: 11,
      marginTop: 3,
    },
    price: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 5,
    },
  });
