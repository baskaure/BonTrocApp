import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase, Exchange, ExchangeStatus, errorMessage } from '@/lib/supabase';
import { EXCHANGE_SELECT } from '@/lib/queries';
import { checkContent, blockedMessage } from '@/lib/moderation';
import { DISPUTE_STATUS_LABEL, formatDateFr } from '@/lib/labels';
import { useStore } from '@/lib/store';
import { useActivityStore, exchangeSeenKey } from '@/lib/activity';
import { ArrowLeft, Clock, Package, Truck, CheckCircle, AlertCircle, FileText, Star, XCircle } from 'lucide-react-native';

const steps = [
  { id: 'not_started', label: 'Non démarré', icon: Clock },
  { id: 'in_progress', label: 'En cours', icon: Package },
  { id: 'delivered', label: 'Livré', icon: Truck },
  { id: 'confirmed', label: 'Confirmé', icon: CheckCircle },
];

export default function ExchangeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const { user } = useAuth();

  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const hasLoadedRef = useRef(false);
  const markSeen = useActivityStore((s) => s.markSeen);

  const loadExchange = useCallback(async (silent = false) => {
    if (!silent && !exchange) setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.from('exchanges').select(EXCHANGE_SELECT).eq('id', id).maybeSingle();
      if (error) throw error;

      const raw = data as unknown as (Exchange & { dispute?: unknown }) | null;
      const normalized: Exchange | null = raw
        ? {
            ...raw,
            dispute: Array.isArray(raw.dispute)
              ? (raw.dispute.find((d) => d.status === 'open' || d.status === 'in_review') ?? raw.dispute[0] ?? null)
              : (raw.dispute as Exchange['dispute']) ?? null,
          }
        : null;

      setExchange(normalized);

      if (user && normalized) {
        void markSeen(user.id, exchangeSeenKey(normalized), normalized.updated_at > normalized.created_at ? normalized.updated_at : normalized.created_at);

        if (normalized.status === 'confirmed') {
          const { data: existingReview } = await supabase
            .from('reviews')
            .select('id')
            .eq('exchange_id', normalized.id)
            .eq('reviewer_id', user.id)
            .maybeSingle();
          setHasReviewed(!!existingReview);
        } else {
          setHasReviewed(false);
        }
      }
    } catch (err) {
      console.error('Error loading exchange:', err);
      setError('Impossible de charger cet échange.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, markSeen]);

  useEffect(() => {
    if (id && !hasLoadedRef.current) {
      void loadExchange();
      hasLoadedRef.current = true;
    }
  }, [id, loadExchange]);

  // Recharger silencieusement quand on revient sur la page (après signature du contrat, avis…)
  useFocusEffect(
    useCallback(() => {
      if (id && hasLoadedRef.current) void loadExchange(true);
    }, [id, loadExchange])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadExchange(true);
  };

  const afterMutation = () => {
    if (!user) return;
    useStore.getState().invalidateExchanges(user.id);
    void useActivityStore.getState().refresh(user.id);
  };

  const proposal = exchange?.contract?.proposal;
  const isFrom = proposal?.from_user_id === user?.id;
  const contract = exchange?.contract;
  const currentStepIndex = steps.findIndex((s) => s.id === exchange?.status);
  const contractIsActive = contract?.status === 'active';
  const mySignature = isFrom ? contract?.accepted_by_from_at : contract?.accepted_by_to_at;
  const hasOpenDispute = !!exchange?.dispute && (exchange.dispute.status === 'open' || exchange.dispute.status === 'in_review');

  const canMarkAsInProgress = exchange?.status === 'not_started' && contractIsActive;
  const canMarkAsDelivered = exchange?.status === 'in_progress' && !hasOpenDispute;
  const canConfirm = exchange?.status === 'delivered' && !!exchange.delivered_by && exchange.delivered_by !== user?.id && !hasOpenDispute;
  const canCancel = exchange?.status === 'not_started' || exchange?.status === 'in_progress';
  const canOpenDispute = !!exchange && (exchange.status === 'delivered' || exchange.status === 'in_progress') && !hasOpenDispute;

  const timelineColors = {
    completedBg: colors.success,
    currentBg: colors.primary,
    idleBg: colors.border,
    label: colors.text,
    labelInactive: colors.textTertiary,
    date: colors.textSecondary,
  };

  /** Transition d'état : les règles (qui, quand) sont appliquées par le trigger serveur `guard_exchange_update`. */
  async function transition(next: ExchangeStatus, successMessage: string) {
    if (!exchange) return;
    setActionLoading(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase.from('exchanges').update({ status: next }).eq('id', exchange.id).select('id');
      if (updateError) throw updateError;
      if (!data || data.length === 0) throw new Error('Mise à jour refusée : l’échange a peut-être changé de statut.');
      afterMutation();
      await loadExchange(true);
      Alert.alert('Échange', successMessage);
    } catch (err) {
      setError(errorMessage(err, 'Mise à jour impossible'));
    } finally {
      setActionLoading(false);
    }
  }

  const handleStartExchange = () => void transition('in_progress', 'Échange démarré.');

  const handleMarkAsDelivered = () =>
    Alert.alert('Marquer votre part comme livrée ?', 'L’autre partie sera invitée à confirmer la réception.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui, c’est livré', onPress: () => void transition('delivered', 'Livraison déclarée.') },
    ]);

  const handleConfirmDelivery = () =>
    Alert.alert('Confirmer la réception ?', 'Cette action clôture l’échange. Vous pourrez ensuite laisser un avis.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: () => void transition('confirmed', 'Échange confirmé. Merci !') },
    ]);

  const handleCancel = () =>
    Alert.alert('Annuler cet échange ?', 'Le contrat sera annulé pour les deux parties.', [
      { text: 'Garder', style: 'cancel' },
      { text: 'Annuler l’échange', style: 'destructive', onPress: () => void transition('cancelled', 'Échange annulé.') },
    ]);

  async function handleOpenDispute() {
    if (!exchange || !user) return;
    const reason = disputeReason.trim();
    if (reason.length < 10) {
      setError('Décrivez le problème (10 caractères minimum).');
      return;
    }
    setDisputeLoading(true);
    setError('');
    try {
      const moderation = await checkContent(reason, user.id);
      if (moderation.hasBlock) {
        setError(blockedMessage(moderation, 'Le texte'));
        return;
      }
      const { error } = await supabase.from('disputes').insert({ exchange_id: exchange.id, opened_by: user.id, reason, status: 'open' });
      if (error) throw error;
      setShowDisputeForm(false);
      setDisputeReason('');
      afterMutation();
      await loadExchange(true);
      Alert.alert('Litige ouvert', 'Notre équipe va l’examiner.');
    } catch (err) {
      setError(errorMessage(err, 'Impossible d’ouvrir un litige'));
    } finally {
      setDisputeLoading(false);
    }
  }

  const otherParty = proposal ? (isFrom ? proposal.to_user : proposal.from_user) : null;

  if (loading && !exchange) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!exchange || !proposal || !contract) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Suivi de l’échange</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error || 'Échange introuvable'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusHint = (() => {
    if (exchange.status === 'cancelled') return 'Cet échange a été annulé. Aucune action n’est possible.';
    if (exchange.status === 'not_started') {
      return contractIsActive
        ? 'Le contrat est signé par les deux parties. Démarrez l’échange dès que vous commencez à honorer votre part.'
        : mySignature
          ? `Contrat signé de votre côté. En attente de la signature de ${otherParty?.display_name ?? 'l’autre partie'}.`
          : 'L’échange démarre une fois le contrat signé par les deux parties.';
    }
    if (exchange.status === 'in_progress') return 'Quand vous avez remis votre part, marquez l’échange comme livré. L’autre partie confirmera la réception.';
    if (exchange.status === 'delivered') {
      return exchange.delivered_by === user?.id
        ? 'Vous avez indiqué avoir livré votre part. En attente de confirmation par l’autre partie.'
        : `${otherParty?.display_name ?? 'L’autre partie'} indique avoir livré. Vérifiez, puis confirmez la réception si tout est conforme. En cas de problème, ouvrez un litige.`;
    }
    if (exchange.status === 'confirmed') return 'La réception a été confirmée. Pensez à laisser un avis sur votre partenaire.';
    return '';
  })();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Suivi de l’échange</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
            <AlertCircle size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.soft]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Échange avec</Text>
          <TouchableOpacity onPress={() => otherParty && router.push({ pathname: '/user/[id]', params: { id: otherParty.id } })} disabled={!otherParty}>
            <Text style={[styles.subtitle, { color: colors.primary }]}>{otherParty?.display_name || 'Utilisateur'}</Text>
          </TouchableOpacity>
          {proposal.listing?.title ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{proposal.listing.title}</Text> : null}
        </View>

        {/* Timeline */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.soft]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Statut</Text>
          {exchange.status === 'cancelled' ? (
            <View style={[styles.infoBox, { backgroundColor: colors.errorLight, borderColor: colors.error, marginTop: 8 }]}>
              <XCircle size={20} color={colors.error} />
              <Text style={[styles.infoText, { color: colors.error }]}>Échange annulé</Text>
            </View>
          ) : (
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
                      <Text style={[styles.timelineLabel, { color: timelineColors.labelInactive }, (isCompleted || isCurrent) && { color: timelineColors.label }]}>
                        {step.label}
                      </Text>
                      {step.id === 'delivered' && (isCurrent || isCompleted) && exchange.delivered_at && (
                        <Text style={[styles.timelineDate, { color: timelineColors.date }]}>Livré le {formatDateFr(exchange.delivered_at)}</Text>
                      )}
                      {step.id === 'confirmed' && isCurrent && exchange.confirmed_at && (
                        <Text style={[styles.timelineDate, { color: timelineColors.date }]}>Confirmé le {formatDateFr(exchange.confirmed_at)}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {!!statusHint && <Text style={[styles.hint, { color: colors.textSecondary }]}>{statusHint}</Text>}
        </View>

        {/* Due date */}
        {exchange.due_date && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.soft]}>
            <View style={[styles.dueDateBox, { backgroundColor: colors.primaryLight }]}>
              <Clock size={20} color={colors.primary} />
              <View>
                <Text style={[styles.dueDateLabel, { color: colors.primary }]}>Date limite</Text>
                <Text style={[styles.dueDateText, { color: colors.text }]}>
                  {formatDateFr(exchange.due_date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 10 }, shadows.soft]}>
          {exchange.status === 'not_started' && !contractIsActive && (
            <View style={[styles.warningBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
              <Text style={[styles.warningText, { color: colors.warning }]}>
                Le contrat doit être signé par les deux parties avant de démarrer l’échange.
              </Text>
            </View>
          )}

          {hasOpenDispute && (
            <View style={[styles.warningBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
              <Text style={[styles.warningText, { color: colors.warning }]}>Un litige est en cours : les étapes de l’échange sont suspendues jusqu’à sa résolution.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.contractButton, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/contract/[id]', params: { id: contract.id } })}
          >
            <FileText size={20} color={colors.primary} />
            <Text style={[styles.contractButtonText, { color: colors.primary }]}>
              {contract.status === 'awaiting_signatures' && !mySignature ? 'Signer le contrat' : 'Voir le contrat'}
            </Text>
          </TouchableOpacity>

          {canMarkAsInProgress && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={handleStartExchange} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionButtonText}>Démarrer l’échange</Text>}
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

          {canOpenDispute && (
            <>
              {!showDisputeForm ? (
                <TouchableOpacity style={[styles.disputeButton, { borderColor: colors.error }]} onPress={() => setShowDisputeForm(true)}>
                  <Text style={[styles.disputeButtonText, { color: colors.error }]}>Ouvrir un litige</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.disputeForm}>
                  <TextInput
                    style={[styles.disputeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    multiline
                    numberOfLines={4}
                    maxLength={3000}
                    placeholder="Expliquez le problème..."
                    placeholderTextColor={colors.textTertiary}
                    value={disputeReason}
                    onChangeText={setDisputeReason}
                  />
                  <View style={styles.disputeActions}>
                    <TouchableOpacity
                      style={[styles.disputeCancelButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
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
                      {disputeLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.disputeSubmitText}>Envoyer</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {canCancel && (
            <TouchableOpacity style={[styles.disputeButton, { borderColor: colors.border }]} onPress={handleCancel} disabled={actionLoading}>
              <Text style={[styles.disputeButtonText, { color: colors.textSecondary }]}>Annuler l’échange</Text>
            </TouchableOpacity>
          )}

          {/* Bouton pour laisser un avis quand l'échange est confirmé */}
          {exchange.status === 'confirmed' && !hasReviewed && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.secondary }]}
              onPress={() => router.push({ pathname: '/review/[exchangeId]', params: { exchangeId: exchange.id } })}
            >
              <Star size={20} color={colors.onSecondary} />
              <Text style={[styles.actionButtonText, { color: colors.onSecondary }]}>Laisser un avis</Text>
            </TouchableOpacity>
          )}

          {exchange.status === 'confirmed' && hasReviewed && (
            <View style={[styles.infoBox, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
              <CheckCircle size={20} color={colors.success} />
              <Text style={[styles.infoText, { color: colors.success }]}>Vous avez déjà laissé un avis pour cet échange</Text>
            </View>
          )}

          {exchange.dispute && (
            <View style={[styles.disputeInfo, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
              <AlertCircle size={20} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.disputeInfoTitle, { color: colors.error }]}>{DISPUTE_STATUS_LABEL[exchange.dispute.status]}</Text>
                <Text style={[styles.disputeInfoText, { color: colors.text }]}>{exchange.dispute.reason}</Text>
                {exchange.dispute.resolution ? (
                  <Text style={[styles.disputeInfoText, { color: colors.textSecondary }]}>Décision : {exchange.dispute.resolution}</Text>
                ) : null}
              </View>
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
    flex: 1,
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
    paddingBottom: 32,
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
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
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
  },
  warningText: {
    fontSize: 14,
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
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
