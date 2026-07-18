import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { Link, useRouter } from 'expo-router';
import { StudioLogo } from '../../components/StudioLogo';
import { StudioMasthead } from '../../components/StudioMasthead';
import {
  STUDIO,
  PRICE_TIERS,
  priceInTier,
  type PriceTierKey,
} from '../../constants/studioContent';
import {
  getStudioCategory,
  STUDIO_CATEGORIES,
} from '../../lib/artworkCategories';
import {
  formatArtworkPrice,
  listPublishedCollections,
  type StudioArtwork,
  type StudioCollection,
} from '../../lib/studioCollections';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../themeContext';

const viewportWidth = Math.min(Dimensions.get('window').width, 760);
const ARTWORK_CARD_WIDTH = Math.min(viewportWidth * 0.64, 300);
const CATEGORY_CARD_WIDTH = Math.min(viewportWidth * 0.72, 330);
const COLLECTION_CARD_WIDTH = Math.min(viewportWidth * 0.76, 360);
const AUCTION_CARD_WIDTH = Math.min(viewportWidth * 0.64, 300);

type ArtPiece = StudioArtwork & {
  created_at?: string;
};

type AuctionLotRow = {
  id: string;
  art_piece_id: number;
  starting_bid: number | null;
  current_bid: number | null;
  start_time: string | null;
  end_time: string | null;
  status: 'upcoming' | 'live';
};

type AuctionCard = {
  lotId: string;
  artworkId: number;
  title: string;
  imageUrl: string;
  currentBid: number;
  status: 'upcoming' | 'live';
  timeLabel: string;
};

function pluralize(value: number, singular: string) {
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}

function getTimeUntil(targetIso: string | null, prefix: 'Starts' | 'Ends') {
  if (!targetIso) return 'Schedule pending';
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return `${prefix} soon`;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor(diff / 60_000);
  if (days >= 1) return `${prefix} in ${pluralize(days, 'day')}`;
  if (hours >= 1) return `${prefix} in ${pluralize(hours, 'hour')}`;
  return `${prefix} in ${pluralize(Math.max(minutes, 1), 'minute')}`;
}

function isJustAdded(dateString?: string) {
  if (!dateString) return false;
  return Date.now() - new Date(dateString).getTime() <= 7 * 86_400_000;
}

