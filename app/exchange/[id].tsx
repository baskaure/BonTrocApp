import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Clock, Package, Truck, CheckCircle, AlertCircle, FileText, Star } from 'lucide-react-native';

type ExchangeDetail = any;

const steps = [
  { id: 'not_started', label: 'Non démarré', icon: Clock },
  { id: 'in_progress', label: 'En cours', icon: Package },
  { id: 'delivered', label: 'Livré', icon: Truck },
  { id: 'confirmed', label: 'Confirmé', icon: CheckCircle },
];

export default function ExchangeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [exchange, setExchange] = useState<ExchangeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadExchange = useCallback(async (silent = false) => {
    // Ne pas afficher le loader si on a déjà des données (évite le flash)
    if (!silent && !exchange) {
      setLoading(true);
    }
    setError('');
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
        .eq('id', id)
        .single();

      if (error) throw error;

      const normalized = data
        ? {
            ...data,
            dispute: Array.isArray(data.dispute) ? data.dispute[0] : data.dispute,
          }
        : null;

      setExchange(normalized);

      // marquer notifications comme lues
      if (user && data) {
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('type', 'exchange_update')
          .eq('related_id', data.id)
          .is('read_at', null);

        // Vérifier si l'utilisateur a déjà laissé un avis pour cet échange
        if (data.status === 'confirmed') {
          const { data: existingReview } = await supabase
            .from('reviews')
            .select('id')
            .eq('exchange_id', data.id)
            .eq('reviewer_id', user.id)
            .single();

          setHasReviewed(!!existingReview);
        } else {
          setHasReviewed(false);
        }
      }
    } catch (err: any) {
      console.error('Error loading exchange:', err);
      setError('Impossible de charger cet échange.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (id && !hasLoadedRef.current) {
      loadExchange();
      hasLoadedRef.current = true;
    }
  }, [id, loadExchange]);

  // Recharger silencieusement quand on revient sur la page
  useFocusEffect(
    useCallback(() => {
      if (id && hasLoadedRef.current) {
        // Recharger silencieusement si on a déjà chargé une fois
        loadExchange(true);
      }
    }, [id, loadExchange])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadExchange(true);
  };

  const proposal = exchange?.contract?.proposal;
  const isFromUser = proposal?.from_user_id === user?.id;
  const currentStepIndex = steps.findIndex((s) => s.id === exchange?.status);
  const contractIsActive = exchange?.contract?.status === 'active';

  const canMarkAsInProgress = exchange?.status === 'not_started' && contractIsActive;
  const canMarkAsDelivered = exchange?.status === 'in_progress';
  const canConfirm = exchange?.status === 'delivered' && exchange?.delivered_by !== user?.id;
  const canOpenDispute = exchange && (exchange.status === 'delivered' || exchange.status === 'in_progress');

  const timelineColors = {
    completedBg: colors.success,
    currentBg: colors.primary,
    idleBg: colors.border,
    label: colors.text,
    labelInactive: colors.textTertiary,
    date: colors.textSecondary,
  };

  async function createExchangeUpdateNotification(status: string) {
    if (!user || !exchange?.contract?.proposal) return;
    try {
      const proposal = exchange.contract.proposal;
      const otherUserId = proposal.from_user_id === user.id ? proposal.to_user_id : proposal.from_user_id;
      const statusMessages: Record<string, string> = {
        in_progress: "L'échange a démarré",
        delivered: 'Votre échange a été marqué comme livré',
        confirmed: 'Votre échange a été confirmé',
      };
      await supabase.from('notifications').insert({
        user_id: otherUserId,
        type: 'exchange_update',
        message: statusMessages[status] || "Mise à jour de votre échange",
        related_id: exchange.id,
      });
    } catch (err) {
      console.error('Notification exchange error', err);
    }
  }

  async function handleStartExchange() {
    if (!exchange || !contractIsActive) {
      setError("Le contrat doit être signé par les deux parties avant de démarrer l'échange.");
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const { error } = await supabase.from('exchanges').update({ status: 'in_progress' }).eq('id', exchange.id);
      if (error) throw error;
      await createExchangeUpdateNotification('in_progress');
      await loadExchange();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du démarrage');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkAsDelivered() {
    if (!exchange || !user?.id) {
      setError('Session expirée');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('exchanges')
        .update({ status: 'delivered', delivered_at: new Date().toISOString(), delivered_by: user.id })
        .eq('id', exchange.id);
      if (error) throw error;
      await createExchangeUpdateNotification('delivered');
      await loadExchange();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la livraison');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!exchange || !user?.id) {
      setError('Session expirée');
      return;
    }
    if (exchange.delivered_by === user.id) {
      setError('Vous ne pouvez pas confirmer votre propre livraison');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('exchanges')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', exchange.id);
      if (error) throw error;
      await createExchangeUpdateNotification('confirmed');
      await loadExchange();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la confirmation');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOpenDispute() {
    if (!exchange || !disputeReason.trim() || !user) return;
    setDisputeLoading(true);
    setError('');
    try {
      const { error } = await supabase.from('disputes').insert({
        exchange_id: exchange.id,
        opened_by: user.id,
        reason: disputeReason,
        status: 'open',
      });
      if (error) throw error;
      setShowDisputeForm(false);
      setDisputeReason('');
      await loadExchange();
    } catch (err: any) {
      setError(err.message || 'Impossible d’ouvrir un litige');
    } finally {
      setDisputeLoading(false);
    }
  }

  const otherParty = proposal
    ? proposal.from_user_id === user?.id
      ? proposal.to_user
      : proposal.from_user
    : null;

  // Ne pas afficher le loader si on a déjà des données (évite le flash)
  if (loading && !exchange) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!exchange || !proposal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Échange introuvable</Text>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Suivi de l'échange</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
            <AlertCircle size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Échange avec</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{otherParty?.display_name || 'Utilisateur'}</Text>
        </View>

        {/* Timeline */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Statut</Text>
          <View style={styles.timeline}>
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              return (
                <View key={step.id} style={styles.timelineStep}>
                  <View
                    style={[
                      styles.timelineIcon,
                      { backgroundColor: timelineColors.idleBg },
                      isCompleted && { backgroundColor: timelineColors.completedBg },
                      isCurrent && { backgroundColor: timelineColors.currentBg },
                    ]}
                  >
                    <Icon size={20} color={isCompleted || isCurrent ? '#FFF' : colors.textTertiary} />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        { color: timelineColors.labelInactive },
                        (isCompleted || isCurrent) && { color: timelineColors.label },
                      ]}
                    >
                      {step.label}
                    </Text>
                    {step.id === 'delivered' && isCurrent && exchange.delivered_at && (
                      <Text style={[styles.timelineDate, { color: timelineColors.date }]}>
                        Livré le {new Date(exchange.delivered_at).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                    {step.id === 'confirmed' && isCompleted && exchange.confirmed_at && (
                      <Text style={[styles.timelineDate, { color: timelineColors.date }]}>
                        Confirmé le {new Date(exchange.confirmed_at).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Due date */}
        {exchange.due_date && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.dueDateBox, { backgroundColor: colors.primaryLight }]}>
              <Clock size={20} color={colors.primary} />
              <View>
                <Text style={[styles.dueDateLabel, { color: colors.primary }]}>Date limite</Text>
                <Text style={[styles.dueDateText, { color: colors.text }]}>
                  {new Date(exchange.due_date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {exchange.status === 'not_started' && !contractIsActive && (
            <View
              style={[
                styles.warningBox,
                { backgroundColor: colors.warningLight, borderColor: colors.warning },
              ]}
            >
              <Text style={[styles.warningText, { color: colors.warning }]}>
                Le contrat doit être signé par les deux parties avant de démarrer l'échange.
              </Text>
            </View>
          )}

          {canMarkAsInProgress && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={handleStartExchange} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionButtonText}>Démarrer l'échange</Text>}
            </TouchableOpacity>
          )}

          {canMarkAsDelivered && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.success }]} onPress={handleMarkAsDelivered} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionButtonText}>Marquer comme livré</Text>}
            </TouchableOpacity>
          )}

          {canConfirm && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.success }]} onPress={handleConfirmDelivery} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionButtonText}>Confirmer la réception</Text>}
            </TouchableOpacity>
          )}

          {canOpenDispute && !exchange.dispute && (
            <>
              {!showDisputeForm ? (
                <TouchableOpacity style={[styles.disputeButton, { borderColor: colors.error }]} onPress={() => setShowDisputeForm(true)}>
                  <Text style={[styles.disputeButtonText, { color: colors.error }]}>Ouvrir un litige</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.disputeForm}>
                  <TextInput
                    style={[
                      styles.disputeInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    multiline
                    numberOfLines={4}
                    placeholder="Expliquez le problème..."
                    placeholderTextColor={colors.textTertiary}
                    value={disputeReason}
                    onChangeText={setDisputeReason}
                  />
                  <View style={styles.disputeActions}>
                    <TouchableOpacity
                      style={[
                        styles.disputeCancelButton,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                      ]}
                      onPress={() => {
                        setShowDisputeForm(false);
                        setDisputeReason('');
                      }}
                    >
                      <Text style={[styles.disputeCancelText, { color: colors.text }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.disputeSubmitButton, { backgroundColor: colors.error }]}
                      onPress={handleOpenDispute}
                      disabled={disputeLoading || !disputeReason.trim()}
                    >
                      {disputeLoading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.disputeSubmitText}>Envoyer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {exchange.contract && (
            <TouchableOpacity
              style={[
                styles.contractButton,
                { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              onPress={() => router.push(`/contract/${exchange.contract.id}`)}
            >
              <FileText size={20} color={colors.primary} />
              <Text style={[styles.contractButtonText, { color: colors.primary }]}>Voir et signer le contrat</Text>
            </TouchableOpacity>
          )}

          {/* Bouton pour laisser un avis quand l'échange est confirmé */}
          {exchange.status === 'confirmed' && !hasReviewed && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.secondary }]}
              onPress={() => {
                // @ts-ignore - Route dynamique
                router.push(`/review/${exchange.id}`);
              }}
            >
              <Star size={20} color="#FFF" />
              <Text style={styles.actionButtonText}>Laisser un avis</Text>
            </TouchableOpacity>
          )}

          {exchange.status === 'confirmed' && hasReviewed && (
            <View style={[styles.infoBox, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
              <CheckCircle size={20} color={colors.success} />
              <Text style={[styles.infoText, { color: colors.success }]}>
                Vous avez déjà laissé un avis pour cet échange
              </Text>
            </View>
          )}

          {exchange.dispute && (
            <View
              style={[
                styles.disputeInfo,
                { backgroundColor: colors.errorLight, borderColor: colors.error },
              ]}
            >
              <AlertCircle size={20} color={colors.error} />
              <View>
                <Text style={[styles.disputeInfoTitle, { color: colors.error }]}>
                  Litige {exchange.dispute.status === 'resolved' ? 'résolu' : 'en cours'}
                </Text>
                <Text style={[styles.disputeInfoText, { color: colors.text }]}>{exchange.dispute.reason}</Text>
              </View>
            </View>
          )}
        </View>
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
  emptyText: {
    fontSize: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  timeline: {
    marginTop: 12,
    gap: 16,
  },
  timelineStep: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContent: {
    flex: 1,
    justifyContent: 'center',
  },
  timelineLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  timelineDate: {
    fontSize: 12,
    marginTop: 4,
  },
  dueDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  dueDateLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  dueDateText: {
    fontSize: 14,
  },
  warningBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disputeButton: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  disputeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disputeForm: {
    gap: 10,
  },
  disputeInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  disputeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  disputeCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  disputeCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disputeSubmitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  disputeSubmitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  contractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  contractButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  disputeInfo: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  disputeInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  disputeInfoText: {
    fontSize: 14,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});


