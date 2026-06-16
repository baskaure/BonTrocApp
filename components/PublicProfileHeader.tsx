import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { ArrowLeft, MapPin, Calendar, Star } from 'lucide-react-native';
import { User, Review } from '@/lib/supabase';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';

type ReviewWithReviewer = Review & {
  reviewer?: { display_name: string; avatar_url?: string };
};

type PublicProfileHeaderProps = {
  user: User;
  reviews: ReviewWithReviewer[];
  listingsCount: number;
};

export const PublicProfileHeader = React.memo<PublicProfileHeaderProps>(({
  user,
  reviews,
  listingsCount,
}) => {
  const router = useRouter();
  const { colors } = useTheme();
  const { setPublicProfileHeaderHeight, safeAreaTop } = useHeaderHeightStore();

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return null;
    return (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  const hasBanner = !!user.banner_url;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    // Stocker uniquement la hauteur du header (sans safe area)
    // La hauteur totale sera calculée automatiquement dans le store
    setPublicProfileHeaderHeight(height);
  }, [setPublicProfileHeaderHeight]);

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          paddingTop: safeAreaTop, // Utiliser la safe area du store directement
        }
      ]}
      pointerEvents="box-none"
    >
      <View 
        style={[styles.content, { backgroundColor: colors.background }]}
        onLayout={onLayout}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Retour</Text>
        </TouchableOpacity>

      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {user.banner_url ? (
          <Image source={{ uri: user.banner_url }} style={styles.banner} />
        ) : (
          <View style={[styles.bannerPlaceholder, { backgroundColor: colors.primary }]} />
        )}

        <View style={styles.profileContent}>
          <View style={styles.profileHeader}>
            {user.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={[
                  styles.avatar,
                  { borderColor: colors.surface, marginTop: hasBanner ? -48 : 0 }
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { borderColor: colors.surface, marginTop: hasBanner ? -48 : 0 }
                ]}
              >
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
                  <View key={skill} style={[styles.tag, { backgroundColor: colors.successLight }]}>
                    <Text style={[styles.tagText, { color: colors.success }]}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.stats, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{listingsCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Annonces</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.secondary }]}>{reviews.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avis</Text>
            </View>
            {avgRating && (
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.success }]}>{avgRating}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Note</Text>
              </View>
            )}
          </View>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 998,
  },
  content: {
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    margin: 12,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
  },
  profileCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    margin: 12,
    marginTop: 0,
  },
  banner: {
    width: '100%',
    height: 120,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 120,
  },
  profileContent: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2B86CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    marginTop: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    marginBottom: 4,
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
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
  },
  tagsSection: {
    marginBottom: 12,
  },
  tagsLabel: {
    fontSize: 12,
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
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
});
