import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { useTheme } from '../themeContext';
import { StudioLogo } from './StudioLogo';
import { BuyArtworkPanel } from './BuyArtworkPanel';
import { ProvenanceRecord, type ProvenanceEvent } from './ProvenanceRecord';
import {
  getStudioCategory,
  getStudioCategoryDefinition,
} from '../lib/artworkCategories';

type Artwork = {
  id: string | number;
  title: string;
  image_url: string;
  price?: number;
  price_usd?: number;
  description?: string;
  medium?: string;
  art_type?: string | null;
  subject_matter?: string | null;
  tags?: string[] | null;
  created_at?: string;
  sold_at?: string | null;
  provenance_url?: string | null;
  provenance_events?: ProvenanceEvent[] | null;
};

export default function ArtworkDetailImpl() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const desktopWeb = width >= 960;

  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtwork();
  }, [id]);

  const fetchArtwork = async () => {
    try {
      // Atlas-backed pieces only (docs/09) — legacy rows resolve to not-found.
      const { data, error } = await supabase
        .from('art_pieces')
        .select('*')
        .eq('id', id)
        .not('atlas_artwork_id', 'is', null)
        .not('published_at', 'is', null)
        .single();

      if (error) {
        console.error('Error fetching artwork:', error.message);
      } else {
        setArtwork(data);
      }
    } catch (err) {
      console.error('Unexpected artwork fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = artwork?.price_usd ?? artwork?.price ?? null;
  const studioCategory = artwork
    ? getStudioCategoryDefinition(getStudioCategory(artwork))
    : null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading artwork...
        </Text>
      </View>
    );
  }

  if (!artwork) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Artwork not found</Text>
        <Text style={[styles.text, { color: theme.text }]}>
          This work could not be loaded right now.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        desktopWeb && styles.contentDesktop,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandHeader}>
        <StudioLogo compact />
      </View>

      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={[styles.backText, { color: theme.accent }]}>Back</Text>
      </TouchableOpacity>

      <View
        style={[
          styles.card,
          desktopWeb && styles.cardDesktop,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Image
          source={{ uri: artwork.image_url }}
          style={[styles.image, desktopWeb && styles.imageDesktop]}
          resizeMode="contain"
        />

        <View
          style={[
            styles.metaSection,
            desktopWeb && styles.metaSectionDesktop,
          ]}
        >
          {!!studioCategory && (
            <Text style={[styles.eyebrow, { color: theme.accent }]}>
              {studioCategory.label}
            </Text>
          )}

          <Text style={[styles.title, { color: theme.text }]}>{artwork.title}</Text>

          {displayPrice !== null && displayPrice !== undefined && (
            <Text style={[styles.price, { color: theme.accent }]}>${displayPrice}</Text>
          )}

          {!!artwork.medium && (
            <Text style={[styles.detailText, { color: theme.text }]}>
              Medium: {artwork.medium}
            </Text>
          )}

          {!!artwork.description && (
            <Text style={[styles.description, { color: theme.text }]}>
              {artwork.description}
            </Text>
          )}

        </View>
      </View>

      <View style={styles.provenanceSection}>
        <ProvenanceRecord events={artwork.provenance_events} />
      </View>

      <View style={styles.buySection}>
        <BuyArtworkPanel
          artPieceId={Number(artwork.id)}
          priceUsd={displayPrice}
          soldAt={artwork.sold_at}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingBottom: 80,
  },
  contentDesktop: {
    maxWidth: 1180,
  },
  brandHeader: {
    minHeight: 70,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090A',
  },
  backRow: {
    marginVertical: 16,
    marginHorizontal: 18,
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 18,
    marginBottom: 18,
  },
  cardDesktop: {
    flexDirection: 'row',
  },
  image: {
    width: '100%',
    height: 420,
  },
  imageDesktop: {
    width: '62%',
    height: 680,
  },
  metaSection: {
    padding: 20,
  },
  metaSectionDesktop: {
    minWidth: 0,
    flex: 1,
    justifyContent: 'center',
    padding: 38,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    marginBottom: 12,
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    marginTop: 6,
  },
  provenanceSection: {
    marginHorizontal: 18,
    marginBottom: 26,
  },
  buySection: {
    marginHorizontal: 18,
    marginBottom: 26,
  },
  button: {
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
});
