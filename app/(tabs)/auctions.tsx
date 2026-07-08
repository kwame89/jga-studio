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
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../themeContext';

const { width } = Dimensions.get('window');

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
  collection_type?: string | null;
};

type AuctionLotMerged = AuctionLotRow & {
  art_piece: ArtPieceRow | null;
};

type AuctionCardItem = {
  id: string;
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
  const styles = createStyles(theme);

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

    const { data: artPiecesData, error: artPiecesError } = await supabase
      .from('art_pieces')
      .select('id, title, image_url, medium, collection_type')
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

    const mergedLots: AuctionLotMerged[] = safeLots.map((lot) => ({
      ...lot,
      art_piece: artPieceMap.get(lot.art_piece_id) || null,
    }));

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

  const totalActiveLots = liveAuctions.length + upcomingAuctions.length;

  const handleLotPress = (item: AuctionCardItem) => {
    router.push(`/artwork/${item.id}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>JGA Studio</Text>
        <Text style={styles.title}>Auctions</Text>
        <Text style={styles.subtitle}>
          Live sales, upcoming drops, and collector bidding
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

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatValue}>{liveAuctions.length}</Text>
              <Text style={styles.heroStatLabel}>Live</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatValue}>{upcomingAuctions.length}</Text>
              <Text style={styles.heroStatLabel}>Upcoming</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatValue}>{totalActiveLots}</Text>
              <Text style={styles.heroStatLabel}>Total</Text>
            </View>
          </View>

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
        theme={theme}
      />

      {loading ? (
        <LoadingBlock theme={theme} />
      ) : liveAuctions.length > 0 ? (
        <FlatList
          data={liveAuctions}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.lotCard}
              activeOpacity={0.9}
              onPress={() => handleLotPress(item)}
            >
              <Image
                source={{ uri: item.image_url }}
                style={styles.lotImage}
                resizeMode="cover"
              />
              <View style={styles.lotInfo}>
                <View style={styles.statusBadgeLive}>
                  <Text style={styles.statusBadgeLiveText}>Live</Text>
                </View>

                <Text style={styles.lotTitle} numberOfLines={1}>
                  {item.title}
                </Text>

                {!!item.medium && (
                  <Text style={styles.lotMeta}>{item.medium}</Text>
                )}

                <Text style={styles.bidValue}>
                  Current Bid: {formatCurrency(item.currentBid)}
                </Text>

                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={16} color={theme.accent} />
                  <Text style={styles.timeText}>{item.timeLabel}</Text>
                </View>

                <Text style={styles.bidCount}>
                  {pluralize(item.totalBids, 'bid')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
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
        theme={theme}
      />

      {loading ? (
        <LoadingBlock theme={theme} />
      ) : upcomingAuctions.length > 0 ? (
        <FlatList
          data={upcomingAuctions}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.lotCard}
              activeOpacity={0.9}
              onPress={() => handleLotPress(item)}
            >
              <Image
                source={{ uri: item.image_url }}
                style={styles.lotImage}
                resizeMode="cover"
              />
              <View style={styles.lotInfo}>
                <View style={styles.statusBadgeUpcoming}>
                  <Text style={styles.statusBadgeUpcomingText}>Upcoming</Text>
                </View>

                <Text style={styles.lotTitle} numberOfLines={1}>
                  {item.title}
                </Text>

                {!!item.medium && (
                  <Text style={styles.lotMeta}>{item.medium}</Text>
                )}

                <Text style={styles.bidValue}>
                  Starting Bid: {formatCurrency(item.startingBid)}
                </Text>

                <View style={styles.timeRow}>
                  <Ionicons name="calendar-outline" size={16} color={theme.accent} />
                  <Text style={styles.timeText}>{item.timeLabel}</Text>
                </View>

                <Text style={styles.bidCount}>
                  {pluralize(item.totalBids, 'bid')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
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
        theme={theme}
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
        theme={theme}
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
        borderRadius: 24,
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
      paddingBottom: 8,
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
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: theme.isDark ? '#A7A7A7' : '#666',
    },

    heroSection: {
      paddingHorizontal: 18,
      marginTop: 14,
    },
    heroCard: {
      borderRadius: 28,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    heroBadge: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    heroBadgeText: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 13,
    },
    heroIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.isDark ? '#1F1B27' : '#F7F2FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      color: theme.text,
      fontSize: 25,
      lineHeight: 31,
      fontWeight: '700',
      marginBottom: 10,
    },
    heroSubtitle: {
      color: theme.isDark ? '#B0B0B0' : '#5E5966',
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 18,
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 18,
      flexWrap: 'wrap',
    },
    heroStatPill: {
      backgroundColor: theme.isDark ? '#23212A' : '#F5F1FA',
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      minWidth: 78,
    },
    heroStatValue: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 2,
    },
    heroStatLabel: {
      color: theme.isDark ? '#AFAFAF' : '#6A6570',
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    heroButton: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accent,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 999,
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

    lotCard: {
      width: Math.min(width * 0.62, 240),
      backgroundColor: theme.card,
      borderRadius: 20,
      marginRight: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    lotImage: {
      width: '100%',
      height: 190,
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
      borderRadius: 999,
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
      borderRadius: 999,
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
      marginHorizontal: 18,
      borderRadius: 24,
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
      paddingHorizontal: 18,
      gap: 14,
    },
    explainerCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
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
      marginHorizontal: 18,
      marginTop: 8,
      borderRadius: 24,
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
      borderRadius: 16,
      alignItems: 'center',
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });