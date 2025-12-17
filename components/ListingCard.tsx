import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Listing } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { MapPin, Shield } from 'lucide-react-native';

type ListingCardProps = {
  listing: Listing;
  onPress: () => void;
};

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const { colors } = useTheme();
  const imageUrl = listing.media && listing.media.length > 0
    ? listing.media[0].url
    : null;

  const getGradientColor = (type: string) => {
    return type === 'service' ? colors.primary : colors.secondary;
  };

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.surface }]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      {/* Image - Style Vinted : grande et propre */}
      <View style={[styles.imageContainer, { backgroundColor: getGradientColor(listing.type) }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>
              {listing.type === 'service' ? 'Service' : 'Produit'}
            </Text>
          </View>
        )}
        
        {/* Overlay minimal : juste localisation et vérifié */}
        <View style={styles.imageOverlay}>
          {listing.user?.city && (
            <View style={styles.locationBadge}>
              <MapPin size={10} color="#FFF" />
              <Text style={styles.locationText} numberOfLines={1}>
                {listing.user.city}
              </Text>
            </View>
          )}

          {listing.user?.is_verified && (
            <View style={styles.verifiedBadge}>
              <Shield size={14} color="#19ADFA" fill="#19ADFA" />
            </View>
          )}
        </View>
      </View>

      {/* Contenu minimal : juste le titre */}
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
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    overflow: 'hidden',
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
    fontWeight: '600',
    color: '#94A3B8',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 5,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  content: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
});

