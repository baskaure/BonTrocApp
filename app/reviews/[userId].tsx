import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { supabase, Review, User } from '@/lib/supabase';
import { ArrowLeft, Star } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { Image } from 'react-native';

type ReviewWithReviewer = Review & {
  reviewer?: { display_name: string; avatar_url?: string };
};

export default function ReviewsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userId) {
      loadReviews();
      loadUser();
    }
  }, [userId]);

  async function loadUser() {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) setUser(data);
    } catch (err) {
      console.error('Error loading user:', err);
    }
  }

  async function loadReviews(silent = false) {
    if (!userId) return;
    if (!silent) setLoading(true);
    try {
      const { data } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:users!reviews_reviewer_id_fkey(display_name, avatar_url)
        `)
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false });

      if (data) setReviews(data);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews(true);
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Avis reçus
          </Text>
          {user && (
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {user.display_name || 'Utilisateur'}
            </Text>
          )}
        </View>
      </View>

      {loading && reviews.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Star size={64} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Aucun avis pour le moment
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Résumé des avis */}
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryRating}>
                <Text style={[styles.summaryRatingValue, { color: colors.text }]}>
                  {averageRating.toFixed(1)}
                </Text>
                <View style={styles.summaryStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={20}
                      color={star <= Math.round(averageRating) ? colors.secondary : colors.border}
                      fill={star <= Math.round(averageRating) ? colors.secondary : 'transparent'}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.summaryStats}>
                <Text style={[styles.summaryStatsValue, { color: colors.text }]}>
                  {reviews.length}
                </Text>
                <Text style={[styles.summaryStatsLabel, { color: colors.textSecondary }]}>
                  {reviews.length === 1 ? 'avis' : 'avis'}
                </Text>
              </View>
            </View>
          </View>

          {/* Liste des avis */}
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
                    <View style={[styles.reviewerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
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
                  <Text style={[styles.reviewComment, { color: colors.text }]}>
                    {review.comment}
                  </Text>
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
                  {new Date(review.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRating: {
    alignItems: 'center',
  },
  summaryRatingValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryStars: {
    flexDirection: 'row',
    gap: 4,
  },
  summaryStats: {
    alignItems: 'center',
  },
  summaryStatsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryStatsLabel: {
    fontSize: 14,
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  reviewerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  reviewerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  reviewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reviewTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reviewTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reviewDate: {
    fontSize: 12,
  },
});

