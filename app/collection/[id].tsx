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
import { ArtworkCaption } from '../../components/ArtworkCaption';
import { ArtworkImage } from '../../components/ArtworkImage';
import {
  getStudioCategory,
  getStudioCategoryDefinition,
} from '../../lib/artworkCategories';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../themeContext';
import { StudioLogo } from '../../components/StudioLogo';
import { useGoBack } from '../../lib/useGoBack';
import {
  formatArtworkPrice,
  formatCollectionYears,
  getPublishedCollection,
  type StudioCollection,
} from '../../lib/studioCollections';

export default function CollectionDetail() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/discover');
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
          onPress={goBack}
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
            <Text style={styles.meta}>Studio collection</Text>
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
                  <ArtworkImage uri={artwork.image_url} radius={6} />
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
              <ArtworkCaption
                category={getStudioCategoryDefinition(
                  getStudioCategory(artwork),
                ).label}
                title={artwork.title}
                meta={[artwork.year, artwork.medium]
                  .filter(Boolean)
                  .join(' · ')}
                price={formatArtworkPrice(artwork.price_usd)}
                desktop={desktopWeb}
              />
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
      // Whole cover shown with breathing room, matching the artwork detail hero.
      padding: desktopWeb ? 28 : 18,
      alignItems: 'center',
      justifyContent: 'center',
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
    // The year/"studio collection" rule sat almost flush against the
    // collection title below it, so a 34–46px serif line read as if it were
    // hanging off the divider. Give the title room to breathe.
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingBottom: desktopWeb ? 18 : 14,
      marginBottom: desktopWeb ? 24 : 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      rowGap: desktopWeb ? 38 : 24,
    },
    card: {
      width: desktopWeb ? '23.5%' : '48.3%',
      minWidth: 0,
    },
    // Height now comes from the image's own ratio (see ArtworkImage); this
    // only anchors the sequence badge.
    imageFrame: {
      width: '100%',
      position: 'relative',
    },
    artworkPlaceholder: {
      width: '100%',
      aspectRatio: 0.78,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      borderRadius: 6,
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
  });
