import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Listing } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { MapPin, ShieldCheck } from 'lucide-react-native';

type ListingCardProps = {
  listing: Listing;
  onPress: () => void;
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
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
        shadows.soft,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Image */}
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

        {/* Badges en overlay */}
        <View style={styles.overlay} pointerEvents="none">
          {listing.user?.city && (
            <View style={styles.cityBadge}>
              <MapPin size={10} color="#13202E" />
              <Text style={styles.cityText} numberOfLines={1}>
                {listing.user.city}
              </Text>
            </View>
          )}
          {listing.user?.is_verified && (
            <View style={[styles.certBadge, { backgroundColor: colors.primary }]}>
              <ShieldCheck size={12} color="#FFF" />
            </View>
          )}
        </View>
      </View>

      {/* Titre uniquement */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {listing.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
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
    fontSize: 13,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '75%',
  },
  cityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: '#13202E',
  },
  certBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
});
