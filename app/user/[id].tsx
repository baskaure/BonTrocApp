import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { ArrowLeft, MapPin, Star, TrendingUp, Sparkles, Shield, MessageCircle, Pencil, Trash2, Calendar, Flag } from 'lucide-react-native';
import { Listing, Review } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser, useReviews } from '@/lib/store/hooks';
import { supabase } from '@/lib/supabase';
import { PublicProfileHeader } from '@/components/PublicProfileHeader';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);

  // Utiliser le store pour charger l'utilisateur et les reviews
  const { user, loading: userLoading } = useUser(id || null, { autoLoad: !!id });
  const { reviews, loading: reviewsLoading } = useReviews(id || null, { autoLoad: !!id });
  
  // Récupérer la hauteur dynamique du header (hauteur totale avec safe area)
  const { publicProfileHeaderTotalHeight } = useHeaderHeightStore();

  useEffect(() => {
    if (id) {
      loadListings();
    }
  }, [id]);

  async function loadListings() {
    if (!id) return;
    setListingsLoading(true);
    try {
      const { data: listingsData } = await supabase
        .from('listings')
        .select(`*, media:listing_media(*)`)
        .eq('user_id', id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (listingsData) setListings(listingsData);
    } catch (err) {
      console.error('Error loading listings:', err);
    } finally {
      setListingsLoading(false);
    }
  }

  const loading = userLoading || reviewsLoading || listingsLoading;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2B86CC" />
      </View>
    );
  }

  if (!user) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Retour</Text>
      </TouchableOpacity>
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Utilisateur non trouvé</Text>
      </View>
    </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <PublicProfileHeader user={user} reviews={reviews} listingsCount={listings.length} />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: publicProfileHeaderTotalHeight + 16 } // Hauteur totale du header (safe area + header) + espace
        ]}
      >
        {listings.length > 0 && (
              <View style={styles.listingsSection}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Annonces de {user.display_name} ({listings.length})
                </Text>
                <View style={styles.listingsGrid}>
                  {listings.map((listing) => (
                    <TouchableOpacity
                      key={listing.id}
                      style={[styles.listingCard, { backgroundColor: colors.background }]}
                      onPress={() => router.push(`/listing/${listing.id}`)}
                    >
                      {listing.media && listing.media[0] ? (
                        <Image source={{ uri: listing.media[0].url }} style={styles.listingImage} />
                      ) : (
                        <View style={[styles.listingImagePlaceholder, { backgroundColor: colors.primary }]}>
                          <Text style={styles.listingImageText}>
                            {listing.type === 'service' ? 'Service' : 'Produit'}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={2}>
                        {listing.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.reviewsSection}>
              <View style={styles.reviewsSectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Avis reçus ({reviews.length})</Text>
                {reviews.length > 2 && (
                  <TouchableOpacity
                    onPress={() => {
                      // @ts-ignore - Route dynamique
                      router.push(`/reviews/${id}`);
                    }}
                    style={styles.seeMoreButton}
                  >
                    <Text style={[styles.seeMoreText, { color: colors.primary }]}>Voir plus</Text>
                  </TouchableOpacity>
                )}
              </View>
              {reviews.length === 0 ? (
                <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
              ) : (
                <View style={styles.reviewsList}>
                    {reviews.slice(0, 2).map((review) => (
                      <View
                        key={review.id}
                        style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={styles.reviewHeader}>
                          {review.reviewer?.avatar_url ? (
                            <Image
                              source={{ uri: review.reviewer.avatar_url }}
                              style={styles.reviewerAvatar}
                            />
                          ) : (
                            <View style={styles.reviewerAvatarPlaceholder}>
                              <Text style={styles.reviewerAvatarText}>
                                {review.reviewer?.display_name?.[0]?.toUpperCase() || '?'}
                              </Text>
                            </View>
                          )}
                          <View style={styles.reviewerInfo}>
                            <Text style={[styles.reviewerName, { color: colors.text }]}>
                              {review.reviewer?.display_name || 'Utilisateur'}
                            </Text>
                            <View style={styles.reviewStars}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={14}
                                  color={star <= review.rating ? colors.secondary : colors.border}
                                  fill={star <= review.rating ? colors.secondary : 'transparent'}
                                />
                              ))}
                            </View>
                          </View>
                        </View>
                        {review.comment && (
                          <Text style={[styles.reviewComment, { color: colors.text }]}>{review.comment}</Text>
                        )}
                        {review.tags && review.tags.length > 0 && (
                          <View style={styles.reviewTags}>
                            {review.tags.map((tag) => (
                              <View key={tag} style={[styles.reviewTag, { backgroundColor: colors.primaryLight }]}>
                                <Text style={[styles.reviewTagText, { color: colors.primary }]}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>
                          {new Date(review.created_at).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    paddingTop: 48,
  },
  backButtonText: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Espace pour la bottom bar fixe
  },
  profileCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  banner: {
    width: '100%',
    height: 160,
  },
  profileContent: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    marginTop: -48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2B86CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    marginTop: -48,
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 36,
  },
  profileInfo: {
    flex: 1,
    marginTop: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 15,
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  infoRow: {
    gap: 12,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
  },
  tagsSection: {
    marginBottom: 16,
  },
  tagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  skillTag: {
    // Background color will be set dynamically
  },
  skillTagText: {
    // Color will be set dynamically
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  listingsSection: {
    marginBottom: 24,
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listingCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  listingImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  listingImagePlaceholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  listingImageText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '600',
    padding: 12,
  },
  reviewsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeMoreButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewsSection: {
    marginTop: 24,
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2B86CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  reviewTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewTagText: {
    fontSize: 11,
  },
  reviewDate: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
});

