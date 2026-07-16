import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { useTheme } from '../themeContext';

type Artwork = {
  id: string | number;
  title: string;
  image_url: string;
  price?: number;
  price_usd?: number;
  description?: string;
  medium?: string;
  collection_type?: string;
  created_at?: string;
  provenance_url?: string | null;
};

export default function ArtworkDetailImpl() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();

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
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandHeader}>
        <Text
          style={[
            styles.brandText,
            { color: theme.isDark ? '#9C9C9C' : '#6E6A75' },
          ]}
        >
          JGA Studio
        </Text>
      </View>

      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={[styles.backText, { color: theme.accent }]}>← Back</Text>
      </TouchableOpacity>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Image source={{ uri: artwork.image_url }} style={styles.image} resizeMode="contain" />

        <View style={styles.metaSection}>
          {!!artwork.collection_type && (
            <Text style={[styles.eyebrow, { color: theme.accent }]}>
              {artwork.collection_type}
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

          {!!artwork.provenance_url && (
            <TouchableOpacity
              style={[styles.provenance, { borderColor: theme.border }]}
              onPress={() => Linking.openURL(artwork.provenance_url!)}
              accessibilityRole="link"
            >
              <Text style={[styles.provenanceTitle, { color: theme.accent }]}>
                View provenance record ↗
              </Text>
              <Text style={[styles.provenanceText, { color: theme.text }]}>
                Artist-maintained history of this work — creation, exhibitions, and ownership —
                on Archive Atlas.
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.noticeTitle, { color: theme.text }]}>Checkout on Mobile</Text>
        <Text style={[styles.noticeText, { color: theme.text }]}>
          Artwork details are available here on web. Mobile checkout and purchase flow will be
          available in the app experience.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() =>
            alert('Mobile checkout is coming soon. You can continue browsing the collection here.')
          }
        >
          <Text style={styles.buttonText}>Mobile Checkout Coming Soon</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 80,
  },
  brandHeader: {
    marginBottom: 16,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  backRow: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: 420,
  },
  metaSection: {
    padding: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  provenance: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  provenanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  provenanceText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
  },
  noticeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  button: {
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
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
