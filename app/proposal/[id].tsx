import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth-context';
import { supabase, Proposal, errorMessage } from '@/lib/supabase';
import { PROPOSAL_SELECT } from '@/lib/queries';
import { sendTransactionalEmail } from '@/lib/notifications';
import { checkContent, blockedMessage } from '@/lib/moderation';
import { PROPOSAL_STATUS_LABEL } from '@/lib/labels';
import { useStore } from '@/lib/store';
import { useActivityStore, proposalSeenKey } from '@/lib/activity';
import { ArrowLeft, MessageCircle, CheckCircle, XCircle, Send, Lightbulb, FileText, ArrowLeftRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { ChatWindow } from '@/components/ChatWindow';
import { FormInput } from '@/components/ui/FormInput';
import { counterProposalSchema, CounterProposalFormData } from '@/lib/validations/proposal';

/** Lit le message d'erreur renvoyé par une Edge Function (corps JSON `{ error }`), sinon un repli. */
async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } } | null)?.context;
  try {
    const body = await ctx?.json?.();
    if (body?.error) return body.error;
  } catch {
    /* corps non JSON */
  }
  return fallback;
}

export default function ProposalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { colors, radius, shadows } = useTheme();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [exchangeId, setExchangeId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const markSeen = useActivityStore((s) => s.markSeen);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CounterProposalFormData>({
    resolver: zodResolver(counterProposalSchema),
    defaultValues: { counterOffer: '', counterMessage: '' },
  });

  const loadProposal = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('proposals').select(PROPOSAL_SELECT).eq('id', id).maybeSingle();
      if (error) throw error;
      const next = (data as unknown as Proposal) ?? null;
      setProposal(next);

      if (next && user) {
        void markSeen(user.id, proposalSeenKey(next), next.updated_at > next.created_at ? next.updated_at : next.created_at);
      }

      // Proposition acceptée : on retrouve le contrat et l'échange créés par le serveur.
      if (next?.status === 'accepted') {
        const { data: contract } = await supabase
          .from('contracts')
          .select('id, exchange:exchanges(id)')
          .eq('proposal_id', next.id)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        const ex = contract?.exchange as unknown as { id: string }[] | { id: string } | null;
        setContractId(contract?.id ?? null);
        setExchangeId(Array.isArray(ex) ? (ex[0]?.id ?? null) : (ex?.id ?? null));
      } else {
        setContractId(null);
        setExchangeId(null);
      }
    } catch (err) {
      console.error('Error loading proposal:', err);
      setError('Impossible de charger cette proposition.');
    } finally {
      setLoading(false);
    }
  }, [id, user, markSeen]);

  useEffect(() => {
    if (id) void loadProposal();
  }, [id, loadProposal]);

  useFocusEffect(
    useCallback(() => {
      if (id && proposal) void loadProposal(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const afterMutation = () => {
    if (!user) return;
    useStore.getState().invalidateProposals(user.id);
    useStore.getState().invalidateExchanges(user.id);
    void useActivityStore.getState().refresh(user.id);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!proposal || !user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Retour</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error || 'Proposition non trouvée'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isReceiver = proposal.to_user_id === user.id;
  const isSender = proposal.from_user_id === user.id;
  const otherUser = isReceiver ? proposal.from_user : proposal.to_user;
  const otherInactive = otherUser?.status === 'deleted';
  const listingUnavailable = !!proposal.listing && proposal.listing.status !== 'published';

  const handleAccept = () => {
    Alert.alert(
      'Accepter la proposition',
      'Un contrat d’échange sera généré et devra être signé par les deux parties.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            setActionError('');
            setActionLoading(true);
            try {
              // L'acceptation est atomique côté serveur : contrat + échange + statut + e-mails.
              const { data, error: fnError } = await supabase.functions.invoke('accept-proposal', { body: { proposal_id: proposal.id } });
              if (fnError) throw new Error(await functionErrorMessage(fnError, 'Acceptation impossible pour le moment'));
              if (data?.error) throw new Error(String(data.error));

              afterMutation();
              await loadProposal(true);
              const newContractId = typeof data?.contract_id === 'string' ? data.contract_id : null;
              Alert.alert('Proposition acceptée', 'Le contrat est prêt : signez-le pour lancer l’échange.', [
                { text: 'Plus tard', style: 'cancel' },
                { text: 'Signer le contrat', onPress: () => newContractId && router.push({ pathname: '/contract/[id]', params: { id: newContractId } }) },
              ]);
            } catch (err) {
              const message = errorMessage(err, 'Erreur lors de l’acceptation');
              setActionError(message);
              Alert.alert('Erreur', message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const setStatus = async (status: 'refused' | 'cancelled', from: Proposal['status'][], successTitle: string, successText: string) => {
    setActionLoading(true);
    setActionError('');
    try {
      // RLS et triggers peuvent refuser sans erreur (0 ligne) : on vérifie le retour.
      const { data, error } = await supabase.from('proposals').update({ status, updated_at: new Date().toISOString() }).eq('id', proposal.id).in('status', from).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Mise à jour refusée : la proposition a peut-être changé de statut.');
      afterMutation();
      await loadProposal(true);
      Alert.alert(successTitle, successText);
    } catch (err) {
      const message = errorMessage(err);
      setActionError(message);
      Alert.alert('Erreur', message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefuse = () => {
    Alert.alert('Refuser la proposition', 'Êtes-vous sûr de vouloir refuser cette proposition ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: () => void setStatus('refused', ['pending'], 'Proposition refusée', 'La proposition a été refusée.') },
    ]);
  };

  const handleCancel = () => {
    Alert.alert('Retirer la proposition', 'Votre proposition sera annulée. Vous pourrez en faire une nouvelle plus tard.', [
      { text: 'Garder', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => void setStatus('cancelled', ['pending', 'countered'], 'Proposition retirée', 'Votre proposition a été annulée.') },
    ]);
  };

  const handleCounter = async (data: CounterProposalFormData) => {
    if (!otherUser) return;
    setActionLoading(true);
    setActionError('');
    try {
      const offer = data.counterOffer.trim();
      const message = (data.counterMessage ?? '').trim();
      const moderation = await checkContent(`${offer}\n${message}`, user.id);
      if (moderation.hasBlock) {
        setActionError(blockedMessage(moderation, 'Le texte'));
        return;
      }

      const { data: created, error } = await supabase
        .from('proposals')
        .insert({
          listing_id: proposal.listing_id,
          from_user_id: user.id,
          to_user_id: otherUser.id,
          message,
          offer_payload: { description: offer },
          status: 'pending',
          parent_proposal_id: proposal.id,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: updErr } = await supabase.from('proposals').update({ status: 'countered', updated_at: new Date().toISOString() }).eq('id', proposal.id).eq('status', 'pending');
      if (updErr) console.warn('Statut de la proposition parente non mis à jour :', updErr.message);

      void sendTransactionalEmail('counter_proposal', otherUser.id, {
        listing_title: proposal.listing?.title ?? 'votre annonce',
        counter_proposer_name: user.display_name,
        proposal_id: created.id,
      });

      setShowCounterForm(false);
      reset({ counterOffer: '', counterMessage: '' });
      afterMutation();
      Alert.alert('Contre-proposition envoyée', 'Votre interlocuteur va pouvoir y répondre.', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/proposal/[id]', params: { id: created.id } }) },
      ]);
    } catch (err) {
      const message = errorMessage(err, 'Erreur lors de la contre-proposition');
      setActionError(message);
      Alert.alert('Erreur', message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusConfig = () => {
    const label = PROPOSAL_STATUS_LABEL[proposal.status];
    switch (proposal.status) {
      case 'accepted':
        return { label, color: colors.success, bgColor: colors.successLight };
      case 'refused':
      case 'cancelled':
        return { label, color: colors.error, bgColor: colors.errorLight };
      case 'countered':
        return { label, color: colors.warning, bgColor: colors.warningLight };
      default:
        return { label, color: colors.warning, bgColor: colors.warningLight };
    }
  };

  const statusConfig = getStatusConfig();
  const canAct = proposal.status === 'pending' && isReceiver && !showCounterForm && !otherInactive && !listingUnavailable;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {proposal.listing?.title || 'Proposition'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
              <View style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, shadows.card]}>
                {/* Informations utilisateur */}
                <View style={styles.userSection}>
                  <TouchableOpacity
                    style={styles.userInfo}
                    onPress={() => otherUser && !otherInactive && router.push({ pathname: '/user/[id]', params: { id: otherUser.id } })}
                    disabled={!otherUser || otherInactive}
                  >
                    {otherUser?.avatar_url ? (
                      <Image source={{ uri: otherUser.avatar_url }} style={[styles.avatar, { borderColor: colors.surface }]} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                        <Text style={styles.avatarText}>{otherUser?.display_name?.[0]?.toUpperCase() || '?'}</Text>
                      </View>
                    )}
                    <View style={styles.userDetails}>
                      <Text style={[styles.userName, { color: colors.text }]}>{otherUser?.display_name || 'Utilisateur'}</Text>
                      <Text style={[styles.userMeta, { color: colors.textSecondary }]}>
                        {isReceiver ? 'Vous a fait une proposition' : 'Vous avez fait une proposition'}
                        {proposal.parent_proposal_id ? ' (contre-proposition)' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                    {new Date(proposal.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {/* Offre proposée */}
                {proposal.offer_payload?.description && (
                  <View style={[styles.offerSection, { borderTopColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                      <Lightbulb size={16} color={colors.warning} fill={colors.warning} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Ce qui est proposé</Text>
                    </View>
                    <View style={[styles.offerBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                      <Text style={[styles.offerText, { color: colors.text }]}>{proposal.offer_payload.description}</Text>
                    </View>
                  </View>
                )}

                {/* Message de la proposition */}
                {!!proposal.message && (
                  <View style={[styles.messageSection, { borderTopColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                      <FileText size={16} color={colors.primary} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Message</Text>
                    </View>
                    <Text style={[styles.messageText, { color: colors.text }]}>{proposal.message}</Text>
                  </View>
                )}

                {(otherInactive || listingUnavailable) && proposal.status === 'pending' && (
                  <View style={[styles.actionsSection, { borderTopColor: colors.border }]}>
                    <View style={[styles.errorBox, { backgroundColor: colors.warningLight }]}>
                      <Text style={[styles.errorText, { color: colors.warning }]}>
                        {otherInactive ? 'Le compte de votre interlocuteur n’est plus actif.' : 'Cette annonce n’est plus disponible : elle a été retirée ou déjà échangée.'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Actions du destinataire */}
                {canAct && (
                  <View style={[styles.actionsSection, { borderTopColor: colors.border }]}>
                    {!!actionError && (
                      <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
                        <Text style={[styles.errorText, { color: colors.error }]}>{actionError}</Text>
                      </View>
                    )}
                    <View style={styles.actionButtons}>
                      <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.success }]} onPress={handleAccept} disabled={actionLoading}>
                        {actionLoading ? <ActivityIndicator color="#FFF" size="small" /> : (
                          <>
                            <CheckCircle size={18} color="#FFF" />
                            <Text style={styles.actionButtonText}>Accepter</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.warning }]} onPress={() => setShowCounterForm(true)} disabled={actionLoading}>
                        <Send size={18} color="#FFF" />
                        <Text style={styles.actionButtonText}>Contre-proposer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.error }]} onPress={handleRefuse} disabled={actionLoading}>
                        <XCircle size={18} color="#FFF" />
                        <Text style={styles.actionButtonText}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Action de l'expéditeur : retirer sa proposition */}
                {isSender && (proposal.status === 'pending' || proposal.status === 'countered') && (
                  <View style={[styles.actionsSection, { borderTopColor: colors.border }]}>
                    {!!actionError && (
                      <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
                        <Text style={[styles.errorText, { color: colors.error }]}>{actionError}</Text>
                      </View>
                    )}
                    <Text style={[styles.userMeta, { color: colors.textSecondary, marginBottom: 10 }]}>
                      {proposal.status === 'countered' ? 'Vous avez reçu une contre-proposition : consultez-la dans vos propositions.' : 'En attente de réponse.'}
                    </Text>
                    <TouchableOpacity style={[styles.counterActionButton, { backgroundColor: colors.surface, borderColor: colors.error }]} onPress={handleCancel} disabled={actionLoading}>
                      {actionLoading ? <ActivityIndicator color={colors.error} size="small" /> : <Text style={[styles.counterActionText, { color: colors.error }]}>Retirer ma proposition</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Proposition acceptée : accès au contrat et au suivi */}
                {proposal.status === 'accepted' && (
                  <View style={[styles.actionsSection, { borderTopColor: colors.border }]}>
                    <View style={styles.actionButtons}>
                      {contractId && (
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => router.push({ pathname: '/contract/[id]', params: { id: contractId } })}>
                          <FileText size={18} color="#FFF" />
                          <Text style={styles.actionButtonText}>Voir / signer le contrat</Text>
                        </TouchableOpacity>
                      )}
                      {exchangeId && (
                        <TouchableOpacity style={[styles.counterActionButton, { backgroundColor: colors.surface, borderColor: colors.primary }]} onPress={() => router.push({ pathname: '/exchange/[id]', params: { id: exchangeId } })}>
                          <ArrowLeftRight size={16} color={colors.primary} />
                          <Text style={[styles.counterActionText, { color: colors.primary }]}>Suivre l’échange</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Formulaire de contre-proposition */}
                {showCounterForm && (
                  <View style={[styles.counterForm, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                    <View style={styles.sectionHeader}>
                      <Send size={16} color={colors.primary} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Créer une contre-proposition</Text>
                    </View>
                    <FormInput
                      control={control}
                      name="counterOffer"
                      label="Ce que vous proposez *"
                      error={errors.counterOffer}
                      inputProps={{
                        multiline: true,
                        numberOfLines: 3,
                        placeholder: 'Décrivez ce que vous proposez en échange...',
                        returnKeyType: 'next',
                        style: { minHeight: 80, textAlignVertical: 'top' },
                      }}
                    />
                    <FormInput
                      control={control}
                      name="counterMessage"
                      label="Message (facultatif)"
                      error={errors.counterMessage}
                      inputProps={{
                        multiline: true,
                        numberOfLines: 2,
                        placeholder: 'Ajoutez un message pour accompagner votre contre-proposition...',
                        returnKeyType: 'done',
                        onSubmitEditing: () => Keyboard.dismiss(),
                        style: { minHeight: 80, textAlignVertical: 'top' },
                      }}
                    />
                    {!!actionError && (
                      <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
                        <Text style={[styles.errorText, { color: colors.error }]}>{actionError}</Text>
                      </View>
                    )}
                    <View style={styles.counterActions}>
                      <TouchableOpacity
                        style={[styles.counterActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => {
                          setShowCounterForm(false);
                          reset({ counterOffer: '', counterMessage: '' });
                          setActionError('');
                        }}
                      >
                        <Text style={[styles.counterActionText, { color: colors.text }]}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.counterActionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={handleSubmit(handleCounter)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <ActivityIndicator color="#FFF" size="small" /> : (
                          <>
                            <Send size={16} color="#FFF" />
                            <Text style={styles.counterActionTextPrimary}>Envoyer</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Section Discussion */}
              <View style={[styles.chatSection, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, shadows.card]}>
                <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
                  <MessageCircle size={20} color={colors.primary} />
                  <Text style={[styles.chatHeaderText, { color: colors.text }]}>Discussion</Text>
                </View>
                <View style={styles.chatContainer}>
                  <ChatWindow
                    proposalId={proposal.id}
                    counterpart={otherUser ?? null}
                    disabled={otherInactive}
                    onUserClick={(userId) => router.push({ pathname: '/user/[id]', params: { id: userId } })}
                  />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  proposalCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  userSection: {
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 24,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userMeta: {
    fontSize: 13,
  },
  dateText: {
    fontSize: 12,
    marginLeft: 68,
  },
  messageSection: {
    padding: 16,
    borderTopWidth: 1,
  },
  offerSection: {
    padding: 16,
    borderTopWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  offerBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  offerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionsSection: {
    padding: 16,
    borderTopWidth: 1,
  },
  actionButtons: {
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  counterForm: {
    padding: 16,
    borderTopWidth: 1,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
  },
  counterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  counterActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  counterActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  counterActionTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  chatSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 400,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
  },
  chatHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  chatContainer: {
    minHeight: 300,
  },
  emptyText: {
    fontSize: 16,
  },
});
