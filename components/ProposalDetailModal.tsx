import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { X, MessageCircle, CheckCircle, XCircle, Send } from 'lucide-react-native';
import { supabase, Proposal } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { ChatWindow } from './ChatWindow';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNav } from './BottomNav';

type ProposalDetailModalProps = {
  proposal: Proposal | null;
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
  fullScreen?: boolean;
};

export function ProposalDetailModal({ proposal, visible, onClose, onUpdate, fullScreen = false }: ProposalDetailModalProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [showChat, setShowChat] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterMessage, setCounterMessage] = useState('');
  const [counterOffer, setCounterOffer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!proposal) return null;

  const isReceiver = proposal.to_user_id === user?.id;
  const otherUser = isReceiver ? proposal.from_user : proposal.to_user;

  const handleAccept = async () => {
    setError('');
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('proposals')
        .update({ status: 'accepted' })
        .eq('id', proposal.id);

      if (updateError) throw updateError;

      // Générer le contrat
      const { error: contractFnError } = await supabase.functions.invoke('generate-contract-pdf', {
        body: { proposal_id: proposal.id },
      });

      if (contractFnError) {
        console.error('Error generating contract:', contractFnError);
      }

      Alert.alert('Succès', 'Proposition acceptée ! Le contrat a été généré.');
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'acceptation');
    } finally {
      setLoading(false);
    }
  };

  const handleRefuse = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'refused' })
        .eq('id', proposal.id);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error refusing proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCounter = async () => {
    if (!counterOffer.trim() || !counterMessage.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    setError('');
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
      onUpdate();
      onClose();
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la contre-proposition');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {proposal.listing?.title || 'Proposition'}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={fullScreen ? { paddingBottom: 100 } : { paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
            <View style={styles.userSection}>
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
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  Proposition {isReceiver ? 'de' : 'pour'} {otherUser?.display_name}
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
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Message</Text>
              <View style={[styles.messageBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.messageText, { color: colors.text }]}>{proposal.message}</Text>
              </View>
            </View>

            {proposal.offer_payload?.description && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>En échange</Text>
                <View style={[styles.offerBox, { backgroundColor: colors.secondaryLight, borderColor: colors.secondary }]}>
                  <Text style={[styles.offerText, { color: colors.text }]}>{proposal.offer_payload.description}</Text>
                </View>
              </View>
            )}

            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            {!showChat && !showCounterForm && proposal.status === 'pending' && isReceiver && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={handleAccept}
                  disabled={loading}
                >
                  <CheckCircle size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Accepter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.counterButton]}
                  onPress={() => setShowCounterForm(true)}
                  disabled={loading}
                >
                  <Send size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Contre-proposer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.refuseButton]}
                  onPress={handleRefuse}
                  disabled={loading}
                >
                  <XCircle size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Refuser</Text>
                </TouchableOpacity>
              </View>
            )}

            {showCounterForm && (
              <View style={styles.counterForm}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Votre contre-proposition</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  multiline
                  numberOfLines={4}
                  placeholder="Décrivez votre contre-proposition..."
                  value={counterOffer}
                  onChangeText={setCounterOffer}
                  placeholderTextColor={colors.textTertiary}
                />
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  multiline
                  numberOfLines={3}
                  placeholder="Message..."
                  value={counterMessage}
                  onChangeText={setCounterMessage}
                  placeholderTextColor={colors.textTertiary}
                />
                <View style={styles.counterActions}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      setShowCounterForm(false);
                      setCounterMessage('');
                      setCounterOffer('');
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={handleCounter}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>Envoyer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {proposal.status === 'accepted' && (
              <TouchableOpacity
                style={[styles.chatButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowChat(!showChat)}
              >
                <MessageCircle size={20} color="#FFF" />
                <Text style={styles.chatButtonText}>
                  {showChat ? 'Masquer' : 'Ouvrir'} la discussion
                </Text>
              </TouchableOpacity>
            )}

            {proposal.status === 'pending' && (
              <TouchableOpacity
                style={[styles.chatButtonSecondary, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowChat(!showChat)}
              >
                <MessageCircle size={20} color={colors.primary} />
                <Text style={[styles.chatButtonTextSecondary, { color: colors.primary }]}>
                  {showChat ? 'Masquer' : 'Discuter'} avec {otherUser?.display_name}
                </Text>
              </TouchableOpacity>
            )}

            {showChat && (
              <View style={styles.chatContainer}>
                <ChatWindow proposalId={proposal.id} />
              </View>
            )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );

  if (fullScreen) {
    return (
      <SafeAreaView style={[styles.fullscreenContainer, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.modal, { backgroundColor: colors.surface, maxHeight: '100%', minHeight: '100%', flex: 1 }]}>
          {content}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          {content}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '95%',
    minHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    padding: 20,
    flex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 20,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  messageBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  offerBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  offerText: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  actions: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 20,
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
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  counterForm: {
    marginBottom: 20,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  counterActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  chatButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chatButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 2,
    borderRadius: 20,
    marginBottom: 20,
  },
  chatButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
  },
  chatContainer: {
    marginBottom: 20,
  },
});

