import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Listing } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { MapPin, ShieldCheck } from 'lucide-react-native';

type ListingCardProps = {
  listing: Listing;
  onPress: () => void;
};

const TYPE_LABEL: Record<Listing['type'], string> = {
  service: 'SERVICE',
  product: 'PRODUIT',
};

const MODE_LABEL: Record<Listing['mode'], string> = {
  remote: 'À DISTANCE',
  on_site: 'PRÉSENTIEL',
  both: 'LES DEUX',
};

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const { colors, radius, shadows } = useTheme();
  const imageUrl = listing.media && listing.media.length > 0
    ? listing.media[0].url
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
        shadows.card,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Bannière */}
      <View style={[styles.imageContainer, { backgroundColor: colors.primaryLight }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={[styles.imagePlaceholderText, { color: colors.primary }]}>
              {listing.type === 'service' ? 'Service' : 'Produit'}
            </Text>
          </View>
        )}

        {/* Badges en overlay haut */}
        <View style={styles.topBadges}>
          {listing.user?.city && (
            <View style={styles.cityBadge}>
              <MapPin size={11} color="#13202E" />
              <Text style={styles.cityText} numberOfLines={1}>
                {listing.user.city.toUpperCase()}
              </Text>
            </View>
          )}
          {listing.user?.is_verified && (
            <View style={[styles.certBadge, { backgroundColor: colors.primary }]}>
              <ShieldCheck size={12} color="#FFF" />
              <Text style={styles.certText}>CERTIFIÉ</Text>
            </View>
          )}
        </View>
      </View>

      {/* Contenu */}
      <View style={styles.content}>
        <View style={styles.chipsRow}>
          <View style={[styles.chip, { backgroundColor: colors.surfaceContainer }]}>
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>{TYPE_LABEL[listing.type]}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.surfaceContainer }]}>
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>{MODE_LABEL[listing.mode]}</Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {listing.title}
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.primary }]}>J'OFFRE</Text>
        <Text style={[styles.sectionText, { color: colors.textSecondary }]} numberOfLines={2}>
          {listing.description_offer}
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.warning, marginTop: 10 }]}>JE CHERCHE</Text>
        <Text style={[styles.sectionText, { color: colors.textSecondary }]} numberOfLines={2}>
          {listing.desired_exchange_desc}
        </Text>

        <View style={[styles.ctaButton, { borderColor: colors.primary, borderRadius: radius.md }]}>
          <Text style={[styles.ctaText, { color: colors.primary }]}>Voir l'offre</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 18,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  topBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 7,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    maxWidth: 130,
  },
  cityText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#13202E',
  },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  certText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#FFF',
  },
  content: {
    padding: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 11,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 13,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  ctaButton: {
    marginTop: 16,
    borderWidth: 1.5,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});