function artworkMatchesSearch(artwork: ArtPiece, query: string) {
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

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 960;
  const styles = createStyles(theme, desktopWeb);
  const [artworks, setArtworks] = useState<ArtPiece[]>([]);
  const [collections, setCollections] = useState<StudioCollection[]>([]);
  const [auctionLots, setAuctionLots] = useState<AuctionLotRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<PriceTierKey>('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      setLoading(true);
      setError('');
      try {
        const [
          { data: artworkData, error: artworkError },
          { data: auctionData, error: auctionError },
          nextCollections,
        ] = await Promise.all([
          supabase
            .from('art_pieces')
            .select('*')
            .not('atlas_artwork_id', 'is', null)
            .not('published_at', 'is', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('auction_lots')
            .select(
              'id, art_piece_id, starting_bid, current_bid, start_time, end_time, status',
            )
            .in('status', ['live', 'upcoming'])
            .order('start_time', { ascending: true }),
          listPublishedCollections(),
        ]);

        if (artworkError) throw artworkError;
        if (auctionError) throw auctionError;
        if (cancelled) return;

        setArtworks((artworkData ?? []) as ArtPiece[]);
        setAuctionLots((auctionData ?? []) as AuctionLotRow[]);
        setCollections(nextCollections);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'The studio catalog could not be loaded.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHome();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredArtworks = useMemo(
    () =>
      artworks.filter(
        (artwork) =>
          artworkMatchesSearch(artwork, normalizedSearch) &&
          priceInTier(artwork.price_usd, selectedTier),
      ),
    [artworks, normalizedSearch, selectedTier],
  );

  const heroCandidates = useMemo(
    () => artworks.filter((artwork) => Boolean(artwork.image_url)),
    [artworks],
  );

  useEffect(() => {
    if (heroCandidates.length <= 1) return;
    const interval = setInterval(
      () => setHeroIndex((current) => (current + 1) % heroCandidates.length),
      5600,
    );
    return () => clearInterval(interval);
  }, [heroCandidates.length]);

  const heroArtwork =
    heroCandidates.length > 0
      ? heroCandidates[heroIndex % heroCandidates.length]
      : null;

  const categorySummaries = useMemo(
    () =>
      STUDIO_CATEGORIES.map((category) => {
        const categoryWorks = artworks.filter(
          (artwork) => getStudioCategory(artwork) === category.key,
        );
        return {
          ...category,
          cover: categoryWorks.find((artwork) => artwork.image_url) ?? null,
        };
      }),
    [artworks],
  );

  const newWorks = filteredArtworks.slice(0, 8);

  const auctionCards = useMemo(() => {
    const artworkById = new Map(artworks.map((artwork) => [artwork.id, artwork]));
    return auctionLots
      .map((lot) => {
        const artwork = artworkById.get(lot.art_piece_id);
        if (!artwork?.image_url) return null;
        return {
          lotId: lot.id,
          artworkId: artwork.id,
          title: artwork.title,
          imageUrl: artwork.image_url,
          currentBid: Number(lot.current_bid ?? lot.starting_bid ?? 0),
          status: lot.status,
          timeLabel:
            lot.status === 'live'
              ? getTimeUntil(lot.end_time, 'Ends')
              : getTimeUntil(lot.start_time, 'Starts'),
        } as AuctionCard;
      })
      .filter((lot): lot is AuctionCard => Boolean(lot))
      .slice(0, 6);
  }, [artworks, auctionLots]);

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
          action={
            <TouchableOpacity
              style={styles.mastheadButton}
              activeOpacity={0.8}
              onPress={() => router.push('/notifications')}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color="#F8F5FA" />
            </TouchableOpacity>
          }
        />

        {/* One-line welcome orienting first-time visitors to the studio. */}
        <Text style={styles.welcomeBlurb}>{STUDIO.welcome}</Text>

        {/* Artist spotlight leads the page so visitors meet Jay first. */}
        <View style={styles.artistFeature}>
          {/* aspectRatio must live on a wrapper View — RNW ignores it on
              Image and falls back to the file's intrinsic height. */}
          <View style={styles.artistImageFrame}>
            <Image
              source={require('../../assets/jay-golding.jpeg')}
              style={styles.artistImage}
            />
          </View>
          <View style={styles.artistCopy}>
            <Text style={styles.artistEyebrow}>Inside the practice</Text>
            <Text style={styles.artistTitle}>{STUDIO.artistName}</Text>
            <Text style={styles.artistText} numberOfLines={5}>
              {STUDIO.statement[0]}
            </Text>
            <Text style={styles.artistTagline}>{STUDIO.tagline}</Text>
          </View>
        </View>

        {heroArtwork?.image_url ? (
          <Link href={`/artwork/${heroArtwork.id}`} asChild>
            <TouchableOpacity style={styles.hero} activeOpacity={0.94}>
              <View style={styles.heroImageFrame}>
                <Image
                  source={{ uri: heroArtwork.image_url }}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.heroCaption}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>Featured in the studio</Text>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {heroArtwork.title}
                  </Text>
                  <Text style={styles.heroMeta}>
                    {[
                      heroArtwork.year,
                      heroArtwork.medium,
                      formatArtworkPrice(heroArtwork.price_usd),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.heroArrow}>
                  <Ionicons name="arrow-forward" size={20} color="#0B0A0C" />
                </View>
              </View>
            </TouchableOpacity>
          </Link>
        ) : (
          <View style={styles.emptyHero}>
            <StudioLogo />
            <Text style={styles.emptyHeroTitle}>The studio is being prepared.</Text>
          </View>
        )}

        <View style={styles.searchSection}>
          <View style={styles.searchInputWrap}>
            <Ionicons
              name="search-outline"
              size={18}
              color={theme.isDark ? '#A9A4AE' : '#706B74'}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search works, materials, or tags"
              placeholderTextColor={theme.isDark ? '#827D86' : '#858087'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>
          <ScrollView
            style={styles.priceFilterScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.priceFilters}
          >
            {PRICE_TIERS.map((tier) => {
              const active = selectedTier === tier.key;
              return (
                <TouchableOpacity
                  key={tier.key}
                  style={[styles.priceFilter, active && styles.priceFilterActive]}
                  onPress={() => setSelectedTier(tier.key)}
                  activeOpacity={0.82}
                >
                  <Text
                    style={[
                      styles.priceFilterText,
                      active && styles.priceFilterTextActive,
                    ]}
                  >
                    {tier.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.mutedText}>Opening the studio catalog…</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingState}>
            <Ionicons name="alert-circle-outline" size={25} color="#C7654D" />
            <Text style={styles.errorTitle}>The catalog is unavailable</Text>
            <Text style={styles.mutedText}>{error}</Text>
          </View>
        ) : (
          <>
            <SectionHeader
              eyebrow="Explore"
              title="Browse the studio"
              action="Discover all"
              onAction={() => router.push('/discover')}
              styles={styles}
            />
            <ResponsiveRail
              desktop={desktopWeb}
              styles={styles}
              snapToInterval={CATEGORY_CARD_WIDTH + 12}
            >
              {categorySummaries.map((category) => (
                <TouchableOpacity
                  key={category.key}
                  style={styles.categoryCard}
                  activeOpacity={0.9}
                  onPress={() =>
                    router.push({
                      pathname: '/discover',
                      params: { category: category.key },
                    })
                  }
                >
                  <View style={styles.categoryImageFrame}>
                    {category.cover?.image_url ? (
                      <Image
                        source={{ uri: category.cover.image_url }}
                        style={styles.categoryImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.categoryPlaceholder}>
                        <Ionicons
                          name="image-outline"
                          size={28}
                          color={theme.accent}
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.categoryCopy}>
                      <View style={styles.categoryTitleRow}>
                        <Text style={styles.categoryTitle}>{category.label}</Text>
                      </View>
                    <Text style={styles.categoryDescription} numberOfLines={2}>
                      {category.shortDescription}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ResponsiveRail>

            <SectionHeader
              eyebrow="Recently published"
              title="New in the studio"
              action="View all"
              onAction={() => router.push('/discover')}
              styles={styles}
            />
            {newWorks.length > 0 ? (
              <ResponsiveRail
                desktop={desktopWeb}
                styles={styles}
                snapToInterval={ARTWORK_CARD_WIDTH + 12}
              >
                {newWorks.map((artwork) => (
                  <ArtworkRailCard
                    key={artwork.id}
                    artwork={artwork}
                    styles={styles}
                  />
                ))}
              </ResponsiveRail>
            ) : (
              <Text style={styles.emptyText}>
                No works match the current search and price filters.
              </Text>
            )}

            {collections.length > 0 ? (
              <>
                <SectionHeader
                  eyebrow="Curated bodies of work"
                  title="Studio collections"
                  action="Discover"
                  onAction={() => router.push('/discover')}
                  styles={styles}
                />
                <ResponsiveRail
                  desktop={desktopWeb}
                  styles={styles}
                  snapToInterval={COLLECTION_CARD_WIDTH + 12}
                >
                  {collections.slice(0, 6).map((collection) => (
                    <Link
                      key={collection.id}
                      href={`/collection/${collection.id}`}
                      asChild
                    >
                      <TouchableOpacity
                        style={styles.collectionCard}
                        activeOpacity={0.9}
                      >
                        <View style={styles.collectionImageFrame}>
                          {collection.cover?.image_url ? (
                            <Image
                              source={{ uri: collection.cover.image_url }}
                              style={styles.collectionImage}
                              resizeMode="contain"
                            />
                          ) : (
                            <View style={styles.categoryPlaceholder} />
                          )}
                        </View>
                        <Text style={styles.collectionEyebrow}>Studio collection</Text>
                        <Text style={styles.collectionTitle} numberOfLines={2}>
                          {collection.title}
                        </Text>
                      </TouchableOpacity>
                    </Link>
                  ))}
                </ResponsiveRail>
              </>
            ) : null}

            {auctionCards.length > 0 ? (
              <>
                <SectionHeader
                  eyebrow="Timed releases"
                  title="Auctions"
                  action="View auctions"
                  onAction={() => router.push('/auctions')}
                  styles={styles}
                />
                <ResponsiveRail
                  desktop={desktopWeb}
                  styles={styles}
                  snapToInterval={AUCTION_CARD_WIDTH + 12}
                >
                  {auctionCards.map((lot) => (
                    <Link
                      key={lot.lotId}
                      href={`/artwork/${lot.artworkId}`}
                      asChild
                    >
                      <TouchableOpacity
                        style={styles.auctionCard}
                        activeOpacity={0.9}
                      >
                        <Image
                          source={{ uri: lot.imageUrl }}
                          style={styles.auctionImage}
                          resizeMode="contain"
                        />
                        <View style={styles.auctionCopy}>
                          <View style={styles.auctionStatusRow}>
                            <Text style={styles.auctionStatus}>
                              {lot.status === 'live' ? 'Live now' : 'Upcoming'}
                            </Text>
                            <Text style={styles.auctionTime}>{lot.timeLabel}</Text>
                          </View>
                          <Text style={styles.auctionTitle} numberOfLines={1}>
                            {lot.title}
                          </Text>
                          <Text style={styles.auctionBid}>
                            {formatArtworkPrice(lot.currentBid)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </Link>
                  ))}
                </ResponsiveRail>
              </>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function ResponsiveRail({
  children,
  desktop,
  snapToInterval,
  styles,
}: {
  children: React.ReactNode;
  desktop: boolean;
  snapToInterval: number;
  styles: ReturnType<typeof createStyles>;
}) {
  if (desktop) {
    return <View style={[styles.rail, styles.desktopRail]}>{children}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      snapToInterval={snapToInterval}
      decelerationRate="fast"
    >
      {children}
    </ScrollView>
  );
}

function ArtworkRailCard({
  artwork,
  styles,
}: {
  artwork: ArtPiece;
  styles: ReturnType<typeof createStyles>;
}) {
  const category = STUDIO_CATEGORIES.find(
    (candidate) => candidate.key === getStudioCategory(artwork),
  );

  return (
    <Link href={`/artwork/${artwork.id}`} asChild>
      <TouchableOpacity style={styles.artworkCard} activeOpacity={0.9}>
        <View style={styles.artworkImageFrame}>
          {artwork.image_url ? (
            <Image
              source={{ uri: artwork.image_url }}
              style={styles.artworkImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.categoryPlaceholder} />
          )}
          {isJustAdded(artwork.created_at) ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>New</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.artworkCategory}>{category?.label}</Text>
        <Text style={styles.artworkTitle} numberOfLines={2}>
          {artwork.title}
        </Text>
        <View style={styles.artworkMetaRow}>
          <Text style={styles.artworkMeta} numberOfLines={1}>
            {[artwork.year, artwork.medium].filter(Boolean).join(' · ') ||
              'Studio work'}
          </Text>
          <Text style={styles.artworkPrice}>
            {formatArtworkPrice(artwork.price_usd)}
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
  onAction,
  styles,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && onAction ? (
        <TouchableOpacity
          style={styles.sectionAction}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="arrow-forward" size={15} color="#8D48C5" />
        </TouchableOpacity>
      ) : null}
    </View>
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
      paddingBottom: desktopWeb ? 0 : 106,
    },
    shell: {
      width: '100%',
      maxWidth: desktopWeb ? 1320 : 760,
      overflow: 'hidden',
      backgroundColor: theme.background,
    },
    mastheadButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#3B3341',
      borderRadius: 6,
    },
    hero: {
      flexDirection: desktopWeb ? 'row' : 'column',
      backgroundColor: '#080709',
    },
    heroImageFrame: {
      width: desktopWeb ? '68%' : '100%',
      aspectRatio: desktopWeb ? 1.3 : 0.94,
      position: 'relative',
      // Match the hero background so a `contain`-fitted work floats flush
      // instead of sitting inside a visibly lighter panel.
      backgroundColor: '#080709',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroCaption: {
      width: desktopWeb ? '32%' : '100%',
      minHeight: desktopWeb ? 0 : 138,
      paddingHorizontal: desktopWeb ? 36 : 18,
      paddingVertical: desktopWeb ? 38 : 20,
      flexDirection: 'row',
      alignItems: desktopWeb ? 'center' : 'flex-end',
      justifyContent: 'space-between',
      gap: 18,
      backgroundColor: '#080709',
    },
    heroCopy: {
      minWidth: 0,
      flex: 1,
    },
    heroEyebrow: {
      color: '#B866FF',
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginBottom: 7,
    },
    heroTitle: {
      color: '#FFFFFF',
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 42 : 31,
      lineHeight: desktopWeb ? 48 : 36,
      marginBottom: 7,
    },
    heroMeta: {
      color: '#B9B3BD',
      fontSize: 12,
      lineHeight: 18,
    },
    heroArrow: {
      width: 42,
      height: 42,
      flex: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#B866FF',
      borderRadius: 4,
    },
    emptyHero: {
      minHeight: 330,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
      backgroundColor: '#080709',
    },
    emptyHeroTitle: {
      color: '#F7F4F8',
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: 23,
    },
    searchSection: {
      paddingTop: desktopWeb ? 20 : 18,
      paddingBottom: desktopWeb ? 20 : 8,
      paddingHorizontal: desktopWeb ? 42 : 0,
      flexDirection: desktopWeb ? 'row' : 'column',
      alignItems: desktopWeb ? 'center' : undefined,
      gap: desktopWeb ? 18 : 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchInputWrap: {
      height: 48,
      width: desktopWeb ? 430 : undefined,
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
      fontSize: 14,
    },
    priceFilters: {
      paddingHorizontal: desktopWeb ? 0 : 18,
      paddingTop: desktopWeb ? 0 : 10,
      paddingBottom: desktopWeb ? 0 : 8,
      gap: 7,
    },
    priceFilterScroll: {
      minWidth: 0,
      flex: desktopWeb ? 1 : 0,
    },
    priceFilter: {
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: 11,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
    },
    priceFilterActive: {
      backgroundColor: theme.text,
      borderColor: theme.text,
    },
    priceFilterText: {
      color: theme.text,
      opacity: 0.68,
      fontSize: 11,
      fontWeight: '700',
    },
    priceFilterTextActive: {
      color: theme.background,
      opacity: 1,
    },
    loadingState: {
      minHeight: 260,
      marginHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    errorTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    mutedText: {
      maxWidth: 380,
      color: theme.text,
      opacity: 0.58,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
    sectionHeader: {
      minHeight: desktopWeb ? 124 : 94,
      paddingHorizontal: desktopWeb ? 42 : 18,
      paddingTop: desktopWeb ? 48 : 28,
      paddingBottom: desktopWeb ? 18 : 14,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
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
      fontSize: desktopWeb ? 32 : 24,
      lineHeight: desktopWeb ? 38 : 29,
    },
    sectionAction: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingLeft: 8,
    },
    sectionActionText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '700',
    },
    rail: {
      paddingHorizontal: desktopWeb ? 42 : 18,
      gap: 12,
    },
    desktopRail: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      rowGap: 34,
    },
    categoryCard: {
      width: desktopWeb ? '32.6%' : CATEGORY_CARD_WIDTH,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      overflow: 'hidden',
    },
    categoryImageFrame: {
      width: '100%',
      aspectRatio: 1.45,
      backgroundColor: theme.isDark ? '#0E0D10' : '#E7E4DF',
    },
    categoryImage: {
      width: '100%',
      height: '100%',
    },
    categoryPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? '#0E0D10' : '#E7E4DF',
    },
    categoryCopy: {
      minHeight: 78,
      padding: 13,
    },
    categoryTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 5,
    },
    categoryTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    categoryDescription: {
      color: theme.text,
      opacity: 0.56,
      fontSize: 11,
      lineHeight: 16,
    },
    artworkCard: {
      width: desktopWeb ? '24%' : ARTWORK_CARD_WIDTH,
    },
    artworkImageFrame: {
      width: '100%',
      aspectRatio: 0.86,
      position: 'relative',
      backgroundColor: theme.isDark ? '#111013' : '#E7E4DF',
      borderRadius: 5,
      overflow: 'hidden',
    },
    artworkImage: {
      width: '100%',
      height: '100%',
    },
    newBadge: {
      position: 'absolute',
      top: 9,
      left: 9,
      paddingHorizontal: 8,
      paddingVertical: 5,
      backgroundColor: '#C45E43',
      borderRadius: 3,
    },
    newBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    artworkCategory: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginTop: 11,
      marginBottom: 5,
    },
    artworkTitle: {
      minHeight: 42,
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: 18,
      lineHeight: 21,
    },
    artworkMetaRow: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      paddingTop: 7,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    artworkMeta: {
      minWidth: 0,
      flex: 1,
      color: theme.text,
      opacity: 0.52,
      fontSize: 10,
    },
    artworkPrice: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '800',
    },
    collectionCard: {
      width: desktopWeb ? '32.6%' : COLLECTION_CARD_WIDTH,
    },
    collectionImageFrame: {
      width: '100%',
      aspectRatio: 1.22,
      backgroundColor: theme.isDark ? '#111013' : '#E7E4DF',
      borderRadius: 5,
      overflow: 'hidden',
    },
    collectionImage: {
      width: '100%',
      height: '100%',
    },
    collectionEyebrow: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginTop: 11,
      marginBottom: 5,
    },
    collectionTitle: {
      minHeight: 48,
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: 21,
      lineHeight: 24,
    },
    auctionCard: {
      width: desktopWeb ? '24%' : AUCTION_CARD_WIDTH,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: theme.card,
    },
    auctionImage: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: theme.isDark ? '#111013' : '#E7E4DF',
    },
    auctionCopy: {
      padding: 13,
    },
    auctionStatusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 7,
    },
    auctionStatus: {
      color: '#C45E43',
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    auctionTime: {
      color: theme.text,
      opacity: 0.52,
      fontSize: 9,
    },
    auctionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 5,
    },
    auctionBid: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    artistFeature: {
      minHeight: 310,
      marginTop: desktopWeb ? 72 : 42,
      // Breathing room before the featured artwork below (the spotlight now
      // leads the page, so it needs space on both sides, not just above).
      marginBottom: desktopWeb ? 72 : 42,
      flexDirection:
        desktopWeb || viewportWidth >= 580 ? 'row' : 'column',
      backgroundColor: '#080709',
      borderTopWidth: 1,
      borderTopColor: '#2A1E34',
    },
    artistImageFrame: {
      width:
        desktopWeb || viewportWidth >= 580 ? '42%' : '100%',
      // 4:3 matches the studio portrait's crop, so nothing is cut off.
      // alignSelf stops the flex row from stretching this to the height of
      // the text column beside it.
      aspectRatio: 1.33,
      alignSelf: 'flex-start',
      overflow: 'hidden',
    },
    artistImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    artistCopy: {
      minWidth: 0,
      flex: 1,
      justifyContent: 'center',
      padding: desktopWeb ? 56 : 24,
    },
    artistEyebrow: {
      color: '#B866FF',
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginBottom: 6,
    },
    artistTitle: {
      color: '#FFFFFF',
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 42 : 27,
      marginBottom: 11,
    },
    artistText: {
      color: '#C3BDC7',
      fontSize: desktopWeb ? 15 : 12,
      lineHeight: desktopWeb ? 24 : 19,
      marginBottom: 13,
    },
    artistTagline: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
    },
    welcomeBlurb: {
      color: theme.isDark ? '#B7B0C4' : '#4A4553',
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 18 : 15,
      lineHeight: desktopWeb ? 27 : 22,
      textAlign: 'center',
      marginTop: desktopWeb ? 26 : 18,
      marginHorizontal: desktopWeb ? 40 : 22,
      maxWidth: 760,
      alignSelf: 'center',
    },
    emptyText: {
      marginHorizontal: 18,
      paddingVertical: 26,
      color: theme.text,
      opacity: 0.58,
      fontSize: 13,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
  });
