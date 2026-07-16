import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../themeContext';
import { StudioMasthead } from '../../components/StudioMasthead';

type AuctionLotRow = {
  id: string;
  art_piece_id: number;
  starting_bid: number | null;
  current_bid: number | null;
  reserve_price: number | null;
  bid_increment: number | null;
  start_time: string | null;
  end_time: string | null;
  status: 'upcoming' | 'live' | 'closed' | 'sold' | 'passed';
  total_bids: number | null;
};

type ArtPieceRow = {
  id: number;
  title: string;
  image_url: string;
  medium?: string | null;
};

type AuctionLotMerged = AuctionLotRow & {
  art_piece: ArtPieceRow | null;
};

type AuctionCardItem = {
  id: string;
  artworkId: number;
  title: string;
  image_url: string;
  medium?: string | null;
  currentBid: number;
  startingBid: number;
  timeLabel: string;
  totalBids: number;
  status: 'live' | 'upcoming';
};

type ExplainerItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
};

const biddingExplainers: ExplainerItem[] = [
  {
    id: '1',
    icon: 'pricetag-outline',
    title: 'Starting Bid',
    text: 'Each lot opens at a set starting amount and moves upward as bids are placed.',
  },
  {
    id: '2',
    icon: 'timer-outline',
    title: 'Timed Closing',
    text: 'Live lots remain open until the listed closing time, unless sale rules extend bidding.',
  },
  {
    id: '3',
    icon: 'checkmark-circle-outline',
    title: 'Winning Bid',
    text: 'The highest valid bid at close wins the lot, subject to reserve and final sale terms.',
  },
];

