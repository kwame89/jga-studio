import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { StudioMasthead } from '../../components/StudioMasthead';
import { ArtworkCaption } from '../../components/ArtworkCaption';
import { ArtworkImage } from '../../components/ArtworkImage';
import {
  getStudioCategory,
  getStudioCategoryDefinition,
  parseStudioCategory,
  STUDIO_CATEGORIES,
  type StudioCategoryKey,
} from '../../lib/artworkCategories';
import {
  formatArtworkPrice,
  formatCollectionYears,
  listPublishedArtworks,
  listPublishedCollections,
  type StudioArtwork,
  type StudioCollection,
} from '../../lib/studioCollections';
import {
  parsePriceTier,
  priceInTier,
  PRICE_TIERS,
  type PriceTierKey,
} from '../../constants/studioContent';
import { useTheme } from '../../themeContext';

type CategoryFilter = StudioCategoryKey | 'all';

function artworkMatchesSearch(artwork: StudioArtwork, query: string) {
  if (!query) return true;
  return [
    artwork.title,
    artwork.medium,
    artwork.art_type,
    artwork.subject_matter,
    ...(artwork.tags ?? []),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

export default function Discover() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 960;
  const styles = createStyles(theme, desktopWeb);
  const params = useLocalSearchParams<{
    category?: string | string[];
    tier?: string | string[];
  }>();
  const [collections, setCollections] = useState<StudioCollection[]>([]);
  const [artworks, setArtworks] = useState<StudioArtwork[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(
    parseStudioCategory(params.category),
  );
  const [selectedTier, setSelectedTier] = useState<PriceTierKey>(
    parsePriceTier(params.tier),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedCategory(parseStudioCategory(params.category));
  }, [params.category]);

  // Home's price chips deep-link in here, so the tier travels as a route param.
  useEffect(() => {
    setSelectedTier(parsePriceTier(params.tier));
  }, [params.tier]);

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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleArtworks = useMemo(
    () =>
      artworks.filter(
        (artwork) =>
          artworkMatchesSearch(artwork, normalizedQuery) &&
          (selectedCategory === 'all' ||
            getStudioCategory(artwork) === selectedCategory) &&
          priceInTier(artwork.price_usd, selectedTier),
      ),
    [artworks, normalizedQuery, selectedCategory, selectedTier],
  );

  const activeCategory =
    selectedCategory === 'all'
      ? null
      : getStudioCategoryDefinition(selectedCategory);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.shell}>
        <StudioMasthead
          desktop={desktopWeb}
          eyebrow="The catalog"
          title="Discover"
        />

        <View style={styles.intro}>
          <Text style={styles.introTitle}>Find the work that stays with you.</Text>
          <Text style={styles.introText}>
            Browse Jay Golding’s studio through collections, materials, and ideas.
          </Text>
        </View>

        <View style={styles.filterBand}>
          <View style={styles.searchInputWrap}>
            <Ionicons
              name="search-outline"
              size={18}
              color={theme.isDark ? '#A9A4AE' : '#706B74'}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search title, material, subject, or tag"
              placeholderTextColor={theme.isDark ? '#827D86' : '#858087'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>

          <View style={styles.filterChipGroups}>
            <ScrollView
              style={styles.categoryFilterScroll}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryFilters}
            >
              <FilterChip
                label="All"
                active={selectedCategory === 'all'}
                onPress={() => setSelectedCategory('all')}
                styles={styles}
              />
              {STUDIO_CATEGORIES.map((category) => (
                <FilterChip
                  key={category.key}
                  label={category.label}
                  active={selectedCategory === category.key}
                  onPress={() => setSelectedCategory(category.key)}
                  styles={styles}
                />
              ))}
            </ScrollView>

            <ScrollView
              style={styles.categoryFilterScroll}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryFilters}
            >
              {PRICE_TIERS.map((tier) => (
                <FilterChip
                  key={tier.key}
                  // Stacked under the category row, a bare "All" would read as
                  // a second copy of that row's "All".
                  label={tier.key === 'all' ? 'Any price' : tier.label}
                  active={selectedTier === tier.key}
                  onPress={() => setSelectedTier(tier.key)}
                  styles={styles}
                />
              ))}
            </ScrollView>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={styles.mutedText}>Loading the studio catalog…</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingState}>
            <Ionicons name="alert-circle-outline" size={27} color="#C7654D" />
            <Text style={styles.emptyTitle}>Discover is unavailable</Text>
            <Text style={styles.mutedText}>{error}</Text>
          </View>
        ) : (
          <>
            {selectedCategory === 'all' && collections.length > 0 ? (
              <View style={styles.collectionsSection}>
                <SectionHeading
                  eyebrow="Curated by the artist"
                  title="Bodies of work"
                  styles={styles}
                />
                <View style={styles.collectionList}>
                  {collections.map((collection) => (
                    <Link
                      key={collection.id}
                      href={`/collection/${collection.id}`}
                      asChild
                    >
                      <TouchableOpacity
                        style={styles.collectionItem}
                        activeOpacity={0.91}
                      >
                        <View style={styles.collectionCover}>
                          {collection.cover?.image_url ? (
                            <Image
                              source={{ uri: collection.cover.image_url }}
                              style={styles.collectionCoverImage}
                              resizeMode="contain"
                            />
                          ) : (
                            <View style={styles.imagePlaceholder}>
                              <Ionicons
                                name="images-outline"
                                size={28}
                                color={theme.accent}
                              />
                            </View>
                          )}
                        </View>
                        <View style={styles.collectionCopy}>
                          <Text style={styles.collectionMeta}>
                            {formatCollectionYears(collection)}
                          </Text>
                          <Text style={styles.collectionTitle}>
                            {collection.title}
                          </Text>
                          {collection.description ? (
                            <Text
                              style={styles.collectionDescription}
                              numberOfLines={3}
                            >
                              {collection.description}
                            </Text>
                          ) : null}
                          <View style={styles.collectionAction}>
                            <Text style={styles.collectionActionText}>
                              View collection
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={16}
                              color={theme.accent}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Link>
                  ))}
                </View>
              </View>
            ) : null}

            {activeCategory ? (
              <View style={styles.categoryStatement}>
                <Text style={styles.categoryStatementEyebrow}>Studio category</Text>
                <Text style={styles.categoryStatementTitle}>
                  {activeCategory.label}
                </Text>
                <Text style={styles.categoryStatementText}>
                  {activeCategory.description}
                </Text>
              </View>
            ) : null}

            <View style={styles.catalogSection}>
              <SectionHeading
                eyebrow={
                  activeCategory ? activeCategory.shortDescription : 'Full catalog'
                }
                title={activeCategory ? `${activeCategory.label} works` : 'Available works'}
                styles={styles}
              />

              {visibleArtworks.length === 0 ? (
                <View style={styles.emptyCatalog}>
                  <Ionicons
                    name="search-outline"
                    size={28}
                    color={theme.accent}
                  />
                  <Text style={styles.emptyTitle}>No matching works</Text>
                  <Text style={styles.mutedText}>
                    Try another category or price range, or clear the search.
                  </Text>
                </View>
              ) : (
                <ArtworkMasonry
                  artworks={visibleArtworks}
                  columns={desktopWeb ? 4 : 2}
                  styles={styles}
                  desktop={desktopWeb}
                />
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      style={[styles.categoryFilter, active && styles.categoryFilterActive]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text
        style={[
          styles.categoryFilterText,
          active && styles.categoryFilterTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionHeading({
  eyebrow,
  title,
  styles,
}: {
  eyebrow: string;
  title: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

// Cards no longer share a height, so a flex-wrap grid would leave a ragged
// gap under every short card. Dealing them into fixed columns top-to-bottom
// gives the gallery masonry look instead: each column packs independently.
function ArtworkMasonry({
  artworks,
  columns,
  styles,
  desktop,
}: {
  artworks: StudioArtwork[];
  columns: number;
  styles: ReturnType<typeof createStyles>;
  desktop: boolean;
}) {
  const buckets: StudioArtwork[][] = Array.from({ length: columns }, () => []);
  artworks.forEach((artwork, i) => buckets[i % columns].push(artwork));

  return (
    <View style={styles.artworkGrid}>
      {buckets.map((bucket, i) => (
        <View key={i} style={styles.artworkColumn}>
          {bucket.map((artwork) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              styles={styles}
              desktop={desktop}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function ArtworkCard({
  artwork,
  styles,
  desktop,
}: {
  artwork: StudioArtwork;
  styles: ReturnType<typeof createStyles>;
  desktop: boolean;
}) {
  const category = getStudioCategoryDefinition(getStudioCategory(artwork));

  return (
    <Link href={`/artwork/${artwork.id}`} asChild>
      <TouchableOpacity style={styles.artworkCard} activeOpacity={0.9}>
        {artwork.image_url ? (
          <ArtworkImage uri={artwork.image_url} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <ArtworkCaption
          category={category.label}
          title={artwork.title}
          meta={
            [artwork.year, artwork.medium].filter(Boolean).join(' · ') ||
            category.shortDescription
          }
          price={formatArtworkPrice(artwork.price_usd)}
          desktop={desktop}
        />
      </TouchableOpacity>
    </Link>
  );
}

const createStyles = (
  theme: ReturnType<typeof useTheme>,
  desktopWeb = false,
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.isDark ? '#050506' : '#EAE8E4',
    },
    screenContent: {
      alignItems: 'center',
      paddingBottom: desktopWeb ? 64 : 106,
    },
    shell: {
      width: '100%',
      maxWidth: desktopWeb ? 1320 : 760,
      overflow: 'hidden',
      backgroundColor: theme.background,
    },
    intro: {
      paddingHorizontal: desktopWeb ? 42 : 18,
      paddingTop: desktopWeb ? 58 : 30,
      paddingBottom: desktopWeb ? 48 : 26,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    introTitle: {
      maxWidth: desktopWeb ? 820 : 520,
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 50 : 32,
      lineHeight: desktopWeb ? 58 : 38,
      marginBottom: 10,
    },
    introText: {
      maxWidth: desktopWeb ? 720 : 520,
      color: theme.text,
      opacity: 0.62,
      fontSize: desktopWeb ? 16 : 13,
      lineHeight: desktopWeb ? 25 : 20,
    },
    filterBand: {
      paddingHorizontal: desktopWeb ? 42 : 0,
      paddingTop: desktopWeb ? 20 : 16,
      paddingBottom: desktopWeb ? 20 : 8,
      flexDirection: desktopWeb ? 'row' : 'column',
      alignItems: desktopWeb ? 'center' : undefined,
      gap: desktopWeb ? 18 : 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchInputWrap: {
      minHeight: 48,
      width: desktopWeb ? 520 : undefined,
      marginHorizontal: desktopWeb ? 0 : 18,
      paddingHorizontal: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 5,
    },
    searchInput: {
      minWidth: 0,
      flex: 1,
      color: theme.text,
      fontSize: 13,
    },
    // Two chip rows (category, then price tier) share the space beside the
    // search field on desktop and stack under it on mobile.
    //
    // No `flex` on mobile: RNW compiles `flex: 0` to `flex: 0 1 0%`, i.e. a
    // zero flex-basis that never grows, which collapses this column to height
    // 0 and stacks both chip rows on top of each other. Auto height is what
    // this wants.
    filterChipGroups: {
      minWidth: 0,
      flex: desktopWeb ? 1 : undefined,
      gap: desktopWeb ? 8 : 0,
    },
    categoryFilters: {
      paddingHorizontal: desktopWeb ? 0 : 18,
      paddingTop: desktopWeb ? 0 : 10,
      paddingBottom: desktopWeb ? 0 : 8,
      gap: 7,
    },
    categoryFilterScroll: {
      minWidth: 0,
      flexGrow: 0,
    },
    categoryFilter: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
    },
    categoryFilterActive: {
      backgroundColor: theme.text,
      borderColor: theme.text,
    },
    categoryFilterText: {
      color: theme.text,
      opacity: 0.64,
      fontSize: 11,
      fontWeight: '700',
    },
    categoryFilterTextActive: {
      color: theme.background,
      opacity: 1,
    },
    loadingState: {
      minHeight: 300,
      marginHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    mutedText: {
      maxWidth: 380,
      color: theme.text,
      opacity: 0.58,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    collectionsSection: {
      paddingTop: 10,
    },
    sectionHeading: {
      minHeight: desktopWeb ? 130 : 100,
      paddingHorizontal: desktopWeb ? 42 : 18,
      paddingTop: desktopWeb ? 48 : 28,
      paddingBottom: desktopWeb ? 20 : 15,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
    },
    sectionHeadingCopy: {
      minWidth: 0,
      flex: 1,
    },
    sectionEyebrow: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginBottom: 5,
    },
    sectionTitle: {
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 34 : 25,
      lineHeight: desktopWeb ? 40 : 30,
    },
    collectionList: {
      paddingHorizontal: desktopWeb ? 42 : 0,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    collectionItem: {
      paddingHorizontal: desktopWeb ? 0 : 18,
      paddingVertical: desktopWeb ? 38 : 24,
      flexDirection: desktopWeb ? 'row' : 'column',
      alignItems: desktopWeb ? 'center' : undefined,
      gap: desktopWeb ? 38 : 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    collectionCover: {
      width: desktopWeb ? '52%' : '100%',
      aspectRatio: desktopWeb ? 1.45 : 1.18,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: theme.isDark ? '#111013' : '#E7E4DF',
      borderRadius: 5,
    },
    collectionCoverImage: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? '#111013' : '#E7E4DF',
    },
    collectionCopy: {
      minWidth: 0,
      flex: desktopWeb ? 1 : 0,
      paddingTop: desktopWeb ? 0 : 15,
    },
    collectionMeta: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginBottom: 6,
    },
    collectionTitle: {
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 38 : 27,
      lineHeight: desktopWeb ? 45 : 33,
    },
    collectionDescription: {
      maxWidth: 620,
      color: theme.text,
      opacity: 0.62,
      fontSize: desktopWeb ? 15 : 12,
      lineHeight: desktopWeb ? 24 : 19,
      marginTop: 9,
    },
    collectionAction: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 10,
    },
    collectionActionText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '800',
    },
    categoryStatement: {
      paddingHorizontal: desktopWeb ? 42 : 18,
      paddingVertical: desktopWeb ? 48 : 28,
      backgroundColor: '#080709',
      borderBottomWidth: 1,
      borderBottomColor: '#2A1E34',
    },
    categoryStatementEyebrow: {
      color: '#B866FF',
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginBottom: 5,
    },
    categoryStatementTitle: {
      color: '#FFFFFF',
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 42 : 30,
      marginBottom: 8,
    },
    categoryStatementText: {
      maxWidth: desktopWeb ? 720 : 560,
      color: '#BFB9C3',
      fontSize: desktopWeb ? 15 : 12,
      lineHeight: desktopWeb ? 24 : 19,
    },
    catalogSection: {
      paddingBottom: 26,
    },
    artworkGrid: {
      paddingHorizontal: desktopWeb ? 42 : 18,
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: desktopWeb ? 26 : 14,
    },
    artworkColumn: {
      flex: 1,
      minWidth: 0,
      rowGap: desktopWeb ? 44 : 28,
    },
    artworkCard: {
      width: '100%',
      minWidth: 0,
    },
    emptyCatalog: {
      minHeight: 220,
      marginHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
  });
