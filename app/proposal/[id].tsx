import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase, Proposal } from '@/lib/supabase';
import { ArrowLeft, MessageCircle, CheckCircle, XCircle, Send } from 'lucide-react-native';
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
  const [showChat, setShowChat] = useState(true); // Par défaut, la discussion est ouverte
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
          
          if (updateError) {
            // Si la table n'existe pas, on ignore silencieusement
            if (updateError.code !== 'PGRST205') {
              console.error('Error marking notifications as read:', updateError);
            }
          } else if (updated && updated.length > 0) {
            console.log(`Marked ${updated.length} notifications as read for proposal ${data.id}`);
          }
        } catch (err: any) {
          // Ignorer les erreurs si la table n'existe pas
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
            <ArrowLeft size={24} color={colors.textSecondary} />
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
    setActionError('');
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('proposals')
        .update({ status: 'accepted' })
        .eq('id', proposal.id);

      if (updateError) throw updateError;

      // Créer une notification pour l'utilisateur qui a fait la proposition
      if (proposal.from_user_id !== user?.id) {
        try {
          const { data: notifData, error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: proposal.from_user_id,
              type: 'proposal_accepted',
              message: `${proposal.to_user?.display_name || 'Un utilisateur'} a accepté votre proposition`,
              related_id: proposal.id,
            })
            .select();

          if (notifError) {
            if (notifError.code === 'PGRST205') {
              console.warn('Table notifications does not exist. Please run the SQL script.');
            } else {
              console.error('Error creating proposal_accepted notification:', notifError);
            }
          } else if (notifData) {
            console.log('Proposal accepted notification created:', notifData[0]?.id);
          }
        } catch (err) {
          console.error('Exception creating proposal_accepted notification:', err);
        }
      }

      // Générer le contrat
      const { error: contractFnError } = await supabase.functions.invoke('generate-contract-pdf', {
        body: { proposal_id: proposal.id },
      });

      if (contractFnError) {
        console.error('Error generating contract:', contractFnError);
      }

      Alert.alert('Succès', 'Proposition acceptée ! Le contrat a été généré.');
      await loadProposal();
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors de l\'acceptation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefuse = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'refused' })
        .eq('id', proposal.id);

      if (error) throw error;
      await loadProposal();
    } catch (error) {
      console.error('Error refusing proposal:', error);
    } finally {
      setActionLoading(false);
    }
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
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {proposal.listing?.title || 'Proposition'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: proposal.status === 'accepted' ? colors.successLight : proposal.status === 'refused' ? colors.errorLight : colors.warningLight }]}>
            <Text style={[
              styles.statusText,
              { color: proposal.status === 'accepted' ? colors.success : proposal.status === 'refused' ? colors.error : colors.warning }
            ]}>
              {proposal.status === 'accepted' ? 'Acceptée' :
               proposal.status === 'refused' ? 'Refusée' :
               proposal.status === 'countered' ? 'Contre-proposition' :
               'En attente'}
            </Text>
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Section compacte avec infos de la proposition */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            style={styles.infoScrollView}
            contentContainerStyle={styles.infoScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.compactInfo}>
            <View style={styles.userRow}>
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
              <Text style={[styles.userName, { color: colors.text }]}>
                {otherUser?.display_name}
              </Text>
            </View>

            <View style={styles.messagePreview}>
              <Text style={[styles.messagePreviewText, { color: colors.textSecondary }]} numberOfLines={2}>
                {proposal.message}
              </Text>
            </View>

            {proposal.offer_payload?.description && (
              <View style={styles.offerPreview}>
                <Text style={[styles.offerPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
                  💡 {proposal.offer_payload.description}
                </Text>
              </View>
            )}

            {proposal.status === 'pending' && isReceiver && !showCounterForm && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.acceptButton, { backgroundColor: colors.success }]}
                  onPress={handleAccept}
                  disabled={actionLoading}
                >
                  <CheckCircle size={16} color="#FFF" />
                  <Text style={styles.quickActionText}>Accepter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.counterButton, { backgroundColor: colors.warning }]}
                  onPress={() => setShowCounterForm(true)}
                  disabled={actionLoading}
                >
                  <Send size={16} color="#FFF" />
                  <Text style={styles.quickActionText}>Contre-proposer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.refuseButton, { backgroundColor: colors.error }]}
                  onPress={handleRefuse}
                  disabled={actionLoading}
                >
                  <XCircle size={16} color="#FFF" />
                  <Text style={styles.quickActionText}>Refuser</Text>
                </TouchableOpacity>
              </View>
            )}

            {showCounterForm && (
              <View style={[styles.counterForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.counterFormTitle, { color: colors.text }]}>Contre-proposition</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  multiline
                  numberOfLines={3}
                  placeholder="Ce que vous proposez..."
                  value={counterOffer}
                  onChangeText={setCounterOffer}
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  multiline
                  numberOfLines={2}
                  placeholder="Message..."
                  value={counterMessage}
                  onChangeText={setCounterMessage}
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit={true}
                />
                {actionError && (
                  <Text style={[styles.errorText, { color: colors.error }]}>{actionError}</Text>
                )}
                <View style={styles.counterActions}>
                  <TouchableOpacity
                    style={[styles.counterActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      setShowCounterForm(false);
                      setCounterMessage('');
                      setCounterOffer('');
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
                      <Text style={styles.counterActionTextPrimary}>Envoyer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Section discussion - prend la majorité de l'espace */}
        <View style={styles.chatSection}>
          <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
            <MessageCircle size={20} color={colors.primary} />
            <Text style={[styles.chatHeaderText, { color: colors.text }]}>Discussion</Text>
          </View>
          <View style={styles.chatContainer}>
            <ChatWindow proposalId={proposal.id} />
          </View>
        </View>
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
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  infoScrollView: {
    maxHeight: 180,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoScrollContent: {
    padding: 12,
  },
  compactInfo: {
    gap: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  messagePreview: {
    marginLeft: 40,
  },
  messagePreviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  offerPreview: {
    marginLeft: 40,
    paddingTop: 4,
  },
  offerPreviewText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    marginLeft: 40,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flex: 1,
  },
  quickActionText: {
    color: '#FFF',
    fontSize: 11,
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
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  counterFormTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
  },
  counterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  counterActionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  counterActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  counterActionTextPrimary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  chatSection: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    backgroundColor: '#F8FAFC',
  },
  chatHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
  },
  emptyText: {
    fontSize: 16,
  },
});
