import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Listing, supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { X, MapPin, Star, TrendingUp, Sparkles, Shield, MessageCircle, Pencil, Trash2, Calendar, Flag } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ReportModal } from './ReportModal';
import { BottomNav } from './BottomNav';
import { SafeAreaView } from 'react-native-safe-area-context';

type ListingDetailModalProps = {
  listing: Listing | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onUserClick?: (userId: string) => void;
};

export function ListingDetailModal({ listing, visible, onClose, onSuccess, onUserClick }: ListingDetailModalProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalMessage, setProposalMessage] = useState('');
  const [proposalOffer, setProposalOffer] = useState('');
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editForm, setEditForm] = useState({
    type: 'service' as 'service' | 'product',
    title: '',
    description_offer: '',
    desired_exchange_desc: '',
    mode: 'both' as 'remote' | 'on_site' | 'both',
    estimation_min: '',
    estimation_max: '',
  });

  useEffect(() => {
    if (listing) {
      setEditForm({
        type: listing.type,
        title: listing.title,
        description_offer: listing.description_offer,
        desired_exchange_desc: listing.desired_exchange_desc,
        mode: listing.mode,
        estimation_min: listing.estimation_min?.toString() || '',
        estimation_max: listing.estimation_max?.toString() || '',
      });
      setEditMode(false);
      setShowProposalForm(false);
      setProposalMessage('');
      setProposalOffer('');
    }
  }, [listing]);

  if (!listing) return null;

  const imageUrl = listing.media && listing.media.length > 0
    ? listing.media[0].url
    : 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800';

  const isOwnListing = user?.id === listing.user_id;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleSubmitProposal = async () => {
    if (!user || !proposalMessage.trim() || !proposalOffer.trim()) {
      setProposalError('Veuillez remplir tous les champs');
      return;
    }

    setProposalError('');
    setProposalLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('proposals')
        .insert({
          listing_id: listing.id,
          from_user_id: user.id,
          to_user_id: listing.user_id,
          message: proposalMessage,
          offer_payload: { description: proposalOffer },
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Créer une notification pour le destinataire
      if (data) {
        const { data: notifData, error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: listing.user_id,
            type: 'proposal_received',
            message: `${user.display_name || user.username} vous a fait une proposition`,
            related_id: data.id,
          })
          .select();

        if (notifError) {
          if (notifError.code === 'PGRST205') {
            console.warn('Table notifications does not exist. Please run the SQL script.');
          } else {
            console.error('Error creating proposal notification:', notifError);
          }
        } else if (notifData) {
          console.log('Proposal notification created:', notifData[0]?.id);
        }
      }

      setProposalMessage('');
      setProposalOffer('');
      setShowProposalForm(false);
      Alert.alert('Succès', 'Votre proposition a été envoyée !');
      onSuccess();
      onClose();
    } catch (err: any) {
      setProposalError(err.message || 'Une erreur est survenue');
    } finally {
      setProposalLoading(false);
    }
  };

  const handleUpdateListing = async () => {
    if (!listing || !isOwnListing) return;

    setEditError('');
    setEditLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('listings')
        .update({
          type: editForm.type,
          title: editForm.title,
          description_offer: editForm.description_offer,
          desired_exchange_desc: editForm.desired_exchange_desc,
          mode: editForm.mode,
          estimation_min: editForm.estimation_min ? parseFloat(editForm.estimation_min) : null,
          estimation_max: editForm.estimation_max ? parseFloat(editForm.estimation_max) : null,
        })
        .eq('id', listing.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setEditMode(false);
      await onSuccess();
      Alert.alert('Succès', 'Annonce mise à jour avec succès !');
    } catch (err: any) {
      setEditError(err.message || 'Impossible de mettre à jour l\'annonce');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!listing || !isOwnListing) return;

    setDeleteLoading(true);
    setEditError('');

    try {
      const { error: deleteError } = await supabase
        .from('listings')
        .delete()
        .eq('id', listing.id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      await onSuccess();
      Alert.alert('Succès', 'Annonce supprimée avec succès');
      onClose();
    } catch (err: any) {
      setEditError(err.message || 'Impossible de supprimer l\'annonce');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{listing.title}</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
              style={styles.keyboardView}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {imageUrl && (
              <Image source={{ uri: imageUrl }} style={styles.image} />
            )}

            <TouchableOpacity
              style={styles.userSection}
              onPress={() => {
                if (onUserClick && listing.user?.id) {
                  onUserClick(listing.user.id);
                }
              }}
              disabled={!onUserClick || !listing.user?.id}
            >
              {listing.user?.avatar_url ? (
                <Image
                  source={{ uri: listing.user.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {listing.user?.display_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={[styles.userName, { color: colors.text }, onUserClick && listing.user?.id && styles.userNameClickable]}>
                    {listing.user?.display_name || 'Utilisateur'}
                  </Text>
                  {listing.user?.is_verified && (
                    <Shield size={16} color={colors.primary} />
                  )}
                </View>
                {listing.user && listing.user.rating_count > 0 ? (
                  <View style={styles.rating}>
                    <Star size={14} color={colors.secondary} fill={colors.secondary} />
                    <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                      {listing.user.rating_avg.toFixed(1)} · {listing.user.rating_count} avis
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.newMember, { color: colors.textSecondary }]}>Nouveau membre</Text>
                )}
                {listing.user?.city && (
                  <View style={styles.location}>
                    <MapPin size={14} color={colors.textSecondary} />
                    <Text style={[styles.locationText, { color: colors.textSecondary }]}>{listing.user.city}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: listing.type === 'service' ? colors.primaryLight : colors.secondaryLight }]}>
                <Text style={[styles.badgeText, { color: listing.type === 'service' ? colors.primary : colors.secondary }]}>
                  {listing.type === 'service' ? 'Service' : 'Produit'}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.background }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                  {listing.mode === 'remote' ? 'Distance' : listing.mode === 'on_site' ? 'Présentiel' : 'Les deux'}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={[styles.offerBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <View style={styles.offerHeader}>
                  <TrendingUp size={18} color={colors.primary} />
                  <Text style={[styles.offerLabel, { color: colors.primary }]}>J'offre</Text>
                </View>
                <Text style={[styles.offerText, { color: colors.text }]}>{listing.description_offer}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={[styles.seekBox, { backgroundColor: colors.secondaryLight, borderColor: colors.secondary }]}>
                <View style={styles.seekHeader}>
                  <Sparkles size={18} color={colors.secondary} />
                  <Text style={[styles.seekLabel, { color: colors.secondary }]}>Je cherche</Text>
                </View>
                <Text style={[styles.seekText, { color: colors.text }]}>{listing.desired_exchange_desc}</Text>
              </View>
            </View>

            <View style={styles.dateRow}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                Publié le {formatDate(listing.created_at)}
              </Text>
            </View>

            {isOwnListing && (
              <View style={styles.ownerActions}>
                <TouchableOpacity
                  style={[styles.editButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                  onPress={() => setEditMode(!editMode)}
                >
                  <Pencil size={16} color={colors.primary} />
                  <Text style={[styles.editButtonText, { color: colors.primary }]}>
                    {editMode ? 'Fermer' : "Modifier l'annonce"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, { borderColor: colors.error, backgroundColor: colors.surface }]}
                  onPress={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={16} color={colors.error} />
                  <Text style={[styles.deleteButtonText, { color: colors.error }]}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            )}

            {editMode && isOwnListing && (
              <View style={styles.editForm}>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Type</Text>
                    <View style={styles.radioGroup}>
                      <TouchableOpacity
                        style={[styles.radioOption, editForm.type === 'service' && styles.radioOptionSelected]}
                        onPress={() => setEditForm({ ...editForm, type: 'service' })}
                      >
                        <Text style={[styles.radioText, editForm.type === 'service' && styles.radioTextSelected]}>
                          Service
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.radioOption, editForm.type === 'product' && styles.radioOptionSelected]}
                        onPress={() => setEditForm({ ...editForm, type: 'product' })}
                      >
                        <Text style={[styles.radioText, editForm.type === 'product' && styles.radioTextSelected]}>
                          Produit
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Mode</Text>
                    <View style={styles.selectContainer}>
                      <Text style={styles.selectText}>
                        {editForm.mode === 'both' ? 'Les deux' :
                         editForm.mode === 'remote' ? 'Distance' : 'Présentiel'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Titre *</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.title}
                    onChangeText={(text) => setEditForm({ ...editForm, title: text })}
                    placeholder="Titre de l'annonce"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Ce que vous offrez *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    multiline
                    numberOfLines={4}
                    value={editForm.description_offer}
                    onChangeText={(text) => setEditForm({ ...editForm, description_offer: text })}
                    placeholder="Décrivez ce que vous offrez..."
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Ce que vous cherchez *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    multiline
                    numberOfLines={4}
                    value={editForm.desired_exchange_desc}
                    onChangeText={(text) => setEditForm({ ...editForm, desired_exchange_desc: text })}
                    placeholder="Décrivez ce que vous cherchez..."
                    placeholderTextColor="#999"
                  />
                </View>

                {editError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{editError}</Text>
                  </View>
                )}

                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.cancelEditButton}
                    onPress={() => {
                      setEditMode(false);
                      setEditForm({
                        type: listing.type,
                        title: listing.title,
                        description_offer: listing.description_offer,
                        desired_exchange_desc: listing.desired_exchange_desc,
                        mode: listing.mode,
                        estimation_min: listing.estimation_min?.toString() || '',
                        estimation_max: listing.estimation_max?.toString() || '',
                      });
                    }}
                  >
                    <Text style={styles.cancelEditText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleUpdateListing}
                    disabled={editLoading}
                  >
                    {editLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showDeleteConfirm && (
              <View style={styles.deleteConfirmBox}>
                <Text style={styles.deleteConfirmText}>
                  Cette action est irréversible. Confirmez la suppression de l'annonce.
                </Text>
                <View style={styles.deleteConfirmActions}>
                  <TouchableOpacity
                    style={styles.deleteConfirmButton}
                    onPress={handleDeleteListing}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.deleteConfirmButtonText}>Confirmer</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteCancelButton}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={styles.deleteCancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!isOwnListing && user && (
              <>
                {!showProposalForm ? (
                  <View style={styles.proposalActions}>
                    <TouchableOpacity
                      style={[styles.proposeButton, { backgroundColor: colors.primary }]}
                      onPress={() => setShowProposalForm(true)}
                    >
                      <MessageCircle size={20} color="#FFF" />
                      <Text style={styles.proposeButtonText}>Proposer un échange</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reportButton, { borderColor: colors.error }]}
                      onPress={() => setShowReportModal(true)}
                    >
                      <Flag size={16} color={colors.error} />
                      <Text style={[styles.reportButtonText, { color: colors.error }]}>Signaler</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.proposalForm, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.proposalFormTitle, { color: colors.text }]}>Votre proposition</Text>
                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Ce que vous proposez en échange *</Text>
                      <TextInput
                        style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                        multiline
                        numberOfLines={4}
                        placeholder="Décrivez ce que vous proposez..."
                        value={proposalOffer}
                        onChangeText={setProposalOffer}
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="next"
                        blurOnSubmit={false}
                      />
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Message *</Text>
                      <TextInput
                        style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                        multiline
                        numberOfLines={3}
                        placeholder="Ajoutez un message personnalisé..."
                        value={proposalMessage}
                        onChangeText={setProposalMessage}
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="done"
                        blurOnSubmit={true}
                      />
                    </View>
                    {proposalError && (
                      <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
                        <Text style={[styles.errorText, { color: colors.error }]}>{proposalError}</Text>
                      </View>
                    )}
                    <View style={styles.proposalFormActions}>
                      <TouchableOpacity
                        style={[styles.cancelProposalButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                        onPress={() => {
                          setShowProposalForm(false);
                          setProposalMessage('');
                          setProposalOffer('');
                        }}
                      >
                        <Text style={[styles.cancelProposalText, { color: colors.text }]}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sendProposalButton, { backgroundColor: colors.primary }]}
                        onPress={handleSubmitProposal}
                        disabled={proposalLoading}
                      >
                        {proposalLoading ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <Text style={styles.sendProposalText}>Envoyer</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            {!user && (
              <View style={[styles.authPrompt, { backgroundColor: colors.background }]}>
                <Text style={[styles.authPromptText, { color: colors.text }]}>
                  Connectez-vous pour proposer un échange
                </Text>
                <TouchableOpacity
                  style={[styles.authButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    onClose();
                    router.push('/auth?mode=login');
                  }}
                >
                  <Text style={styles.authButtonText}>Se connecter</Text>
                </TouchableOpacity>
              </View>
            )}
              </ScrollView>
            </KeyboardAvoidingView>

            <BottomNav />
          </View>
        </SafeAreaView>
      </View>

      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="listing"
        targetId={listing.id}
        targetUserId={listing.user_id}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    maxHeight: '95%',
    justifyContent: 'space-between',
  },
  keyboardView: {
    flex: 1,
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
  scrollView: {
    padding: 20,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
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
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  userNameClickable: {
    color: '#19ADFA',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#64748B',
  },
  newMember: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#64748B',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#19ADFA',
  },
  section: {
    marginBottom: 20,
  },
  offerBox: {
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  offerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#19ADFA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  offerText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  seekBox: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  seekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  seekLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seekText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  proposeButton: {
    backgroundColor: '#19ADFA',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  proposeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 20,
  },
  dateText: {
    fontSize: 13,
    color: '#64748B',
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#19ADFA',
    backgroundColor: '#FFF',
  },
  editButtonText: {
    color: '#19ADFA',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: '#FFF',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  editForm: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formGroup: {
    flex: 1,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  radioOption: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  radioOptionSelected: {
    backgroundColor: '#19ADFA',
    borderColor: '#19ADFA',
  },
  radioText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  radioTextSelected: {
    color: '#FFF',
  },
  selectContainer: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  selectText: {
    fontSize: 15,
    color: '#1E293B',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelEditButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelEditText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#19ADFA',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteConfirmBox: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteConfirmText: {
    fontSize: 14,
    color: '#991B1B',
    marginBottom: 12,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  deleteCancelButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  proposalActions: {
    gap: 12,
    marginBottom: 20,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  reportButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  proposalForm: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  proposalFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  proposalFormActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelProposalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  cancelProposalText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  sendProposalButton: {
    flex: 1,
    backgroundColor: '#19ADFA',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  sendProposalText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  authPrompt: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  authPromptText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
  },
  authButton: {
    backgroundColor: '#19ADFA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  authButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
});


