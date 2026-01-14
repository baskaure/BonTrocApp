import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase, Proposal } from '@/lib/supabase';
import { ArrowLeft, MessageCircle, CheckCircle, XCircle, Send, Lightbulb, User, Clock, FileText } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { BottomNav } from '@/components/BottomNav';
import { ChatWindow } from '@/components/ChatWindow';

export default function ProposalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterMessage, setCounterMessage] = useState('');
  const [counterOffer, setCounterOffer] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (id) {
      loadProposal();
    }
  }, [id]);

  async function loadProposal() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('proposals')
        .select(`
          *,
          from_user:users!proposals_from_user_id_fkey(*),
          to_user:users!proposals_to_user_id_fkey(*),
          listing:listings(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setProposal(data);

      // Marquer les notifications liées à cette proposition comme lues
      if (data && user) {
        try {
          const { data: updated, error: updateError } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('related_id', data.id)
            .in('type', ['proposal_received', 'message_received'])
            .is('read_at', null)
            .select();
          
          if (updateError && updateError.code !== 'PGRST205') {
            console.error('Error marking notifications as read:', updateError);
          } else if (updated && updated.length > 0) {
            console.log(`Marked ${updated.length} notifications as read for proposal ${data.id}`);
          }
        } catch (err: any) {
          if (err?.code !== 'PGRST205') {
            console.error('Error in mark as read:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error loading proposal:', error);
      setError('Impossible de charger cette proposition.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  if (!proposal) {
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
        <BottomNav />
      </SafeAreaView>
    );
  }

  const isReceiver = proposal.to_user_id === user?.id;
  const otherUser = isReceiver ? proposal.from_user : proposal.to_user;

  const handleAccept = async () => {
    Alert.alert(
      'Accepter la proposition',
      'Êtes-vous sûr de vouloir accepter cette proposition ? Un contrat sera généré.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          style: 'default',
          onPress: async () => {
            setActionError('');
            setActionLoading(true);
            try {
              const { error: updateError } = await supabase
                .from('proposals')
                .update({ status: 'accepted' })
                .eq('id', proposal.id);

              if (updateError) throw updateError;

              // Créer une notification
              if (proposal.from_user_id !== user?.id) {
                try {
                  await supabase.from('notifications').insert({
                    user_id: proposal.from_user_id,
                    type: 'proposal_accepted',
                    message: `${proposal.to_user?.display_name || 'Un utilisateur'} a accepté votre proposition`,
                    related_id: proposal.id,
                  });
                } catch (err) {
                  console.error('Error creating notification:', err);
                }
              }

              // Générer le contrat
              try {
                await supabase.functions.invoke('generate-contract-pdf', {
                  body: { proposal_id: proposal.id },
                });
              } catch (contractError) {
                console.error('Error generating contract:', contractError);
              }

              Alert.alert('Succès', 'Proposition acceptée ! Le contrat a été généré.');
              await loadProposal();
            } catch (err: any) {
              setActionError(err.message || 'Erreur lors de l\'acceptation');
              Alert.alert('Erreur', err.message || 'Erreur lors de l\'acceptation');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRefuse = async () => {
    Alert.alert(
      'Refuser la proposition',
      'Êtes-vous sûr de vouloir refuser cette proposition ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await supabase
                .from('proposals')
                .update({ status: 'refused' })
                .eq('id', proposal.id);

              if (error) throw error;
              await loadProposal();
              Alert.alert('Proposition refusée', 'La proposition a été refusée.');
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Erreur lors du refus');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCounter = async () => {
    if (!counterOffer.trim() || !counterMessage.trim()) {
      setActionError('Veuillez remplir tous les champs');
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      const { error } = await supabase.from('proposals').insert({
        listing_id: proposal.listing_id,
        from_user_id: user!.id,
        to_user_id: otherUser!.id,
        message: counterMessage,
        offer_payload: { description: counterOffer },
        status: 'pending',
        parent_proposal_id: proposal.id,
      });

      if (error) throw error;

      await supabase
        .from('proposals')
        .update({ status: 'countered' })
        .eq('id', proposal.id);

      setShowCounterForm(false);
      setCounterMessage('');
      setCounterOffer('');
      await loadProposal();
      Alert.alert('Succès', 'Contre-proposition envoyée !');
    } catch (error: any) {
      setActionError(error.message || 'Erreur lors de la contre-proposition');
      Alert.alert('Erreur', error.message || 'Erreur lors de la contre-proposition');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusConfig = () => {
    switch (proposal.status) {
      case 'accepted':
        return { label: 'Acceptée', color: colors.success, bgColor: colors.successLight };
      case 'refused':
        return { label: 'Refusée', color: colors.error, bgColor: colors.errorLight };
      case 'countered':
        return { label: 'Contre-proposition', color: colors.warning, bgColor: colors.warningLight };
      default:
        return { label: 'En attente', color: colors.warning, bgColor: colors.warningLight };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header amélioré */}
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
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
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
            <>
              {/* Carte de proposition améliorée */}
              <View style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Informations utilisateur */}
                <View style={styles.userSection}>
                  <View style={styles.userInfo}>
                    {otherUser?.avatar_url ? (
                      <Image
                        source={{ uri: otherUser.avatar_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                        <Text style={styles.avatarText}>
                          {otherUser?.display_name?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.userDetails}>
                      <Text style={[styles.userName, { color: colors.text }]}>
                        {otherUser?.display_name || 'Utilisateur'}
                      </Text>
                      <Text style={[styles.userMeta, { color: colors.textSecondary }]}>
                        {isReceiver ? 'Vous a fait une proposition' : 'Vous avez fait une proposition'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                    {new Date(proposal.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>

                {/* Message de la proposition */}
                <View style={[styles.messageSection, { borderTopColor: colors.border }]}>
                  <View style={styles.sectionHeader}>
                    <FileText size={16} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Message</Text>
                  </View>
                  <Text style={[styles.messageText, { color: colors.text }]}>
                    {proposal.message}
                  </Text>
                </View>

                {/* Offre proposée */}
                {proposal.offer_payload?.description && (
                  <View style={[styles.offerSection, { borderTopColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                      <Lightbulb size={16} color={colors.warning} fill={colors.warning} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Ce qui est proposé</Text>
                    </View>
                    <View style={[styles.offerBox, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.offerText, { color: colors.text }]}>
                        {proposal.offer_payload.description}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Boutons d'action - seulement si on est le receveur et que c'est en attente */}
                {proposal.status === 'pending' && isReceiver && !showCounterForm && (
                  <View style={[styles.actionsSection, { borderTopColor: colors.border }]}>
                    {actionError && (
                      <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
                        <Text style={[styles.errorText, { color: colors.error }]}>{actionError}</Text>
                      </View>
                    )}
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton, { backgroundColor: colors.success }]}
                        onPress={handleAccept}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <>
                            <CheckCircle size={18} color="#FFF" />
                            <Text style={styles.actionButtonText}>Accepter</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.counterButton, { backgroundColor: colors.warning }]}
                        onPress={() => setShowCounterForm(true)}
                        disabled={actionLoading}
                      >
                        <Send size={18} color="#FFF" />
                        <Text style={styles.actionButtonText}>Contre-proposer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.refuseButton, { backgroundColor: colors.error }]}
                        onPress={handleRefuse}
                        disabled={actionLoading}
                      >
                        <XCircle size={18} color="#FFF" />
                        <Text style={styles.actionButtonText}>Refuser</Text>
                      </TouchableOpacity>
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
                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Ce que vous proposez *</Text>
                      <TextInput
                        style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                        multiline
                        numberOfLines={3}
                        placeholder="Décrivez ce que vous proposez en échange..."
                        value={counterOffer}
                        onChangeText={setCounterOffer}
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="next"
                      />
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Message *</Text>
                      <TextInput
                        style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                        multiline
                        numberOfLines={2}
                        placeholder="Ajoutez un message pour accompagner votre contre-proposition..."
                        value={counterMessage}
                        onChangeText={setCounterMessage}
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                    {actionError && (
                      <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
                        <Text style={[styles.errorText, { color: colors.error }]}>{actionError}</Text>
                      </View>
                    )}
                    <View style={styles.counterActions}>
                      <TouchableOpacity
                        style={[styles.counterActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => {
                          setShowCounterForm(false);
                          setCounterMessage('');
                          setCounterOffer('');
                          setActionError('');
                        }}
                      >
                        <Text style={[styles.counterActionText, { color: colors.text }]}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.counterActionButton, { backgroundColor: colors.primary }]}
                        onPress={handleCounter}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
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
              <View style={[styles.chatSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
                  <MessageCircle size={20} color={colors.primary} />
                  <Text style={[styles.chatHeaderText, { color: colors.text }]}>Discussion</Text>
                </View>
                <View style={styles.chatContainer}>
                  <ChatWindow proposalId={proposal.id} />
                </View>
              </View>
            </>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

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
    paddingBottom: 100,
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
  acceptButton: {
    backgroundColor: '#10B981',
  },
  counterButton: {
    backgroundColor: '#F59E0B',
  },
  refuseButton: {
    backgroundColor: '#EF4444',
  },
  counterForm: {
    padding: 16,
    borderTopWidth: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
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
