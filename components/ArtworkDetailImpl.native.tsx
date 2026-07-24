import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageViewing from 'react-native-image-viewing';
import { supabase } from '../supabaseClient';
import { useTheme } from '../themeContext';
import { StudioLogo } from './StudioLogo';
import { ProvenanceRecord, type ProvenanceEvent } from './ProvenanceRecord';
import { BuyArtworkPanel } from './BuyArtworkPanel';
import { useGoBack } from '../lib/useGoBack';
import {
  getStudioCategory,
  getStudioCategoryDefinition,
} from '../lib/artworkCategories';

type Artwork = {
  id: number;
  title: string | null;
  description: string | null;
  image_url: string | null;
  price_usd: number | null;
  price_usdc: number | null;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  condition: string | null;
  signed: string | null;
  art_type: string | null;
  subject_matter: string | null;
  tags: string[] | null;
  is_auction: boolean | null;
  auction_end_time: string | null;
  provenance_url: string | null;
  provenance_events: ProvenanceEvent[] | null;
};

type WishlistItem = {
  id: number;
  title: string;
  image_url: string;
  price_usd: number;
};

function formatPrice(value: number | null | undefined) {
  return value !== null && value !== undefined
    ? `$${Number(value).toLocaleString()}`
    : null;
}

function getAuctionCountdown(endTime: string | null) {
  if (!endTime) return 'Auction schedule to be announced';

  const end = new Date(endTime).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return 'Auction ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${minutes}m`;
  return `Ends in ${Math.max(minutes, 1)}m`;
}

function formatAuctionEndTime(endTime: string | null) {
  if (!endTime) return null;

  try {
    return new Date(endTime).toLocaleString();
  } catch {
    return null;
  }
}

