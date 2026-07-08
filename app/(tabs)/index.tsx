import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../themeContext';

const { width } = Dimensions.get('window');

const categoryTiles = [
  {
    key: 'Paintings',
    label: 'Paintings',
    image: require('../../assets/categories/paintings.jpg'),
  },
  {
    key: 'Mixed Media',
    label: 'Mixed Media',
    image: require('../../assets/categories/mixed-media.jpg'),
  },
  {
    key: 'Prints',
    label: 'Prints',
    image: require('../../assets/categories/prints.jpg'),
  },
  {
    key: 'Drawings',
    label: 'Drawings',
    image: require('../../assets/categories/drawings.jpg'),
  },
];

const HERO_HEIGHT = width * 1.05;
const FEATURE_CARD_WIDTH = width * 0.72;
const AUCTION_CARD_WIDTH = width * 0.58;
const CATEGORY_PREVIEW_CARD_WIDTH = width * 0.42;

type ArtPiece = {
  id: number;
  title: string;
  image_url: string;
  price_usd: number;
  collection_type?: string;
  medium?: string;
  created_at?: string;
};

type AuctionLotRow = {
  id: string;
  art_piece_id: number;
  starting_bid: number | null;
  current_bid: number | null;
  start_time: string | null;
  end_time: string | null;
  status: 'upcoming' | 'live' | 'closed' | 'sold' | 'passed' | 'draft';
  total_bids: number | null;
};

type AuctionCard = {
  lotId: string;
  artworkId: number;
  title: string;
  image_url: string;
  currentBid: number;
  timeLabel: string;
};

type PriceFilter = 'all' | 'under250' | '250to500' | '500to1000' | '1000plus';

const CATEGORY_MAP: Record<string, string[]> = {
  Paintings: ['Paintings', 'Painting'],
  'Mixed Media': ['Mixed Media', 'mixed media', 'Mixed media'],
  Prints: ['Prints', 'Print'],
  Drawings: ['Drawings', 'Drawing'],
};

function matchesCategory(item: ArtPiece, category: string) {
  const allowedValues = CATEGORY_MAP[category] || [category];
  const normalizedMedium = (item.medium || '').toLowerCase().trim();

  return allowedValues.some(
    (value) => value.toLowerCase().trim() === normalizedMedium
  );
}

function pluralize(value: number, singular: string, plural?: string) {
  return `${value} ${value === 1 ? singular : plural ?? `${singular}s`}`;
}

function getTimeUntil(targetIso: string | null, prefix: 'Starts in' | 'Ends in') {
  if (!targetIso) return prefix === 'Starts in' ? 'Schedule TBD' : 'Ending soon';

  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return prefix === 'Starts in' ? 'Starting soon' : 'Ending soon';
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days >= 1) return `${prefix} ${pluralize(days, 'day')}`;
  if (hours >= 1) return `${prefix} ${pluralize(hours, 'hour')}`;
  return `${prefix} ${pluralize(Math.max(minutes, 1), 'minute')}`;
}

function isJustAdded(dateString?: string) {
  if (!dateString) return false;

  const created = new Date(dateString).getTime();
  const now = Date.now();
  const hoursDiff = (now - created) / (1000 * 60 * 60);

  return hoursDiff <= 24;
}

function passesPriceFilter(item: ArtPiece, priceFilter: PriceFilter) {
  const price = Number(item.price_usd || 0);

  switch (priceFilter) {
    case 'under250':
      return price < 250;
    case '250to500':
      return price >= 250 && price <= 500;
    case '500to1000':
      return price > 500 && price <= 1000;
    case '1000plus':
      return price > 1000;
    case 'all':
    default:
      return true;
  }
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
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function Home() {
  const theme = useTheme();
  const router = useRouter();
  const styles = createStyles(theme);

  const [artworks, setArtworks] = useState<ArtPiece[]>([]);
  const [auctionLots, setAuctionLots] = useState<AuctionLotRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [selectedPriceFilter, setSelectedPriceFilter] = useState<PriceFilter>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: artData, error: artError } = await supabase
      .from('art_pieces')
      .select('*')
      .order('created_at', { ascending: false });

    if (artError) {
      console.error('Supabase art_pieces error:', artError);
    }

    const { data: auctionData, error: auctionError } = await supabase
      .from('auction_lots')
      .select('id, art_piece_id, starting_bid, current_bid, start_time, end_time, status, total_bids')
      .in('status', ['live', 'upcoming'])
      .order('start_time', { ascending: true });

    if (auctionError) {
      console.error('Supabase auction_lots error:', auctionError);
    }

    const safeArtworks = (artData || []) as ArtPiece[];
    setArtworks(safeArtworks);
    setAuctionLots((auctionData as AuctionLotRow[]) || []);
  };

  const filteredArtworks = useMemo(() => {
    let result = [...artworks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }

    result = result.filter((item) => passesPriceFilter(item, selectedPriceFilter));

    return result;
  }, [artworks, searchQuery, selectedPriceFilter]);

  const heroCandidates = useMemo(() => {
    let result = [...artworks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }

    return result;
  }, [artworks, searchQuery]);

  useEffect(() => {
    setHeroIndex(0);
  }, [heroCandidates.length, searchQuery]);

  useEffect(() => {
    if (heroCandidates.length <= 1) return;

    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroCandidates.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [heroCandidates.length]);

  const heroArtwork =
    heroCandidates.length > 0
      ? heroCandidates[heroIndex % heroCandidates.length]
      : undefined;

  const newWorks = useMemo(() => {
    return [...filteredArtworks]
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  }, [filteredArtworks]);

  const auctionCards = useMemo(() => {
    if (!auctionLots.length || !artworks.length) return [];

    const artMap = new Map<number, ArtPiece>();
    artworks.forEach((art) => artMap.set(art.id, art));

    return auctionLots
      .map((lot) => {
        const art = artMap.get(lot.art_piece_id);
        if (!art?.image_url || !art?.title) return null;

        return {
          lotId: lot.id,
          artworkId: art.id,
          title: art.title,
          image_url: art.image_url,
          currentBid: Number(lot.current_bid ?? lot.starting_bid ?? 0),
          timeLabel:
            lot.status === 'live'
              ? getTimeUntil(lot.end_time, 'Ends in')
              : getTimeUntil(lot.start_time, 'Starts in'),
        } as AuctionCard;
      })
      .filter(Boolean)
      .slice(0, 6) as AuctionCard[];
  }, [auctionLots, artworks]);

  const hasActiveAuctions = auctionCards.length > 0;

  const categoryPreviewMap = useMemo(() => {
    return {
      Paintings: filteredArtworks.filter((item) => matchesCategory(item, 'Paintings')).slice(0, 6),
      'Mixed Media': filteredArtworks.filter((item) => matchesCategory(item, 'Mixed Media')).slice(0, 6),
      Prints: filteredArtworks.filter((item) => matchesCategory(item, 'Prints')).slice(0, 6),
      Drawings: filteredArtworks.filter((item) => matchesCategory(item, 'Drawings')).slice(0, 6),
    };
  }, [filteredArtworks]);

  const browseWorks = filteredArtworks.slice(0, 10);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      bounces
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.brand}>JGA STUDIO</Text>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Collect the Studio</Text>

          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.8}
           onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <Ionicons
            name="search-outline"
            size={18}
            color={theme.isDark ? '#9A9A9A' : '#7A7A7A'}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search the studio"
            placeholderTextColor={theme.isDark ? '#8C8C8C' : '#8A8A8A'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip
          label="All"
          active={selectedPriceFilter === 'all'}
          onPress={() => setSelectedPriceFilter('all')}
          styles={styles}
        />
        <FilterChip
          label="Under $250"
          active={selectedPriceFilter === 'under250'}
          onPress={() => setSelectedPriceFilter('under250')}
          styles={styles}
        />
        <FilterChip
          label="$250–$500"
          active={selectedPriceFilter === '250to500'}
          onPress={() => setSelectedPriceFilter('250to500')}
          styles={styles}
        />
        <FilterChip
          label="$500–$1,000"
          active={selectedPriceFilter === '500to1000'}
          onPress={() => setSelectedPriceFilter('500to1000')}
          styles={styles}
        />
        <FilterChip
          label="$1,000+"
          active={selectedPriceFilter === '1000plus'}
          onPress={() => setSelectedPriceFilter('1000plus')}
          styles={styles}
        />
      </ScrollView>

      {heroArtwork && (
        <View style={styles.heroSection}>
          <Link href={`/artwork/${heroArtwork.id}`} asChild>
            <TouchableOpacity activeOpacity={0.92} style={styles.heroCard}>
              <Image source={{ uri: heroArtwork.image_url }} style={styles.heroImage} />
              <View style={styles.heroOverlay} />
              <View style={styles.heroContent}>
                <Text style={styles.heroEyebrow}>Featured Release</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {heroArtwork.title}
                </Text>
                <Text style={styles.heroSubtitle}>
                  A highlighted work from the studio collection
                </Text>
                <View style={styles.heroButton}>
                  <Text style={styles.heroButtonText}>View Work</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Link>

          {heroCandidates.length > 1 && (
            <View style={styles.heroDots}>
              {heroCandidates.slice(0, Math.min(heroCandidates.length, 12)).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.heroDot,
                    index === heroIndex && styles.heroDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <SectionHeader
        title="New Works"
        subtitle="Recent additions from the studio"
        theme={theme}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalListContent}
        decelerationRate="fast"
        snapToInterval={FEATURE_CARD_WIDTH + 16}
        snapToAlignment="start"
        disableIntervalMomentum
      >
        {newWorks.map((item) => (
          <Link key={item.id} href={`/artwork/${item.id}`} asChild>
            <TouchableOpacity activeOpacity={0.9} style={styles.featureCard}>
              <View style={styles.featureImageWrap}>
                <Image source={{ uri: item.image_url }} style={styles.featureImage} />
                {isJustAdded(item.created_at) && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>Just Added</Text>
                  </View>
                )}
              </View>
              <View style={styles.featureMeta}>
                <Text style={styles.featureTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.featurePrice}>${item.price_usd}</Text>
              </View>
            </TouchableOpacity>
          </Link>
        ))}
      </ScrollView>

      <SectionHeader
        title="Collect by Medium"
        subtitle="Browse the studio by category"
        theme={theme}
      />

      <View style={styles.categoryGrid}>
        {categoryTiles.map((tile) => (
          <TouchableOpacity
            key={tile.key}
            activeOpacity={0.9}
            style={styles.categoryTile}
            onPress={() =>
              router.push({
                pathname: '/discover',
                params: { category: tile.key },
              })
            }
          >
            <Image source={tile.image} style={styles.categoryImage} resizeMode="contain" />
            <View style={styles.categoryOverlay} />
            <Text style={styles.categoryLabel}>{tile.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {hasActiveAuctions && (
        <>
          <SectionHeader
            title="Auctions Ending Soon"
            subtitle="Works currently scheduled for bidding"
            theme={theme}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalListContent}
            decelerationRate="fast"
          >
            {auctionCards.map((item) => (
              <Link key={item.lotId} href={`/artwork/${item.artworkId}`} asChild>
                <TouchableOpacity activeOpacity={0.9} style={styles.auctionCard}>
                  <Image source={{ uri: item.image_url }} style={styles.auctionImage} />
                  <View style={styles.auctionInfo}>
                    <View style={styles.auctionBadge}>
                      <Text style={styles.auctionBadgeText}>Auction</Text>
                    </View>
                    <Text style={styles.auctionTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.auctionMeta}>
                      Current bid: ${item.currentBid}
                    </Text>
                    <Text style={styles.auctionMeta}>{item.timeLabel}</Text>
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
          </ScrollView>
        </>
      )}

      <SectionHeader
        title="Browse All Works"
        subtitle="A broader look across the collection"
        theme={theme}
      />

      {browseWorks.length === 0 ? (
        <Text style={styles.emptyText}>No artworks match your search or price filter.</Text>
      ) : (
        <View style={styles.browseGrid}>
          {browseWorks.map((item) => (
            <Link key={item.id} href={`/artwork/${item.id}`} asChild>
              <TouchableOpacity activeOpacity={0.9} style={styles.browseCard}>
                <Image source={{ uri: item.image_url }} style={styles.browseImage} />
                <View style={styles.browseMeta}>
                  <Text style={styles.browseTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.browsePrice}>${item.price_usd}</Text>
                </View>
              </TouchableOpacity>
            </Link>
          ))}
        </View>
      )}

      <SectionHeader
        title="Shop by Category"
        subtitle="A curated preview from each medium"
        theme={theme}
      />

      {categoryTiles.map((tile) => {
        const previewWorks =
          categoryPreviewMap[tile.key as keyof typeof categoryPreviewMap] || [];

        if (previewWorks.length === 0) return null;

        return (
          <View key={tile.key} style={styles.categoryPreviewSection}>
            <View style={styles.categoryPreviewHeader}>
              <Text style={styles.categoryPreviewTitle}>{tile.label}</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/discover',
                    params: { category: tile.key },
                  })
                }
              >
                <Text style={styles.categoryPreviewLink}>View all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalListContent}
              decelerationRate="fast"
            >
              {previewWorks.map((item) => (
                <Link key={item.id} href={`/artwork/${item.id}`} asChild>
                  <TouchableOpacity activeOpacity={0.9} style={styles.categoryPreviewCard}>
                    <Image source={{ uri: item.image_url }} style={styles.categoryPreviewImage} />
                    <View style={styles.categoryPreviewMeta}>
                      <Text style={styles.categoryPreviewWorkTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.categoryPreviewPrice}>${item.price_usd}</Text>
                    </View>
                  </TouchableOpacity>
                </Link>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

function SectionHeader({
  title,
  subtitle,
  theme,
}: {
  title: string;
  subtitle: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ paddingHorizontal: 18, marginTop: 30, marginBottom: 14 }}>
      <Text
        style={{
          color: theme.text,
          fontSize: 22,
          fontWeight: '700',
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.isDark ? '#9C9C9C' : '#6E6A75',
          fontSize: 14,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      paddingBottom: 120,
    },

    header: {
      paddingTop: Platform.OS === 'ios' ? 62 : 28,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '700',
      flex: 1,
    },
    bellButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },

    searchWrap: {
      paddingHorizontal: 18,
      marginTop: 4,
      marginBottom: 8,
    },
    searchInputWrap: {
      height: 48,
      borderRadius: 24,
      paddingHorizontal: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: theme.isDark ? 0 : 0.05,
          shadowRadius: 4,
        },
        android: {
          elevation: theme.isDark ? 0 : 1,
        },
      }),
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
    },

    filterRow: {
      paddingHorizontal: 18,
      paddingTop: 6,
      paddingBottom: 4,
      gap: 10,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.isDark ? '#2A2236' : '#F4F1FA',
      borderWidth: 1,
      borderColor: theme.isDark ? '#3A304D' : '#E4DCF7',
    },
    filterChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    filterChipText: {
      color: theme.accent,
      fontWeight: '600',
      fontSize: 13,
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },

    heroSection: {
      paddingHorizontal: 18,
      marginTop: 12,
      marginBottom: 8,
    },
    heroCard: {
      height: HERO_HEIGHT,
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
      fontSize: 30,
      lineHeight: 34,
      fontWeight: '700',
      marginBottom: 8,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
      maxWidth: '85%',
    },
    heroButton: {
      alignSelf: 'flex-start',
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
    },
    heroButtonText: {
      color: '#111111',
      fontSize: 14,
      fontWeight: '700',
    },
    heroDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 12,
      gap: 8,
      flexWrap: 'wrap',
    },
    heroDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.isDark ? '#555' : '#C8C8C8',
    },
    heroDotActive: {
      backgroundColor: theme.accent,
      width: 20,
    },

    horizontalListContent: {
      paddingHorizontal: 18,
      paddingRight: 6,
    },

    featureCard: {
      width: FEATURE_CARD_WIDTH,
      marginRight: 16,
    },
    featureImageWrap: {
      position: 'relative',
    },
    featureImage: {
      width: '100%',
      height: FEATURE_CARD_WIDTH * 1.18,
      borderRadius: 22,
      backgroundColor: theme.card,
    },
    newBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: theme.accent,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    newBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    featureMeta: {
      paddingTop: 12,
      paddingRight: 4,
    },
    featureTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    featurePrice: {
      color: theme.accent,
      fontSize: 15,
      fontWeight: '700',
    },

    categoryGrid: {
      paddingHorizontal: 18,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 14,
    },
    categoryTile: {
      width: (width - 50) / 2,
      height: 190,
      borderRadius: 22,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: theme.card,
      justifyContent: 'flex-end',
    },
    categoryImage: {
      width: '100%',
      height: '100%',
    },
    categoryOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    categoryLabel: {
      position: 'absolute',
      left: 14,
      bottom: 14,
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },

    auctionCard: {
      width: AUCTION_CARD_WIDTH,
      marginRight: 16,
      backgroundColor: theme.card,
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    auctionImage: {
      width: '100%',
      height: AUCTION_CARD_WIDTH * 0.9,
      resizeMode: 'cover',
    },
    auctionInfo: {
      padding: 14,
    },
    auctionBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      marginBottom: 10,
    },
    auctionBadgeText: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    auctionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
    },
    auctionMeta: {
      color: theme.isDark ? '#A2A2A2' : '#6E6A75',
      fontSize: 13,
      marginBottom: 2,
    },

    browseGrid: {
      paddingHorizontal: 18,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 18,
    },
    browseCard: {
      width: (width - 46) / 2,
    },
    browseImage: {
      width: '100%',
      height: ((width - 46) / 2) * 1.16,
      borderRadius: 20,
      backgroundColor: theme.card,
    },
    browseMeta: {
      paddingTop: 10,
      paddingHorizontal: 2,
    },
    browseTitle: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      marginBottom: 4,
    },
    browsePrice: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '700',
    },

    categoryPreviewSection: {
      marginTop: 8,
    },
    categoryPreviewHeader: {
      paddingHorizontal: 18,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    categoryPreviewTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    categoryPreviewLink: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '700',
    },
    categoryPreviewCard: {
      width: CATEGORY_PREVIEW_CARD_WIDTH,
      marginRight: 16,
    },
    categoryPreviewImage: {
      width: '100%',
      height: CATEGORY_PREVIEW_CARD_WIDTH * 1.18,
      borderRadius: 18,
      backgroundColor: theme.card,
    },
    categoryPreviewMeta: {
      paddingTop: 10,
      paddingRight: 4,
    },
    categoryPreviewWorkTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    categoryPreviewPrice: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '700',
    },

    emptyText: {
      color: theme.isDark ? '#A0A0A0' : '#6E6A75',
      fontSize: 15,
      textAlign: 'center',
      paddingHorizontal: 24,
      paddingVertical: 30,
    },
  });