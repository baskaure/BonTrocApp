import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Listing } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { MapPin, Star, TrendingUp, Sparkles, Shield } from 'lucide-react-native';

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
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.imageContainer, { backgroundColor: getGradientColor(listing.type) }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : null}
        
        <View style={styles.imageOverlay}>
          <View style={styles.locationBadge}>
            <MapPin size={12} color="#1E293B" />
            <Text style={styles.locationText} numberOfLines={1}>
              {listing.user?.city || 'N/A'}
            </Text>
          </View>

          {listing.user?.is_verified && (
            <View style={styles.verifiedBadge}>
              <Shield size={16} color="#19ADFA" />
            </View>
          )}

          <View style={styles.typeBadges}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {listing.type === 'service' ? 'Service' : 'Produit'}
              </Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText} numberOfLines={1}>
                {listing.mode === 'remote' ? 'Distance' : listing.mode === 'on_site' ? 'Présentiel' : 'Les deux'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.userInfo}>
          {listing.user?.avatar_url ? (
            <Image
              source={{ uri: listing.user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {listing.user?.display_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {listing.user?.display_name || 'Utilisateur'}
            </Text>
            {listing.user && listing.user.rating_count > 0 ? (
              <View style={styles.rating}>
                <Star size={12} color={colors.secondary} fill={colors.secondary} />
                <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                  {listing.user.rating_avg.toFixed(1)} · {listing.user.rating_count} avis
                </Text>
              </View>
            ) : (
              <Text style={[styles.newMember, { color: colors.textSecondary }]}>Nouveau membre</Text>
            )}
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {listing.title}
        </Text>

        <View style={styles.offerSection}>
          <View style={[styles.offerBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <View style={styles.offerHeader}>
              <TrendingUp size={14} color={colors.primary} />
              <Text style={[styles.offerLabel, { color: colors.primary }]}>J'offre</Text>
            </View>
            <Text style={[styles.offerText, { color: colors.text }]} numberOfLines={2}>
              {listing.description_offer}
            </Text>
          </View>

          <View style={[styles.seekBox, { backgroundColor: colors.secondaryLight, borderColor: colors.secondary }]}>
            <View style={styles.seekHeader}>
              <Sparkles size={14} color={colors.secondary} />
              <Text style={[styles.seekLabel, { color: colors.secondary }]}>Je cherche</Text>
            </View>
            <Text style={[styles.seekText, { color: colors.text }]} numberOfLines={2}>
              {listing.desired_exchange_desc}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  imageContainer: {
    height: 140,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    justifyContent: 'space-between',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: 80,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 6,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  typeBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  typeBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  content: {
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
  },
  newMember: {
    fontSize: 12,
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  offerSection: {
    gap: 8,
  },
  offerBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  offerLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  offerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  seekBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  seekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  seekLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seekText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

