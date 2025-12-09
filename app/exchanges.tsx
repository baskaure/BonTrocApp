import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase, Exchange } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Package, Clock, CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react-native';
import { ExchangeTracker } from '@/components/ExchangeTracker';
import { SafeAreaView } from 'react-native-safe-area-context';

type ExchangeWithDetails = Exchange & {
  contract?: {
    proposal?: {
      from_user?: { display_name: string; avatar_url?: string };
      to_user?: { display_name: string; avatar_url?: string };
      listing?: { title: string };
    };
  };
  dispute?: any;
};

export default function ExchangesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [exchanges, setExchanges] = useState<ExchangeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeWithDetails | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadExchanges();
    }
  }, [user, filterStatus]);

  async function loadExchanges() {
    if (!user) return;

    if (!refreshing) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exchanges')
        .select(`
          *,
          dispute:disputes(*),
          contract:contracts(
            *,
            proposal:proposals(
              *,
              from_user:users!proposals_from_user_id_fkey(display_name, avatar_url),
              to_user:users!proposals_to_user_id_fkey(display_name, avatar_url),
              listing:listings(title)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filtered = data?.filter((ex: any) => {
        const proposal = ex.contract?.proposal;
        if (!proposal) return false;
        return proposal.from_user_id === user.id || proposal.to_user_id === user.id;
      }) || [];

      const normalized = filtered.map((ex: any) => ({
        ...ex,
        dispute: Array.isArray(ex.dispute) ? ex.dispute[0] : ex.dispute,
      }));

      setExchanges(normalized as ExchangeWithDetails[]);
    } catch (error) {
      console.error('Error loading exchanges:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const { colors } = useTheme();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Clock size={20} color={colors.textSecondary} />;
      case 'in_progress':
        return <Package size={20} color={colors.primary} />;
      case 'delivered':
        return <AlertCircle size={20} color={colors.warning} />;
      case 'confirmed':
        return <CheckCircle size={20} color={colors.success} />;
      case 'cancelled':
        return <XCircle size={20} color={colors.error} />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      not_started: 'Non démarré',
      in_progress: 'En cours',
      delivered: 'Livré (en attente)',
      confirmed: 'Confirmé',
      cancelled: 'Annulé',
    };
    return texts[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      not_started: colors.textSecondary,
      in_progress: colors.primary,
      delivered: colors.warning,
      confirmed: colors.success,
      cancelled: colors.error,
    };
    return map[status] || colors.textSecondary;
  };

  const getOtherParty = (exchange: ExchangeWithDetails) => {
    const proposal = exchange.contract?.proposal;
    if (!proposal) return null;
    const fromUserId = (proposal as any).from_user_id;
    if (fromUserId === user?.id) {
      return proposal.to_user;
    }
    return proposal.from_user;
  };

  const filteredExchanges = filterStatus === 'all'
    ? exchanges
    : exchanges.filter(ex => ex.status === filterStatus);

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Connectez-vous pour voir vos échanges</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Mes échanges</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Suivez l'état de vos échanges</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {['all', 'in_progress', 'delivered', 'confirmed'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              filterStatus === status && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: colors.textSecondary },
                filterStatus === status && { color: colors.primary, fontWeight: '700' },
              ]}
            >
              {status === 'all' ? 'Tous' :
               status === 'in_progress' ? 'En cours' :
               status === 'delivered' ? 'À confirmer' :
               'Terminés'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredExchanges.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Package size={64} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {filterStatus === 'all'
              ? "Vous n'avez pas encore d'échange"
              : `Aucun échange ${getStatusText(filterStatus).toLowerCase()}`}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadExchanges();
              }}
              tintColor={colors.textSecondary}
              colors={[colors.primary]}
            />
          }
        >
          {filteredExchanges.map((exchange) => {
            const otherParty = getOtherParty(exchange);
            const proposal = exchange.contract?.proposal;
            const listing = proposal?.listing;

            return (
              <TouchableOpacity
                key={exchange.id}
                style={[styles.exchangeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setSelectedExchange(exchange)}
              >
                <View style={styles.exchangeHeader}>
                  <View style={styles.exchangeUser}>
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                      <Text style={styles.avatarText}>
                        {otherParty?.display_name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.exchangeUserInfo}>
                      <Text style={[styles.exchangeUserName, { color: colors.text }]}>
                        Échange avec {otherParty?.display_name || 'Utilisateur'}
                      </Text>
                      <Text style={[styles.exchangeTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {listing?.title || 'Annonce supprimée'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(exchange.status) + '20' }]}>
                    {getStatusIcon(exchange.status)}
                    <Text style={[styles.statusText, { color: getStatusColor(exchange.status) }]}>
                      {getStatusText(exchange.status)}
                    </Text>
                  </View>
                </View>

                {exchange.due_date && (
                  <View style={styles.dateRow}>
                    <Calendar size={14} color={colors.textSecondary} />
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                      Échéance: {new Date(exchange.due_date).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                )}

                {exchange.dispute && (
                  <View style={[styles.disputeBadge, { backgroundColor: colors.errorLight }]}>
                    <AlertCircle size={14} color={colors.error} />
                    <Text style={[styles.disputeText, { color: colors.error }]}>
                      Litige {exchange.dispute.status === 'resolved' ? 'résolu' : 'en cours'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <BottomNav />

      {selectedExchange && (
        <ExchangeTracker
          exchange={selectedExchange}
          visible={true}
          onClose={() => setSelectedExchange(null)}
          onUpdate={loadExchanges}
        />
      )}
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  filterScroll: {
    maxHeight: 60,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
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
  exchangeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  exchangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exchangeUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  exchangeUserInfo: {
    flex: 1,
  },
  exchangeUserName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  exchangeTitle: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dateText: {
    fontSize: 12,
  },
  disputeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  disputeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

