import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { Exchange, ExchangeStatus } from '@/lib/supabase';
import { EXCHANGE_STATUS_LABEL } from '@/lib/labels';
import { Package, Clock, CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExchanges } from '@/lib/store/hooks';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';

type Filter = 'all' | ExchangeStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'not_started', label: 'À démarrer' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'delivered', label: 'À confirmer' },
  { id: 'confirmed', label: 'Terminés' },
];

export default function ExchangesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Utiliser le store pour charger les échanges
  const { exchanges: rawExchanges, loading, refresh, reload } = useExchanges(user?.id || null, { autoLoad: !!user });

  // Récupérer la hauteur dynamique du header (hauteur totale avec safe area)
  const { pageHeaderTotalHeight } = useHeaderHeightStore();

  // Filtrer par statut
  const exchanges = useMemo(
    () => rawExchanges.filter((ex) => filterStatus === 'all' || ex.status === filterStatus),
    [rawExchanges, filterStatus],
  );

  // Au retour sur l'onglet, on relit le cache (invalidé après chaque action sur un échange).
  useFocusEffect(
    useCallback(() => {
      if (user) void reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const { colors, radius, shadows } = useTheme();

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

  const getStatusText = (status: string) => EXCHANGE_STATUS_LABEL[status as ExchangeStatus] || status;

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

  const getOtherParty = (exchange: Exchange) => {
    const proposal = exchange.contract?.proposal;
    if (!proposal) return null;
    return proposal.from_user_id === user?.id ? proposal.to_user : proposal.from_user;
  };


  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Connectez-vous pour voir vos échanges</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={[styles.contentWrapper, { marginTop: pageHeaderTotalHeight }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
        {FILTERS.map(({ id: status, label }) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              { backgroundColor: colors.surfaceContainer, borderRadius: radius.pill },
              filterStatus === status && { backgroundColor: colors.primary },
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: colors.textSecondary },
                filterStatus === status && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
        </ScrollView>

        {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : exchanges.length === 0 ? (
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
          contentContainerStyle={[
            styles.scrollContent,
            { 
              paddingTop: 12, // Espace après les filtres
              paddingBottom: 120 
            }
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.textSecondary}
              colors={[colors.primary]}
            />
          }
        >
          {exchanges.map((exchange) => {
            const otherParty = getOtherParty(exchange);
            const proposal = exchange.contract?.proposal;
            const listing = proposal?.listing;

            return (
              <TouchableOpacity
                key={exchange.id}
                style={[styles.exchangeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, shadows.card]}
                onPress={() =>
                  router.push({
                    pathname: '/exchange/[id]',
                    params: { id: exchange.id },
                  })
                }
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
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(exchange.status) + '22' }]}>
                    {getStatusIcon(exchange.status)}
                    <Text style={[styles.statusText, { color: getStatusColor(exchange.status) }]}>
                      {getStatusText(exchange.status).toUpperCase()}
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

                {exchange.dispute && (exchange.dispute.status === 'open' || exchange.dispute.status === 'in_review') && (
                  <View style={[styles.disputeBadge, { backgroundColor: colors.errorLight }]}>
                    <AlertCircle size={14} color={colors.error} />
                    <Text style={[styles.disputeText, { color: colors.error }]}>Litige en cours</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        )}
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
  contentWrapper: {
    flex: 1,
  },
  filterScroll: {
    maxHeight: 60,
    paddingVertical: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '700',
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

