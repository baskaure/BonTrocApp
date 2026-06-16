import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { Proposal } from '@/lib/supabase';
import { MessageCircle, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProposals } from '@/lib/store/hooks';
import { supabase } from '@/lib/supabase';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';

export default function ProposalsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [proposalsWithUnreadMessages, setProposalsWithUnreadMessages] = useState<Set<string>>(new Set());

  // Utiliser le store pour charger les propositions
  const { proposals, loading, error, refresh } = useProposals(user?.id || null, filter, { autoLoad: !!user });
  
  // Récupérer la hauteur dynamique du header (hauteur totale avec safe area)
  const { pageHeaderTotalHeight } = useHeaderHeightStore();

  useEffect(() => {
    if (user) {
      loadUnreadMessages();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUnreadMessages();
    }
  }, [proposals]);

  async function loadUnreadMessages() {
    if (!user) return;

    try {
      // Récupérer les notifications de type message_received non lues
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('related_id')
        .eq('user_id', user.id)
        .eq('type', 'message_received')
        .is('read_at', null);

      if (error) {
        // Si la table n'existe pas, on ignore silencieusement
        if (error.code === 'PGRST205') {
          console.warn('Table notifications does not exist. Please run the SQL script to create it.');
          setProposalsWithUnreadMessages(new Set());
        } else {
          console.error('Error loading unread messages:', error);
        }
        return;
      }

      if (notifications) {
        // Extraire les IDs des propositions qui ont des messages non lus
        const proposalIds = new Set(
          notifications
            .map(n => n.related_id)
            .filter(id => id !== null) as string[]
        );
        setProposalsWithUnreadMessages(proposalIds);
      }
    } catch (error) {
      console.error('Error loading unread messages:', error);
      setProposalsWithUnreadMessages(new Set());
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
    loadUnreadMessages();
    setTimeout(() => setRefreshing(false), 500);
  };

  const { colors, radius, shadows } = useTheme();

  const getStatusChip = (status: string): { bg: string; fg: string; label: string } => {
    switch (status) {
      case 'accepted':
        return { bg: colors.primaryLight, fg: colors.primary, label: 'ACCEPTÉE' };
      case 'refused':
        return { bg: colors.errorLight, fg: colors.error, label: 'REFUSÉE' };
      case 'countered':
        return { bg: colors.secondaryLight, fg: colors.warning, label: 'CONTRE-PROP.' };
      case 'cancelled':
        return { bg: colors.surfaceContainer, fg: colors.textTertiary, label: 'ANNULÉE' };
      default:
        return { bg: colors.warningLight, fg: colors.warning, label: 'EN ATTENTE' };
    }
  };

  // Aperçu de l'activité (basé sur les propositions affichées)
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;

  // Ne jamais afficher le loader si on a déjà des données (évite le flash lors de la navigation)
  if (loading && proposals.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={[styles.contentWrapper, { marginTop: pageHeaderTotalHeight }]}>
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
            <Text style={{ color: colors.error }}>{error.message}</Text>
          </View>
        )}

        <View style={styles.filterChips}>
        {(['all', 'sent', 'received'] as const).map((filterType) => {
          const active = filter === filterType;
          return (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterChip,
                { backgroundColor: active ? colors.primary : colors.surfaceContainer, borderRadius: radius.pill },
              ]}
              onPress={() => setFilter(filterType)}
            >
              <Text style={[styles.filterChipText, { color: active ? colors.onPrimary : colors.textSecondary }]}>
                {filterType === 'all' ? 'Toutes' : filterType === 'sent' ? 'Envoyées' : 'Reçues'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textSecondary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Hero : aperçu de l'activité */}
        <LinearGradient
          colors={[colors.primary, colors.primaryBright]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderRadius: radius.xl }, shadows.card, { shadowColor: colors.primary }]}
        >
          <Text style={styles.heroTitle}>Bonjour, {user?.display_name} 👋</Text>
          <Text style={styles.heroSubtitle}>Aperçu de l'activité de vos propositions.</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>ACTIVES</Text>
              <Text style={styles.heroStatValue}>{proposals.length}</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>EN ATTENTE</Text>
              <Text style={styles.heroStatValue}>{pendingCount}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Bandeau profil vérifié */}
        {user?.is_verified && (
          <View style={[styles.verifiedBanner, { backgroundColor: colors.secondary, borderRadius: radius.lg }]}>
            <View style={styles.verifiedIcon}>
              <ShieldCheck size={22} color={colors.onSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifiedTitle, { color: colors.onSecondary }]}>Profil vérifié</Text>
              <Text style={[styles.verifiedSubtitle, { color: colors.onSecondary }]}>Certifié auprès de la communauté.</Text>
            </View>
          </View>
        )}

        {proposals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MessageCircle size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune proposition pour le moment</Text>
          </View>
        ) : (
          <View style={styles.proposalsList}>
            {proposals.map((proposal) => {
              const otherUser = proposal.from_user_id === user?.id ? proposal.to_user : proposal.from_user;
              const isSent = proposal.from_user_id === user?.id;

              return (
                <TouchableOpacity
                  key={proposal.id}
                  style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, shadows.card]}
                  onPress={() => router.push({
                    pathname: '/proposal/[id]',
                    params: { id: proposal.id }
                  })}
                >
                  <View style={styles.proposalHeader}>
                    <View style={styles.statusRow}>
                      {(() => {
                        const chip = getStatusChip(proposal.status);
                        return (
                          <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
                            <Text style={[styles.statusChipText, { color: chip.fg }]}>{chip.label}</Text>
                          </View>
                        );
                      })()}
                      <Text style={[styles.proposalType, { color: colors.textTertiary }]}>{isSent ? 'ENVOYÉE' : 'REÇUE'}</Text>
                      <View style={{ flex: 1 }} />
                      <ChevronRight size={20} color={colors.textTertiary} />
                    </View>
                    <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={1}>
                      {proposal.listing?.title}
                    </Text>
                  </View>

                  <View style={styles.proposalUser}>
                    <View style={styles.avatarContainer}>
                      {otherUser?.avatar_url ? (
                        <Image
                          source={{ uri: otherUser.avatar_url }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarText}>
                            {otherUser?.display_name?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      {proposalsWithUnreadMessages.has(proposal.id) && (
                        <View style={styles.unreadMessageBadge} />
                      )}
                    </View>
                    <View style={styles.proposalUserInfo}>
                      <Text style={[styles.proposalUserName, { color: colors.text }]}>{otherUser?.display_name}</Text>
                      <Text style={[styles.proposalDate, { color: colors.textSecondary }]}>
                        {new Date(proposal.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.proposalMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                    {proposal.message}
                  </Text>

                  {proposal.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.discussButton, { backgroundColor: colors.primary }]}
                      onPress={() => router.push({
                        pathname: '/proposal/[id]',
                        params: { id: proposal.id }
                      })}
                    >
                      <MessageCircle size={16} color="#FFF" />
                      <Text style={styles.discussButtonText}>Ouvrir la discussion</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
      </View>
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
  filterChips: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  hero: {
    padding: 20,
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    padding: 13,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.85)',
  },
  heroStatValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    marginBottom: 20,
  },
  verifiedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  verifiedSubtitle: {
    fontSize: 12,
    opacity: 0.8,
  },
  statusChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  contentWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Espace pour la bottom bar fixe
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  proposalsList: {
    gap: 12,
  },
  proposalCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  proposalHeader: {
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  proposalType: {
    fontSize: 12,
  },
  proposalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  proposalUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  unreadMessageBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D8463E',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2B86CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  proposalUserInfo: {
    flex: 1,
  },
  proposalUserName: {
    fontSize: 14,
    fontWeight: '600',
  },
  proposalDate: {
    fontSize: 12,
    marginTop: 2,
  },
  proposalMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  discussButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  discussButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

