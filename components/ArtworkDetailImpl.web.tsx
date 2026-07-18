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
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import { useTheme } from '../themeContext';
import { StudioLogo } from './StudioLogo';
import { BuyArtworkPanel } from './BuyArtworkPanel';
import { AdminArtworkControls } from './AdminArtworkControls';
import { ProvenanceRecord, type ProvenanceEvent } from './ProvenanceRecord';
import { useGoBack } from '../lib/useGoBack';
import { formatEditionLabel } from '../lib/classification';
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
  dimensions?: string | null;
  year?: number | null;
  is_circa?: boolean | null;
  classification?: string | null;
  edition_number?: number | null;
  edition_total?: number | null;
  condition?: string | null;
  signed?: string | null;
  signature_notes?: string | null;
  art_type?: string | null;
  subject_matter?: string | null;
  tags?: string[] | null;
  created_at?: string;
  sold_at?: string | null;
  provenance_url?: string | null;
  provenance_events?: ProvenanceEvent[] | null;
};

type GalleryImage = {
  id: string;
  public_url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
};

// Renders the artwork's structured detail fields, mirrored from Archive Atlas.
function DetailRows({ artwork, theme }: { artwork: Artwork; theme: ReturnType<typeof useTheme> }) {
  const edition = formatEditionLabel(
    artwork.classification,
    artwork.edition_number ?? null,
    artwork.edition_total ?? null,
  );
  const yearLabel = artwork.year
    ? `${artwork.is_circa ? 'c. ' : ''}${artwork.year}`
    : null;
  const signature = artwork.signature_notes || (artwork.signed ? String(artwork.signed) : null);

  const rows: [string, string | null | undefined][] = [
    ['Medium', artwork.medium],
    ['Dimensions', artwork.dimensions],
    ['Year', yearLabel],
    ['Edition', edition],
    ['Subject', artwork.subject_matter],
    ['Condition', artwork.condition],
    ['Signature', signature],
  ];
  const present = rows.filter(([, v]) => !!v);
  if (present.length === 0) return null;

  return (
    <View style={styles.detailRows}>
      {present.map(([label, value]) => (
        <View key={label} style={[styles.detailRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.detailLabel, { color: theme.isDark ? '#9C9C9C' : '#6E6A75' }]}>
            {label}
          </Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ArtworkDetailImpl() {
  const { id } = useLocalSearchParams();
  // Falls back to Discover: an artwork page reached by a shared link has no
  // history, and the browse grid is the natural parent.
  const goBack = useGoBack('/(tabs)/discover');
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const desktopWeb = width >= 960;

  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
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
        // Full image set (mirrored from Atlas), primary first.
        const { data: imgs } = await supabase
          .from('art_images')
          .select('id, public_url, alt_text, is_primary, sort_order')
          .eq('art_piece_id', data.id)
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true });
        const gallery = (imgs ?? []) as GalleryImage[];
        setImages(gallery);
        setActiveImageId(gallery[0]?.id ?? null);
      }
    } catch (err) {
      console.error('Unexpected artwork fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeImageUrl =
    images.find((img) => img.id === activeImageId)?.public_url ??
    images[0]?.public_url ??
    artwork?.image_url;

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

        {/* Admins see draft controls here: an unpublished piece resolves to
            not-found for collectors, but its owner can price + publish it
            from this very URL. Self-hides for everyone else. */}
        <View style={styles.notFoundAdmin}>
          <AdminArtworkControls artPieceId={Number(id)} onChanged={fetchArtwork} />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={goBack}
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

      <TouchableOpacity onPress={goBack} style={styles.backRow}>
        <Text style={[styles.backText, { color: theme.accent }]}>Back</Text>
      </TouchableOpacity>

      <View
        style={[
          styles.card,
          desktopWeb && styles.cardDesktop,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={[styles.galleryWrap, desktopWeb && styles.galleryWrapDesktop]}>
          <Image
            source={{ uri: activeImageUrl }}
            style={[styles.image, desktopWeb && styles.imageDesktop]}
            resizeMode="contain"
          />
          {images.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}
            >
              {images.map((img) => (
                <TouchableOpacity
                  key={img.id}
                  activeOpacity={0.85}
                  onPress={() => setActiveImageId(img.id)}
                  style={[
                    styles.thumb,
                    { borderColor: img.id === activeImageId ? theme.accent : theme.border },
                  ]}
                >
                  <Image source={{ uri: img.public_url }} style={styles.thumbImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

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
            <Text style={[styles.price, { color: theme.accent }]}>
              ${Number(displayPrice).toLocaleString()}
            </Text>
          )}

          {!!artwork.description && (
            <Text style={[styles.description, { color: theme.text }]}>
              {artwork.description}
            </Text>
          )}

          <DetailRows artwork={artwork} theme={theme} />
        </View>
      </View>

      <View style={styles.provenanceSection}>
        <ProvenanceRecord events={artwork.provenance_events} />
      </View>

      <View style={styles.adminSection}>
        <AdminArtworkControls artPieceId={Number(artwork.id)} onChanged={fetchArtwork} />
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
  galleryWrap: {
    width: '100%',
  },
  galleryWrapDesktop: {
    width: '62%',
  },
  image: {
    width: '100%',
    height: 420,
  },
  imageDesktop: {
    width: '100%',
    height: 620,
  },
  thumbRow: {
    gap: 8,
    padding: 10,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 4,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  detailRows: {
    marginTop: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 16,
  },
  detailLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    flexShrink: 1,
    textAlign: 'right',
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
  adminSection: {
    marginHorizontal: 18,
    marginBottom: 18,
  },
  notFoundAdmin: {
    width: '100%',
    maxWidth: 560,
    marginBottom: 16,
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
