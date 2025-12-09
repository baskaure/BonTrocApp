import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { supabase, User, Listing, Review } from '@/lib/supabase';
import { ArrowLeft, MapPin, Calendar, Star } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ReviewWithReviewer = Review & {
  reviewer?: { display_name: string; avatar_url?: string };
};

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (userData) setUser(userData);

      const { data: listingsData } = await supabase
        .from('listings')
        .select(`*, media:listing_media(*)`)
        .eq('user_id', id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (listingsData) setListings(listingsData);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:users!reviews_reviewer_id_fkey(display_name, avatar_url)
        `)
        .eq('reviewee_id', id)
        .order('created_at', { ascending: false });

      if (reviewsData) setReviews(reviewsData);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#19ADFA" />
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

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;
  const hasBanner = !!user.banner_url;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Retour</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          {user.banner_url ? (
            <Image source={{ uri: user.banner_url }} style={styles.banner} />
          ) : (
            <View style={[styles.bannerPlaceholder, { backgroundColor: colors.primary }]} />
          )}

          <View style={styles.profileContent}>
            <View style={styles.profileHeader}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={[styles.avatar, { borderColor: colors.surface, marginTop: hasBanner ? -48 : 0 }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { borderColor: colors.surface, marginTop: hasBanner ? -48 : 0 }]}>
                  <Text style={[styles.avatarText, { color: colors.text }]}>
                    {user.display_name[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={[styles.name, { color: colors.text }]}>{user.display_name}</Text>
                <Text style={[styles.username, { color: colors.textSecondary }]}>@{user.username}</Text>
                {reviews.length > 0 && avgRating && (
                  <View style={styles.rating}>
                    <Star size={16} color={colors.secondary} fill={colors.secondary} />
                    <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                      {avgRating} · {reviews.length} avis
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {user.bio && (
              <Text style={[styles.bio, { color: colors.text }]}>{user.bio}</Text>
            )}

            <View style={styles.infoRow}>
              {(user.city || user.country) && (
                <View style={styles.infoItem}>
                  <MapPin size={16} color={colors.textSecondary} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    {[user.city, user.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
              <View style={styles.infoItem}>
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Membre depuis {new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
            </View>

            {user.languages && user.languages.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={[styles.tagsLabel, { color: colors.textSecondary }]}>Langues</Text>
                <View style={styles.tags}>
                  {user.languages.map((lang) => (
                    <View key={lang} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.tagText, { color: colors.primary }]}>{lang}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {user.skills && user.skills.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={[styles.tagsLabel, { color: colors.textSecondary }]}>Compétences</Text>
                <View style={styles.tags}>
                  {user.skills.map((skill) => (
                    <View key={skill} style={[styles.tag, styles.skillTag, { backgroundColor: colors.successLight }]}>
                      <Text style={[styles.tagText, styles.skillTagText, { color: colors.success }]}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{listings.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Annonces</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{reviews.length || '-'}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avis</Text>
              </View>
              <View style={styles.stat}>
                {avgRating ? (
                  <View style={styles.statRating}>
                    <Star size={20} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.statValue}>{avgRating}</Text>
                  </View>
                ) : (
                  <Text style={styles.statValue}>-</Text>
                )}
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Note</Text>
              </View>
            </View>

            {listings.length > 0 && (
              <View style={styles.listingsSection}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Annonces de {user.display_name} ({listings.length})
                </Text>
                <View style={styles.listingsGrid}>
                  {listings.map((listing) => (
                    <TouchableOpacity
                      key={listing.id}
                      style={styles.listingCard}
                      onPress={() => router.push(`/listing/${listing.id}`)}
                    >
                      {listing.media && listing.media[0] ? (
                        <Image source={{ uri: listing.media[0].url }} style={styles.listingImage} />
                      ) : (
                        <View style={styles.listingImagePlaceholder}>
                          <Text style={styles.listingImageText}>
                            {listing.type === 'service' ? 'Service' : 'Produit'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.listingTitle} numberOfLines={2}>
                        {listing.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.reviewsSection}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Avis reçus ({reviews.length})</Text>
              {reviews.length === 0 ? (
                <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
              ) : (
                <View style={styles.reviewsList}>
                    {reviews.map((review) => (
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
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    color: '#64748B',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    borderColor: '#FFF',
    marginTop: -48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
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
    color: '#1E293B',
    marginBottom: 4,
  },
  username: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#64748B',
  },
  bio: {
    fontSize: 15,
    color: '#475569',
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
    color: '#64748B',
  },
  tagsSection: {
    marginBottom: 16,
  },
  tagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    color: '#19ADFA',
    fontWeight: '600',
  },
  skillTag: {
    backgroundColor: '#D1FAE5',
  },
  skillTagText: {
    color: '#059669',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    color: '#19ADFA',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    overflow: 'hidden',
  },
  listingImage: {
    width: '100%',
    height: 120,
  },
  listingImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#19ADFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingImageText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    padding: 12,
  },
  reviewsSection: {
    marginTop: 24,
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
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
    backgroundColor: '#F59E0B',
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
    color: '#1E293B',
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: '#475569',
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
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewTagText: {
    fontSize: 11,
    color: '#19ADFA',
  },
  reviewDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 32,
  },
});

