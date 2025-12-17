import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase, Proposal } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { MessageCircle, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProposalsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposalsWithUnreadMessages, setProposalsWithUnreadMessages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadProposals();
      loadUnreadMessages();
    }
  }, [user, filter]);

  async function loadProposals() {
    if (!user) return;

    if (!refreshing) setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('proposals')
        .select(`
          *,
          from_user:users!proposals_from_user_id_fkey(*),
          to_user:users!proposals_to_user_id_fkey(*),
          listing:listings(*)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'sent') {
        query = query.eq('from_user_id', user.id);
      } else if (filter === 'received') {
        query = query.eq('to_user_id', user.id);
      } else {
        query = query.or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error('Error loading proposals:', error);
      setError('Impossible de charger les propositions. Réessayez plus tard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle size={20} color="#10B981" />;
      case 'refused':
        return <XCircle size={20} color="#EF4444" />;
      case 'countered':
        return <RefreshCw size={20} color="#F59E0B" />;
      default:
        return <Clock size={20} color="#19ADFA" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'En attente',
      countered: 'Contre-proposition',
      accepted: 'Acceptée',
      refused: 'Refusée',
      cancelled: 'Annulée',
    };
    return statusMap[status] || status;
  };

  const { colors } = useTheme();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Mes propositions</Text>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
          <Text style={{ color: colors.error }}>{error}</Text>
        </View>
      )}

      <View style={[styles.filterTabs, { borderBottomColor: colors.border }]}>
        {['all', 'sent', 'received'].map((filterType) => (
          <TouchableOpacity
            key={filterType}
            style={[styles.filterTab, filter === filterType && { borderBottomColor: colors.primary }]}
            onPress={() => setFilter(filterType as any)}
          >
            <Text style={[styles.filterTabText, { color: filter === filterType ? colors.primary : colors.textSecondary }]}>
              {filterType === 'all' ? 'Toutes' : filterType === 'sent' ? 'Envoyées' : 'Reçues'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProposals();
              loadUnreadMessages();
            }}
            tintColor={colors.textSecondary}
            colors={[colors.primary]}
          />
        }
      >
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
                  style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push({
                    pathname: '/proposal/[id]',
                    params: { id: proposal.id }
                  })}
                >
                  <View style={styles.proposalHeader}>
                    <View style={styles.statusRow}>
                      {getStatusIcon(proposal.status)}
                      <Text style={[styles.statusText, { color: colors.text }]}>{getStatusText(proposal.status)}</Text>
                      <Text style={[styles.proposalType, { color: colors.textSecondary }]}>· {isSent ? 'Envoyée' : 'Reçue'}</Text>
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

      <BottomNav />
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
  header: {
    padding: 16,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 16,
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
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFF',
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

