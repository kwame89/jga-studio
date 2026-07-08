import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../themeContext';

const { width } = Dimensions.get('window');

type ArtPiece = {
  id: number;
  title: string;
  image_url: string;
  price_usd: number;
  collection_type?: string;
  medium?: string;
  created_at?: string;
};

const CATEGORY_MAP: Record<string, string[]> = {
  Paintings: ['Paintings', 'Painting'],
  'Mixed Media': ['Mixed Media', 'mixed media', 'Mixed media'],
  Prints: ['Prints', 'Print'],
  Drawings: ['Drawings', 'Drawing'],
};

const CATEGORY_ORDER = ['Paintings', 'Mixed Media', 'Prints', 'Drawings'];

function matchesCategory(item: ArtPiece, category: string) {
  const allowedValues = CATEGORY_MAP[category] || [category];
  const normalizedMedium = (item.medium || '').toLowerCase().trim();

  return allowedValues.some(
    (value) => value.toLowerCase().trim() === normalizedMedium
  );
}

export default function Discover() {
  const router = useRouter();
  const theme = useTheme();
  const { category } = useLocalSearchParams();

  const [artworks, setArtworks] = useState<ArtPiece[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtPieces();
  }, []);

  const fetchArtPieces = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('art_pieces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      setLoading(false);
      return;
    }

    setArtworks(data || []);
    setLoading(false);
  };

  const activeCategory =
    typeof category === 'string' && category.trim() ? category : null;

  const filteredArtworks = useMemo(() => {
    if (!activeCategory) return artworks;
    return artworks.filter((item) => matchesCategory(item, activeCategory));
  }, [artworks, activeCategory]);

  const heroArtwork = filteredArtworks[0] || artworks[0];
  const totalWorksLabel = filteredArtworks.length;
  const styles = createStyles(theme);

  const handleSelectCategory = (selectedCategory: string | null) => {
    if (!selectedCategory) {
      router.replace('/discover');
      return;
    }

    router.replace({
      pathname: '/discover',
      params: { category: selectedCategory },
    });
  };

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
        >
          <Ionicons name="grid-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.selectorSection}>
        <View style={styles.selectorHeadingRow}>
          <Text style={styles.selectorTitle}>Browse by Category</Text>
          <Text style={styles.selectorMeta}>
            {loading
              ? 'Loading...'
              : activeCategory
              ? `${totalWorksLabel} works`
              : `${artworks.length} works`}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorScroll}
        >
          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.selectorChip,
              !activeCategory && styles.selectorChipActive,
            ]}
            onPress={() => handleSelectCategory(null)}
          >
            <Text
              style={[
                styles.selectorChipText,
                !activeCategory && styles.selectorChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {CATEGORY_ORDER.map((item) => {
            const isActive = activeCategory === item;

            return (
              <TouchableOpacity
                key={item}
                activeOpacity={0.88}
                style={[
                  styles.selectorChip,
                  isActive && styles.selectorChipActive,
                ]}
                onPress={() => handleSelectCategory(item)}
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    isActive && styles.selectorChipTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {activeCategory && (
        <View style={styles.categoryBanner}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{activeCategory}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSelectCategory(null)}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingSection}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.loadingText}>Loading studio works...</Text>
        </View>
      ) : (
        <>
          {heroArtwork && (
            <View style={styles.heroSection}>
              <Link href={`/artwork/${heroArtwork.id}`} asChild>
                <TouchableOpacity activeOpacity={0.9} style={styles.heroCard}>
                  <Image
                    source={{ uri: heroArtwork.image_url }}
                    style={styles.heroImage}
                  />
                  <View style={styles.heroOverlay} />
                  <View style={styles.heroContent}>
                    <Text style={styles.heroEyebrow}>
                      {activeCategory ? `${activeCategory} Highlight` : 'Studio Highlight'}
                    </Text>
                    <Text style={styles.heroTitle} numberOfLines={2}>
                      {heroArtwork.title}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                      {activeCategory
                        ? `A selected work from the ${activeCategory.toLowerCase()} grouping`
                        : 'A featured work from Jay Golding’s evolving studio collection'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Link>
            </View>
          )}

          <View style={styles.artistSection}>
            <View style={styles.artistPhotoWrap}>
              <Image
                source={require('../../assets/jay-golding.jpeg')}
                style={styles.artistPhoto}
                resizeMode="cover"
              />
            </View>

            <View style={styles.artistTextBlock}>
              <Text style={styles.artistEyebrow}>Artist Profile</Text>
              <Text style={styles.artistName}>Jay Golding</Text>
              <Text style={styles.artistSummary}>
                Jamaican-born, U.S.-based artist exploring indigenous cultures,
                mythology, migration, portraiture, memory, and landscape.
              </Text>
            </View>
          </View>

          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>About the Artist</Text>

            <Text style={styles.bioText}>
              Jay Golding is a Jamaican-born, U.S.-based artist and descendant of
              the Accompong Maroons. His works primarily explore indigenous
              cultures, mythology, and migration, ranging from portraits and
              landscapes to nostalgic memories.
            </Text>

            <Text style={styles.bioText}>
              He earned his BFA in Studio Art from Kean University in 2015 and has
              exhibited widely in the tri-state area. His work is held in the Eileen
              S. Kaminsky Family Foundation collection. In the fall of 2025, one of
              his paintings was sold at Swann Auction Galleries in NYC.
            </Text>
          </View>

          <View style={styles.worksHeader}>
            <Text style={styles.worksTitle}>
              {activeCategory ? `${activeCategory} Works` : 'Explore the Collection'}
            </Text>
            <Text style={styles.worksSubtitle}>
              {activeCategory
                ? `Browse available works in ${activeCategory.toLowerCase()}`
                : 'Browse selected works from the studio'}
            </Text>
          </View>

          {filteredArtworks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="images-outline"
                size={30}
                color={theme.isDark ? '#A0A0A0' : '#7B7684'}
              />
              <Text style={styles.emptyTitle}>No works in this category yet</Text>
              <Text style={styles.emptyText}>
                Try another category or return to the full studio collection.
              </Text>

              <TouchableOpacity
                style={styles.emptyButton}
                activeOpacity={0.88}
                onPress={() => handleSelectCategory(null)}
              >
                <Text style={styles.emptyButtonText}>View All Works</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredArtworks.map((item) => (
                <Link key={item.id} href={`/artwork/${item.id}`} asChild>
                  <TouchableOpacity style={styles.card} activeOpacity={0.9}>
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.image}
                    />
                    <View style={styles.cardMeta}>
                      <Text style={styles.artTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.price}>${item.price_usd}</Text>
                    </View>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          )}

          <View style={styles.collectionsSection}>
            <TouchableOpacity
              style={styles.collectionButton}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.88}
            >
              <Text style={styles.buttonText}>Browse Home</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SectionSpacer() {
  return <View style={{ height: 8 }} />;
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
      paddingTop: Platform.OS === 'ios' ? 62 : 28,
      paddingHorizontal: 18,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    title: {
      fontSize: 30,
      fontWeight: '700',
      color: theme.text,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    selectorSection: {
      marginBottom: 18,
    },
    selectorHeadingRow: {
      paddingHorizontal: 18,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectorTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    selectorMeta: {
      color: theme.isDark ? '#9C9C9C' : '#6E6A75',
      fontSize: 13,
      fontWeight: '600',
    },
    selectorScroll: {
      paddingHorizontal: 18,
      paddingRight: 6,
    },
    selectorChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      marginRight: 10,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectorChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    selectorChipText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    selectorChipTextActive: {
      color: '#FFFFFF',
    },

    categoryBanner: {
      paddingHorizontal: 18,
      marginBottom: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    categoryBadge: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    categoryBadgeText: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 13,
    },
    clearText: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 14,
    },

    loadingSection: {
      paddingHorizontal: 18,
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: theme.isDark ? '#B3B3B3' : '#666',
      fontSize: 14,
    },

    heroSection: {
      paddingHorizontal: 18,
      marginBottom: 26,
    },
    heroCard: {
      height: width * 0.9,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: theme.card,
      position: 'relative',
    },
    heroImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    heroContent: {
      position: 'absolute',
      left: 18,
      right: 18,
      bottom: 20,
    },
    heroEyebrow: {
      color: '#F2E9FF',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginBottom: 8,
    },
    heroTitle: {
      color: '#FFFFFF',
      fontSize: 28,
      lineHeight: 32,
      fontWeight: '700',
      marginBottom: 8,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      lineHeight: 20,
      maxWidth: '86%',
    },

    artistSection: {
      paddingHorizontal: 18,
      marginBottom: 28,
      flexDirection: 'row',
      alignItems: 'center',
    },
    artistPhotoWrap: {
      marginRight: 16,
    },
    artistPhoto: {
      width: 92,
      height: 92,
      borderRadius: 46,
      borderWidth: 4,
      borderColor: theme.card,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.isDark ? 0 : 0.12,
          shadowRadius: 10,
        },
        android: {
          elevation: theme.isDark ? 0 : 6,
        },
      }),
    },
    artistTextBlock: {
      flex: 1,
    },
    artistEyebrow: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    artistName: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 6,
    },
    artistSummary: {
      color: theme.isDark ? '#B0B0B0' : '#5B5663',
      fontSize: 14,
      lineHeight: 21,
    },

    bioSection: {
      paddingHorizontal: 24,
      marginBottom: 34,
    },
    bioTitle: {
      fontSize: 21,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 16,
    },
    bioText: {
      fontSize: 16,
      lineHeight: 26,
      color: theme.isDark ? '#B3B3B3' : '#444',
      marginBottom: 18,
    },

    worksHeader: {
      paddingHorizontal: 18,
      marginBottom: 14,
    },
    worksTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 4,
    },
    worksSubtitle: {
      color: theme.isDark ? '#9C9C9C' : '#6E6A75',
      fontSize: 14,
    },

    grid: {
      paddingHorizontal: 18,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 18,
    },
    card: {
      width: (width - 46) / 2,
    },
    image: {
      width: '100%',
      height: ((width - 46) / 2) * 1.18,
      borderRadius: 18,
      backgroundColor: theme.card,
    },
    cardMeta: {
      paddingTop: 10,
      paddingHorizontal: 2,
    },
    artTitle: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      marginBottom: 4,
    },
    price: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 14,
    },

    emptyState: {
      marginHorizontal: 18,
      paddingVertical: 28,
      paddingHorizontal: 22,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyText: {
      color: theme.isDark ? '#A0A0A0' : '#6E6A75',
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 18,
    },
    emptyButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
    },
    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },

    collectionsSection: {
      paddingHorizontal: 24,
      marginTop: 34,
    },
    collectionButton: {
      backgroundColor: theme.accent,
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.isDark ? 0 : 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: theme.isDark ? 0 : 6,
        },
      }),
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },
  });