export default function ArtworkDetailImpl() {
  const { id } = useLocalSearchParams();
  const goBack = useGoBack('/(tabs)/discover');
  const theme = useTheme();
  const styles = createStyles(theme);

 const [artwork, setArtwork] = useState<Artwork | null>(null);
const [loading, setLoading] = useState(true);
const [saved, setSaved] = useState(false);
const [viewerVisible, setViewerVisible] = useState(false);
const [now, setNow] = useState(Date.now());

  useEffect(() => {
  void fetchArtwork();
}, [id]);

useEffect(() => {
  if (artwork) void checkIfSaved();
}, [artwork]);

useEffect(() => {
  if (!artwork?.is_auction || !artwork?.auction_end_time) return;

  const interval = setInterval(() => {
    setNow(Date.now());
  }, 60000);

  return () => clearInterval(interval);
}, [artwork?.is_auction, artwork?.auction_end_time]);

  const fetchArtwork = async () => {
    // Atlas-backed pieces only (docs/09) — legacy rows resolve to not-found.
    const { data, error } = await supabase
      .from('art_pieces')
      .select('*')
      .eq('id', id)
      .not('atlas_artwork_id', 'is', null)
      .not('published_at', 'is', null)
      .single();

    if (error) {
      console.error(error);
    } else {
      setArtwork(data);
    }

    setLoading(false);
  };

  const checkIfSaved = async () => {
    if (!artwork) return;

    try {
      const existing = await AsyncStorage.getItem('wishlist');
      const parsed: WishlistItem[] = existing ? JSON.parse(existing) : [];
      setSaved(parsed.some((item) => item.id === artwork.id));
    } catch (error) {
      console.error('Error checking wishlist:', error);
    }
  };

  const handleToggleSave = async () => {
    if (!artwork) return;

    try {
      const existing = await AsyncStorage.getItem('wishlist');
      let parsed: WishlistItem[] = existing ? JSON.parse(existing) : [];
      const alreadySaved = parsed.some((item) => item.id === artwork.id);

      if (alreadySaved) {
        parsed = parsed.filter((item) => item.id !== artwork.id);
        setSaved(false);
        Alert.alert('Removed', 'Artwork removed from wishlist.');
      } else {
        parsed.push({
          id: artwork.id,
          title: artwork.title || 'Untitled',
          image_url: artwork.image_url || '',
          price_usd: artwork.price_usd || 0,
        });
        setSaved(true);
        Alert.alert('Saved', 'Artwork added to wishlist.');
      }

      await AsyncStorage.setItem('wishlist', JSON.stringify(parsed));
    } catch (error) {
      console.error('Error updating wishlist:', error);
      Alert.alert('Error', 'Could not update wishlist.');
    }
  };

  const handleShare = async () => {
    if (!artwork) return;

    try {
      await Share.share({
        message: `${artwork.title || 'Untitled'}${
          artwork.price_usd ? ` — $${Number(artwork.price_usd).toLocaleString()}` : ''
        }`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handlePlaceBid = () => {
    Alert.alert(
      'Bidding coming soon',
      'This artwork is currently marked as an auction piece. Live bidding flow will be connected next.'
    );
  };

  // Buy-now checkout is handled by <BuyArtworkPanel> rendered inline below —
  // the same server-priced, Privy-authed create-order → Stripe Checkout flow
  // the web detail page uses. The old Payment Sheet path (create-payment-intent)
  // was removed: it was client-priced, anon-authed, and created no order.

  const displayPrice = useMemo(() => formatPrice(artwork?.price_usd), [artwork?.price_usd]);
  const auctionCountdown = useMemo(
  () => getAuctionCountdown(artwork?.auction_end_time || null),
  [artwork?.auction_end_time, now]
);
  const auctionEndLabel = useMemo(
    () => formatAuctionEndTime(artwork?.auction_end_time || null),
    [artwork?.auction_end_time]
  );
  const studioCategory = useMemo(
    () =>
      artwork
        ? getStudioCategoryDefinition(getStudioCategory(artwork))
        : null,
    [artwork],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!artwork) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={{ color: theme.text }}>Artwork not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <StudioLogo compact />

          <View style={styles.actions}>
            <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleToggleSave} style={styles.iconBtn}>
              <Ionicons
                name={saved ? 'heart' : 'heart-outline'}
                size={20}
                color={saved ? theme.accent : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => setViewerVisible(true)}
          style={styles.imageFrame}
        >
          <Image
            source={{ uri: artwork.image_url || '' }}
            style={styles.image}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {artwork.is_auction && (
          <View style={styles.auctionBadge}>
            <Ionicons name="hammer-outline" size={16} color={theme.accent} />
            <Text style={styles.auctionBadgeText}>Live Auction</Text>
          </View>
        )}

        {studioCategory && (
          <Text style={styles.category}>{studioCategory.label}</Text>
        )}

        <Text style={styles.title}>{artwork.title || 'Untitled'}</Text>

        {!!displayPrice && (
          <Text style={styles.price}>
            {artwork.is_auction ? `Opening bid: ${displayPrice}` : displayPrice}
          </Text>
        )}

        {artwork.is_auction && (
          <View style={styles.auctionPanel}>
            <Text style={styles.auctionPanelTitle}>{auctionCountdown}</Text>
            <Text style={styles.auctionPanelText}>
              This artwork is currently listed as an auction piece.
            </Text>
            {auctionEndLabel && (
              <Text style={styles.auctionPanelMeta}>Scheduled end: {auctionEndLabel}</Text>
            )}
          </View>
        )}

        {artwork.description && (
          <Text style={styles.description}>{artwork.description}</Text>
        )}

        <View style={styles.meta}>
          {artwork.medium && <Text style={styles.metaText}>Medium: {artwork.medium}</Text>}
          {artwork.dimensions && <Text style={styles.metaText}>Dimensions: {artwork.dimensions}</Text>}
          {artwork.year && <Text style={styles.metaText}>Year: {artwork.year}</Text>}
          {artwork.condition && <Text style={styles.metaText}>Condition: {artwork.condition}</Text>}
          {artwork.signed && <Text style={styles.metaText}>Signature: {artwork.signed}</Text>}
        </View>

        <ProvenanceRecord events={artwork.provenance_events} />

        {!artwork.is_auction && (
          <View style={styles.buyPanel}>
            <BuyArtworkPanel
              artPieceId={artwork.id}
              priceUsd={artwork.price_usd}
              soldAt={undefined}
            />
          </View>
        )}

        <View style={styles.shipping}>
          <Text style={styles.shippingTitle}>Estimated Shipping (Domestic US)</Text>
          <Text style={styles.shippingPrice}>$45 – $85</Text>
          <Text style={styles.shippingText}>
            Shipping calculated at checkout • Tracking provided • Carefully packaged
          </Text>
        </View>

        <Text style={styles.secure}>
          {artwork.is_auction
            ? 'Auction-enabled work • Bid flow coming next'
            : 'Secure checkout • Powered by Stripe'}
        </Text>
      </ScrollView>

      {/* Sticky bar is auction-only now. Buy-now lives in the inline
          BuyArtworkPanel above, matching the web detail page. */}
      {artwork.is_auction && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarTextWrap}>
            <Text style={styles.bottomBarLabel}>Auction Status</Text>
            <Text style={styles.bottomBarPrice}>{auctionCountdown}</Text>
          </View>

          <TouchableOpacity style={styles.bottomBarButton} onPress={handlePlaceBid}>
            <Text style={styles.bottomBarButtonText}>Place Bid</Text>
          </TouchableOpacity>
        </View>
      )}

      <ImageViewing
        images={[{ uri: artwork.image_url || '' }]}
        imageIndex={0}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 0,
      paddingBottom: 140,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topBar: {
      marginHorizontal: -18,
      paddingHorizontal: 18,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 22,
      backgroundColor: '#09090A',
    },
    actions: {
      flexDirection: 'row',
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 6,
      backgroundColor: '#171519',
      borderWidth: 1,
      borderColor: '#343037',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    // The inset is what gives the work room to breathe. resizeMode="contain"
    // fills whichever axis is constrained, so without padding a portrait work
    // sits flush against the top and bottom and a landscape one against the
    // sides — it reads as a crop rather than a mount.
    imageFrame: {
      width: '100%',
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      marginBottom: 20,
    },
    image: {
      width: '100%',
      height: 320,
    },
    auctionBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      marginBottom: 14,
    },
    auctionBadgeText: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 6,
    },
    category: {
      color: theme.accent,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    price: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.accent,
      marginBottom: 16,
    },
    auctionPanel: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      padding: 16,
      marginBottom: 20,
    },
    auctionPanelTitle: {
      color: theme.accent,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 6,
    },
    auctionPanelText: {
      color: theme.text,
      opacity: 0.8,
      lineHeight: 22,
      marginBottom: 6,
    },
    auctionPanelMeta: {
      color: theme.text,
      opacity: 0.6,
      fontSize: 13,
    },
    description: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.text,
      opacity: 0.75,
      marginBottom: 20,
    },
    meta: {
      marginBottom: 28,
    },
    metaText: {
      fontSize: 16,
      lineHeight: 26,
      color: theme.text,
      marginBottom: 4,
    },
    buyPanel: {
      marginTop: 20,
      marginBottom: 8,
    },
    shipping: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F3EAFB',
      padding: 18,
      borderRadius: 6,
      marginBottom: 28,
    },
    shippingTitle: {
      fontWeight: '700',
      color: theme.accent,
      marginBottom: 6,
    },
    shippingPrice: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 6,
    },
    shippingText: {
      color: theme.text,
      opacity: 0.7,
      lineHeight: 22,
    },
    secure: {
      textAlign: 'center',
      color: theme.text,
      opacity: 0.6,
      fontSize: 14,
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    bottomBarTextWrap: {
      flex: 1,
      marginRight: 12,
    },
    bottomBarLabel: {
      color: theme.text,
      opacity: 0.6,
      fontSize: 13,
      marginBottom: 2,
    },
    bottomBarPrice: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    bottomBarButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 120,
    },
    bottomBarButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
  });
