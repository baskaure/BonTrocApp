import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { ArrowLeft, MapPin, Calendar, Star, ShieldCheck, Lock } from 'lucide-react-native';
import { PublicProfile, Review } from '@/lib/supabase';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';

type PublicProfileHeaderProps = {
  /** Profil public (vue `public_profiles`) : jamais la table `users` d'un autre membre. */
  user: PublicProfile;
  reviews: Review[];
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

  // La note est recalculée côté serveur (trigger sur reviews) : on affiche celle du profil.
  const reviewCount = user.rating_count || reviews.length;
  const avgRating = useMemo(() => {
    if (user.rating_count > 0) return Number(user.rating_avg).toFixed(1);
    if (reviews.length === 0) return null;
    return (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  }, [user.rating_avg, user.rating_count, reviews]);
  const isPrivate = user.profile_visibility === 'private';

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
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]}>{user.display_name}</Text>
                {user.is_verified && <ShieldCheck size={18} color={colors.primary} />}
              </View>
              {!!user.username && <Text style={[styles.username, { color: colors.textSecondary }]}>@{user.username}</Text>}
              {reviewCount > 0 && avgRating && (
                <View style={styles.rating}>
                  <Star size={16} color={colors.secondary} fill={colors.secondary} />
                  <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                    {avgRating} · {reviewCount} avis
                  </Text>
                </View>
              )}
            </View>
          </View>

          {isPrivate && (
            <View style={[styles.privateBox, { backgroundColor: colors.surfaceContainer }]}>
              <Lock size={14} color={colors.textSecondary} />
              <Text style={[styles.privateText, { color: colors.textSecondary }]}>Ce membre a rendu son profil privé.</Text>
            </View>
          )}

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
              <Text style={[styles.statValue, { color: colors.secondary }]}>{reviewCount}</Text>
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

PublicProfileHeader.displayName = 'PublicProfileHeader';

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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  privateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 12,
  },
  privateText: {
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