function formatCurrency(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  return `$${safe.toLocaleString()}`;
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

function mapLot(row: AuctionLotMerged): AuctionCardItem | null {
  if (!row.art_piece?.image_url || !row.art_piece?.title) return null;

  return {
    id: row.id,
    artworkId: row.art_piece_id,
    title: row.art_piece.title,
    image_url: row.art_piece.image_url,
    medium: row.art_piece.medium,
    currentBid: Number(row.current_bid ?? row.starting_bid ?? 0),
    startingBid: Number(row.starting_bid ?? 0),
    timeLabel:
      row.status === 'live'
        ? getTimeUntil(row.end_time, 'Ends in')
        : getTimeUntil(row.start_time, 'Starts in'),
    totalBids: Number(row.total_bids ?? 0),
    status: row.status === 'live' ? 'live' : 'upcoming',
  };
}

function dedupeLotsByArtPiece(rows: AuctionLotMerged[]) {
  const seen = new Set<number>();
  const unique: AuctionLotMerged[] = [];

  for (const row of rows) {
    if (!row.art_piece_id) continue;
    if (seen.has(row.art_piece_id)) continue;
    seen.add(row.art_piece_id);
    unique.push(row);
  }

  return unique;
}

export default function Auctions() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 960;
  const styles = createStyles(theme, desktopWeb, width);

  const [lots, setLots] = useState<AuctionLotMerged[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuctionLots();
  }, []);

  const fetchAuctionLots = async () => {
    setLoading(true);

    const { data: lotsData, error: lotsError } = await supabase
      .from('auction_lots')
      .select(
        'id, art_piece_id, starting_bid, current_bid, reserve_price, bid_increment, start_time, end_time, status, total_bids'
      )
      .in('status', ['live', 'upcoming'])
      .order('start_time', { ascending: true });

    if (lotsError) {
      console.error('auction_lots fetch error:', lotsError);
      setLots([]);
      setLoading(false);
      return;
    }

    const safeLots = (lotsData as AuctionLotRow[]) || [];

    if (safeLots.length === 0) {
      setLots([]);
      setLoading(false);
      return;
    }

    const artPieceIds = [...new Set(safeLots.map((lot) => lot.art_piece_id))];

    // Only Atlas-backed pieces are shown (docs/09); lots on legacy pieces
    // are dropped below when no piece matches.
    const { data: artPiecesData, error: artPiecesError } = await supabase
      .from('art_pieces')
      .select('id, title, image_url, medium')
      .not('atlas_artwork_id', 'is', null)
      .not('published_at', 'is', null)
      .in('id', artPieceIds);

    if (artPiecesError) {
      console.error('art_pieces fetch error:', artPiecesError);
      setLots(
        safeLots.map((lot) => ({
          ...lot,
          art_piece: null,
        }))
      );
      setLoading(false);
      return;
    }

    const artPieceMap = new Map<number, ArtPieceRow>();
    ((artPiecesData as ArtPieceRow[]) || []).forEach((piece) => {
      artPieceMap.set(piece.id, piece);
    });

    const mergedLots: AuctionLotMerged[] = safeLots
      .map((lot) => ({
        ...lot,
        art_piece: artPieceMap.get(lot.art_piece_id) || null,
      }))
      .filter((lot) => lot.art_piece !== null);

    setLots(mergedLots);
    setLoading(false);
  };

  const { liveAuctions, upcomingAuctions } = useMemo(() => {
    const liveRows = dedupeLotsByArtPiece(
      lots.filter((row) => row.status === 'live')
    );
    const upcomingRows = dedupeLotsByArtPiece(
      lots.filter((row) => row.status === 'upcoming')
    );

    return {
      liveAuctions: liveRows.map(mapLot).filter(Boolean) as AuctionCardItem[],
      upcomingAuctions: upcomingRows.map(mapLot).filter(Boolean) as AuctionCardItem[],
    };
  }, [lots]);

  const featuredAuction = {
    title: 'Studio Auctions',
    subtitle:
      'Collector-focused sales, future drops, and curated bidding moments from JGA Studio.',
    cta: 'View Auction Snapshot',
  };

  const handleLotPress = (item: AuctionCardItem) => {
    router.push(`/artwork/${item.artworkId}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.shell}>
      <StudioMasthead
        desktop={desktopWeb}
        eyebrow="Timed releases"
        title="Auctions"
      />

      <View style={styles.intro}>
        <Text style={styles.introTitle}>Collect through the rhythm of a live sale.</Text>
        <Text style={styles.introText}>
          Studio releases, timed bidding, and future collector moments in one focused place.
        </Text>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Featured Sale</Text>
            </View>
            <View style={styles.heroIconWrap}>
              <Ionicons name="hammer-outline" size={22} color={theme.accent} />
            </View>
          </View>

          <Text style={styles.heroTitle}>{featuredAuction.title}</Text>
          <Text style={styles.heroSubtitle}>{featuredAuction.subtitle}</Text>

          <TouchableOpacity
            style={styles.heroButton}
            activeOpacity={0.88}
            onPress={() =>
              Alert.alert(
                'Auction Snapshot',
                `${liveAuctions.length} live lot(s) and ${upcomingAuctions.length} upcoming lot(s) are currently listed.`
              )
            }
          >
            <Text style={styles.heroButtonText}>{featuredAuction.cta}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionHeader
        title="Live Auctions"
        subtitle="Lots currently open for bidding"
        styles={styles}
      />

      {loading ? (
        <LoadingBlock theme={theme} />
      ) : liveAuctions.length > 0 ? (
        <AuctionRail
          items={liveAuctions}
          desktop={desktopWeb}
          upcoming={false}
          onPress={handleLotPress}
          theme={theme}
          styles={styles}
        />
      ) : (
        <EmptyAuctionState
          icon="radio-outline"
          title="No live auctions right now"
          subtitle="Live bidding activity will appear here as soon as a sale opens."
          theme={theme}
        />
      )}

      <SectionHeader
        title="Upcoming Auctions"
        subtitle="Preview future sale moments"
        styles={styles}
      />

      {loading ? (
        <LoadingBlock theme={theme} />
      ) : upcomingAuctions.length > 0 ? (
        <AuctionRail
          items={upcomingAuctions}
          desktop={desktopWeb}
          upcoming
          onPress={handleLotPress}
          theme={theme}
          styles={styles}
        />
      ) : (
        <EmptyAuctionState
          icon="calendar-outline"
          title="No upcoming auctions scheduled"
          subtitle="Future releases and timed sales will be announced here."
          theme={theme}
        />
      )}

      <SectionHeader
        title="How Bidding Works"
        subtitle="A collector-friendly guide to the sale flow"
        styles={styles}
      />

      <View style={styles.explainerGrid}>
        {biddingExplainers.map((item) => (
          <View key={item.id} style={styles.explainerCard}>
            <View style={styles.explainerIconWrap}>
              <Ionicons name={item.icon} size={22} color={theme.accent} />
            </View>
            <Text style={styles.explainerTitle}>{item.title}</Text>
            <Text style={styles.explainerText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <SectionHeader
        title="Collector Tools"
        subtitle="Future features for bidding and tracking"
        styles={styles}
      />

      <View style={styles.toolsPanel}>
        <Text style={styles.toolsTitle}>Watchlists, bids, and alerts</Text>
        <Text style={styles.toolsText}>
          As the auction system grows, this section will support saved lots,
          auction reminders, bidder status, and personal sale activity.
        </Text>

        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.88}
          onPress={() =>
            Alert.alert(
              'Coming Soon',
              'Watchlist, My Bids, and auction alerts will be added in a future update.'
            )
          }
        >
          <Text style={styles.ctaText}>View My Bids & Watchlist</Text>
        </TouchableOpacity>
      </View>
      </View>
    </ScrollView>
  );
}

function AuctionRail({
  items,
  desktop,
  upcoming,
  onPress,
  theme,
  styles,
}: {
  items: AuctionCardItem[];
  desktop: boolean;
  upcoming: boolean;
  onPress: (item: AuctionCardItem) => void;
  theme: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof createStyles>;
}) {
  const renderCard = (item: AuctionCardItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.lotCard}
      activeOpacity={0.9}
      onPress={() => onPress(item)}
    >
      <Image source={{ uri: item.image_url }} style={styles.lotImage} resizeMode="cover" />
      <View style={styles.lotInfo}>
        <View style={upcoming ? styles.statusBadgeUpcoming : styles.statusBadgeLive}>
          <Text style={upcoming ? styles.statusBadgeUpcomingText : styles.statusBadgeLiveText}>
            {upcoming ? 'Upcoming' : 'Live'}
          </Text>
        </View>
        <Text style={styles.lotTitle} numberOfLines={2}>{item.title}</Text>
        {!!item.medium && <Text style={styles.lotMeta}>{item.medium}</Text>}
        <Text style={styles.bidValue}>
          {upcoming ? 'Starting Bid' : 'Current Bid'}:{' '}
          {formatCurrency(upcoming ? item.startingBid : item.currentBid)}
        </Text>
        <View style={styles.timeRow}>
          <Ionicons
            name={upcoming ? 'calendar-outline' : 'time-outline'}
            size={16}
            color={theme.accent}
          />
          <Text style={styles.timeText}>{item.timeLabel}</Text>
        </View>
        {item.totalBids > 0 ? (
          <Text style={styles.bidCount}>{pluralize(item.totalBids, 'bid')}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (desktop) {
    return <View style={styles.desktopLotGrid}>{items.map(renderCard)}</View>;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalList}
      renderItem={({ item }) => renderCard(item)}
    />
  );
}

function SectionHeader({
  title,
  subtitle,
  styles,
}: {
  title: string;
  subtitle: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{subtitle}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function EmptyAuctionState({
  icon,
  title,
  subtitle,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const styles = createStyles(theme);

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name={icon}
          size={32}
          color={theme.isDark ? '#9B9B9B' : '#A3A3A3'}
        />
      </View>
      <Text style={styles.emptyText}>{title}</Text>
      <Text style={styles.emptySubtext}>{subtitle}</Text>
    </View>
  );
}

function LoadingBlock({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View
      style={{
        marginHorizontal: 18,
        borderRadius: 6,
        paddingVertical: 42,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <ActivityIndicator size="small" color={theme.accent} />
      <Text
        style={{
          marginTop: 12,
          color: theme.isDark ? '#A4A4A4' : '#7A7A7A',
          fontSize: 14,
        }}
      >
        Loading auction lots…
      </Text>
    </View>
  );
}

const createStyles = (
  theme: ReturnType<typeof useTheme>,
  desktopWeb = false,
  viewportWidth = 390,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      alignItems: 'center',
      paddingBottom: desktopWeb ? 72 : 120,
    },
    shell: {
      width: '100%',
      maxWidth: desktopWeb ? 1320 : 760,
      backgroundColor: theme.background,
    },

    intro: {
      paddingHorizontal: desktopWeb ? 42 : 18,
      paddingTop: desktopWeb ? 58 : 30,
      paddingBottom: desktopWeb ? 48 : 28,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    introTitle: {
      maxWidth: desktopWeb ? 820 : 560,
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 48 : 31,
      lineHeight: desktopWeb ? 56 : 38,
    },
    introText: {
      maxWidth: 700,
      color: theme.text,
      opacity: 0.62,
      fontSize: desktopWeb ? 16 : 14,
      lineHeight: desktopWeb ? 25 : 22,
      marginTop: 12,
    },

    heroSection: {
      paddingHorizontal: desktopWeb ? 42 : 18,
      marginTop: desktopWeb ? 42 : 22,
    },
    heroCard: {
      borderRadius: 6,
      backgroundColor: '#080709',
      borderWidth: 1,
      borderColor: '#2A1E34',
      padding: desktopWeb ? 42 : 22,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    heroBadge: {
      backgroundColor: '#201526',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 3,
    },
    heroBadgeText: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 13,
    },
    heroIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 4,
      backgroundColor: '#171219',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      color: '#FFFFFF',
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 38 : 27,
      lineHeight: desktopWeb ? 45 : 34,
      marginBottom: 10,
    },
    heroSubtitle: {
      maxWidth: 680,
      color: '#BDB6C2',
      fontSize: desktopWeb ? 16 : 14,
      lineHeight: desktopWeb ? 25 : 22,
      marginBottom: 18,
    },
    heroButton: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accent,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 4,
    },
    heroButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },

    horizontalList: {
      paddingHorizontal: 18,
      paddingRight: 6,
    },
    desktopLotGrid: {
      paddingHorizontal: 42,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 18,
    },

    lotCard: {
      width: desktopWeb ? '31.8%' : Math.min(viewportWidth * 0.72, 280),
      backgroundColor: theme.card,
      borderRadius: 6,
      marginRight: desktopWeb ? 0 : 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    lotImage: {
      width: '100%',
      height: desktopWeb ? 280 : 220,
      backgroundColor: theme.card,
    },
    lotInfo: {
      padding: 14,
    },
    lotTitle: {
      fontSize: 15.5,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    lotMeta: {
      fontSize: 13.5,
      color: theme.isDark ? '#A9A9A9' : '#666',
      marginBottom: 8,
    },
    bidValue: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.accent,
      marginBottom: 8,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timeText: {
      fontSize: 14,
      color: theme.isDark ? '#A7A7A7' : '#666',
      marginLeft: 6,
    },
    bidCount: {
      marginTop: 8,
      fontSize: 13,
      color: theme.isDark ? '#A7A7A7' : '#777',
    },

    statusBadgeLive: {
      alignSelf: 'flex-start',
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 3,
      marginBottom: 10,
    },
    statusBadgeLiveText: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: '700',
    },

    statusBadgeUpcoming: {
      alignSelf: 'flex-start',
      backgroundColor: theme.isDark ? '#232831' : '#EEF3F7',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 3,
      marginBottom: 10,
    },
    statusBadgeUpcomingText: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: '700',
    },

    emptyState: {
      alignItems: 'center',
      paddingVertical: 54,
      paddingHorizontal: 34,
      marginHorizontal: desktopWeb ? 42 : 18,
      borderRadius: 6,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyIconWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.isDark ? '#1A1A1A' : '#F4F1EC',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 17,
      color: theme.text,
      fontWeight: '600',
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.isDark ? '#A4A4A4' : '#8A8A8A',
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 21,
      maxWidth: 290,
    },

    explainerGrid: {
      paddingHorizontal: desktopWeb ? 42 : 18,
      flexDirection: desktopWeb ? 'row' : 'column',
      gap: 14,
    },
    explainerCard: {
      width: desktopWeb ? '32%' : '100%',
      backgroundColor: theme.card,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    explainerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    explainerTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 6,
    },
    explainerText: {
      color: theme.isDark ? '#AFAFAF' : '#5F5A66',
      fontSize: 14,
      lineHeight: 21,
    },

    toolsPanel: {
      marginHorizontal: desktopWeb ? 42 : 18,
      marginTop: 8,
      borderRadius: 6,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
    },
    toolsTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
    },
    toolsText: {
      color: theme.isDark ? '#B0B0B0' : '#5E5966',
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 18,
    },
    ctaButton: {
      backgroundColor: theme.accent,
      paddingVertical: 16,
      borderRadius: 4,
      alignItems: 'center',
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    sectionHeader: {
      paddingHorizontal: desktopWeb ? 42 : 18,
      paddingTop: desktopWeb ? 52 : 34,
      paddingBottom: desktopWeb ? 20 : 14,
    },
    sectionEyebrow: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginBottom: 7,
    },
    sectionTitle: {
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: desktopWeb ? 33 : 24,
      lineHeight: desktopWeb ? 39 : 30,
    },
  });
