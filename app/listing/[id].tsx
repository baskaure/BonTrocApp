import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase, Listing, errorMessage } from '@/lib/supabase';
import { LISTING_SELECT } from '@/lib/queries';
import { pickImages, uploadImage, removeStorageObject } from '@/lib/image';
import { checkContent, blockedMessage } from '@/lib/moderation';
import { sendTransactionalEmail } from '@/lib/notifications';
import { LISTING_STATUS_LABEL, MODE_LABEL } from '@/lib/labels';
import { useStore } from '@/lib/store';
import { useCategories } from '@/lib/store/hooks';
import { useActivityStore } from '@/lib/activity';
import { ArrowLeft, MapPin, Star, TrendingUp, Sparkles, Shield, MessageCircle, Pencil, Trash2, Calendar, Flag, Tag, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReportModal } from '@/components/ReportModal';
import { FormInput } from '@/components/ui/FormInput';
import { proposalSchema, ProposalFormData } from '@/lib/validations/proposal';

export default function ListingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius, shadows } = useTheme();
  const { user } = useAuth();
  const { categories } = useCategories();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [existingProposalId, setExistingProposalId] = useState<string | null>(null);

  const proposalForm = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: { message: '', offer: '' },
  });
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({
    type: 'service' as 'service' | 'product',
    title: '',
    description_offer: '',
    desired_exchange_desc: '',
    mode: 'both' as 'remote' | 'on_site' | 'both',
    category_id: '',
    estimation_min: '',
    estimation_max: '',
  });

  useEffect(() => {
    if (id) {
      loadListing();
    }
  }, [id, user?.id]);

  const formFromListing = (data: Listing) => ({
    type: data.type,
    title: data.title,
    description_offer: data.description_offer,
    desired_exchange_desc: data.desired_exchange_desc,
    mode: data.mode,
    category_id: data.category_id ?? '',
    estimation_min: data.estimation_min?.toString() || '',
    estimation_max: data.estimation_max?.toString() || '',
  });

  async function loadListing() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('listings').select(LISTING_SELECT).eq('id', id).maybeSingle();
      if (error) throw error;
      const loaded = (data as unknown as Listing) ?? null;
      setListing(loaded);

      if (loaded) {
        setEditForm(formFromListing(loaded));
        setImages(loaded.media?.map((m) => m.url) || []);

        if (user && user.id !== loaded.user_id) {
          // Compteur de vues côté serveur (RPC), et proposition déjà ouverte par ce membre ?
          void supabase.rpc('increment_listing_views', { p_listing_id: loaded.id });
          const { data: existing } = await supabase
            .from('proposals')
            .select('id')
            .eq('listing_id', loaded.id)
            .eq('from_user_id', user.id)
            .in('status', ['pending', 'countered'])
            .is('parent_proposal_id', null)
            .limit(1);
          setExistingProposalId(existing?.[0]?.id ?? null);
        } else {
          setExistingProposalId(null);
        }
      }
    } catch (err) {
      console.error('Error loading listing:', err);
      Alert.alert('Erreur', 'Impossible de charger l\'annonce');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  const pickImage = async () => {
    if (!user) return;
    if (images.length >= 5) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez ajouter que 5 photos maximum');
      return;
    }

    setEditError('');
    try {
      const assets = await pickImages({ max: 5 - images.length });
      if (assets.length === 0) return;
      setUploading(true);
      const uploaded: string[] = [];
      for (const asset of assets) {
        uploaded.push(await uploadImage({ bucket: 'listing-media', folder: 'images', userId: user.id, asset }));
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      const message = errorMessage(err, 'Échec du téléversement des images');
      setEditError(message);
      Alert.alert('Erreur', message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (index: number) => {
    const imageToRemove = images[index];
    setImages(images.filter((_, i) => i !== index));

    // Si l'image existe dans la base de données, la supprimer (et son fichier)
    if (listing && imageToRemove) {
      try {
        await supabase.from('listing_media').delete().eq('listing_id', listing.id).eq('url', imageToRemove);
        await removeStorageObject('listing-media', imageToRemove);
      } catch (err) {
        console.error('Error removing image from database:', err);
      }
    }
  };

  const handleSubmitProposal = async (formData: ProposalFormData) => {
    if (!user || !listing) return;

    setProposalError('');
    setProposalLoading(true);

    try {
      const offer = formData.offer.trim();
      const message = (formData.message ?? '').trim();
      const moderation = await checkContent(`${offer}\n${message}`, user.id);
      if (moderation.hasBlock) {
        setProposalError(blockedMessage(moderation, 'Votre proposition'));
        return;
      }

      const { data: insertedProposal, error: insertError } = await supabase
        .from('proposals')
        .insert({
          listing_id: listing.id,
          from_user_id: user.id,
          to_user_id: listing.user_id,
          message,
          offer_payload: { description: offer },
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      void sendTransactionalEmail('new_proposal', listing.user_id, {
        listing_title: listing.title,
        proposer_name: user.display_name,
        proposal_id: insertedProposal.id,
      });

      useStore.getState().invalidateProposals(user.id);
      void useActivityStore.getState().refresh(user.id);

      proposalForm.reset({ message: '', offer: '' });
      setShowProposalForm(false);
      setExistingProposalId(insertedProposal.id);
      Alert.alert('Proposition envoyée', 'Vous serez prévenu de la réponse.');
      router.push({ pathname: '/proposal/[id]', params: { id: insertedProposal.id } });
    } catch (err) {
      setProposalError(errorMessage(err, 'Impossible d’envoyer la proposition'));
    } finally {
      setProposalLoading(false);
    }
  };

  const handleUpdateListing = async () => {
    if (!listing || !isOwnListing || !user) return;

    setEditError('');
    setEditLoading(true);

    try {
      const title = editForm.title.trim();
      if (title.length < 3 || title.length > 120) throw new Error('Le titre doit faire entre 3 et 120 caractères.');
      const moderation = await checkContent(`${title}\n${editForm.description_offer}\n${editForm.desired_exchange_desc}`, user.id);
      if (moderation.hasBlock) {
        setEditError(blockedMessage(moderation, 'Votre annonce'));
        return;
      }

      const { data: updated, error: updateError } = await supabase
        .from('listings')
        .update({
          type: editForm.type,
          title,
          description_offer: editForm.description_offer.trim(),
          desired_exchange_desc: editForm.desired_exchange_desc.trim(),
          mode: editForm.mode,
          category_id: editForm.category_id || null,
          estimation_min: editForm.estimation_min ? parseFloat(editForm.estimation_min) : null,
          estimation_max: editForm.estimation_max ? parseFloat(editForm.estimation_max) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listing.id)
        .eq('user_id', user.id)
        .select('id');

      if (updateError) throw updateError;
      if (!updated?.length) throw new Error('Mise à jour refusée.');

      // Médias : on remplace la liste (les fichiers retirés ont déjà été supprimés du stockage)
      await supabase.from('listing_media').delete().eq('listing_id', listing.id);
      if (images.length > 0) {
        const { error: mediaError } = await supabase.from('listing_media').insert(
          images.map((url, index) => ({ listing_id: listing.id, url, type: 'image', sort_order: index })),
        );
        if (mediaError) throw mediaError;
      }

      useStore.getState().invalidateListings();
      setEditMode(false);
      await loadListing();
      Alert.alert('Succès', 'Annonce mise à jour !');
    } catch (err) {
      setEditError(errorMessage(err, 'Impossible de mettre à jour l’annonce'));
    } finally {
      setEditLoading(false);
    }
  };

  /** Comme sur le site : l'annonce est archivée (retirée du marché), pas supprimée, pour préserver les échanges liés. */
  const handleArchiveListing = async () => {
    if (!listing || !isOwnListing || !user) return;

    setDeleteLoading(true);
    setEditError('');

    try {
      const { data, error: updateError } = await supabase
        .from('listings')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', listing.id)
        .eq('user_id', user.id)
        .select('id');

      if (updateError) throw updateError;
      if (!data?.length) throw new Error('Retrait refusé.');

      useStore.getState().invalidateListings();
      Alert.alert('Annonce retirée', 'Elle n’est plus visible sur le marché.');
      router.back();
    } catch (err) {
      setEditError(errorMessage(err, 'Impossible de retirer l’annonce'));
      setDeleteLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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

  if (!listing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Retour</Text>
        </TouchableOpacity>
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Annonce non trouvée</Text>
        </View>
      </SafeAreaView>
    );
  }

  const imageUrl = images.length > 0 ? images[0] : 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800';
  const isOwnListing = user?.id === listing.user_id;
  const isPublished = listing.status === 'published';
  const ownerInactive = !listing.user || listing.user.status === 'deleted';
  const categoryName = listing.category?.name ?? categories.find((c) => c.id === listing.category_id)?.name;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{listing.title}</Text>
        <View style={{ width: 24 }} />
      </View>

        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {imageUrl && (
            <Image source={{ uri: imageUrl }} style={[styles.image, { borderRadius: radius.xl }]} />
          )}

          {editMode && isOwnListing && (
            <View style={styles.imagesSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos (max 5)</Text>
              <View style={styles.imagesContainer}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <X size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 5 && (
                  <TouchableOpacity
                    style={[styles.addImageButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={pickImage}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text style={[styles.addImageText, { color: colors.primary }]}>+</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.userSection, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, shadows.soft]}
            onPress={() => listing.user?.id && router.push(`/user/${listing.user.id}`)}
            disabled={!listing.user?.id}
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
                <Text style={[styles.userName, { color: colors.text }, listing.user?.id && styles.userNameClickable]}>
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

          <View style={[styles.badges, { flexWrap: 'wrap' }]}>
            <View style={[styles.badge, { backgroundColor: listing.type === 'service' ? colors.primaryLight : colors.secondaryLight }]}>
              <Text style={[styles.badgeText, { color: listing.type === 'service' ? colors.primary : colors.secondary }]}>
                {listing.type === 'service' ? 'Service' : 'Produit'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{MODE_LABEL[listing.mode]}</Text>
            </View>
            {categoryName ? (
              <View style={[styles.badge, styles.badgeRow, { backgroundColor: colors.surfaceContainer }]}>
                <Tag size={12} color={colors.textSecondary} />
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{categoryName}</Text>
              </View>
            ) : null}
            {!isPublished && (
              <View style={[styles.badge, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.badgeText, { color: colors.error }]}>{LISTING_STATUS_LABEL[listing.status]}</Text>
              </View>
            )}
          </View>

          {!editMode ? (
            <>
              <View style={styles.section}>
                <View style={[styles.offerBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                  <View style={styles.offerHeader}>
                    <TrendingUp size={18} color={colors.primary} />
                    <Text style={[styles.offerLabel, { color: colors.primary }]}>J’offre</Text>
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
                    onPress={() => setEditMode(true)}
                  >
                    <Pencil size={16} color={colors.primary} />
                    <Text style={[styles.editButtonText, { color: colors.primary }]}>Modifier l’annonce</Text>
                  </TouchableOpacity>
                  {isPublished && (
                    <TouchableOpacity
                      style={[styles.deleteButton, { borderColor: colors.error, backgroundColor: colors.surface }]}
                      onPress={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 size={16} color={colors.error} />
                      <Text style={[styles.deleteButtonText, { color: colors.error }]}>Retirer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {isOwnListing && !isPublished && (
                <View style={[styles.authPrompt, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg }, shadows.soft]}>
                  <Text style={[styles.authPromptText, { color: colors.textSecondary }]}>
                    {listing.status === 'suspended'
                      ? 'Cette annonce a été suspendue par la modération. Elle n’est plus visible.'
                      : 'Cette annonce est retirée du marché (archivée ou déjà échangée).'}
                  </Text>
                </View>
              )}

              {!isOwnListing && user && !isPublished && (
                <View style={[styles.authPrompt, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg }, shadows.soft]}>
                  <Text style={[styles.authPromptText, { color: colors.textSecondary }]}>
                    Cette annonce n’est plus disponible : elle a été retirée ou déjà échangée.
                  </Text>
                </View>
              )}

              {!isOwnListing && user && isPublished && !ownerInactive && existingProposalId && (
                <View style={styles.proposalActions}>
                  <TouchableOpacity
                    style={[styles.proposeButton, { backgroundColor: colors.primary }]}
                    onPress={() => router.push({ pathname: '/proposal/[id]', params: { id: existingProposalId } })}
                  >
                    <MessageCircle size={20} color="#FFF" />
                    <Text style={styles.proposeButtonText}>Voir ma proposition en cours</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.reportButton, { borderColor: colors.error }]} onPress={() => setShowReportModal(true)}>
                    <Flag size={16} color={colors.error} />
                    <Text style={[styles.reportButtonText, { color: colors.error }]}>Signaler</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isOwnListing && user && isPublished && !ownerInactive && !existingProposalId && !showProposalForm && (
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
              )}

              {!isOwnListing && user && showProposalForm && (
                <View style={[styles.proposalForm, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, shadows.soft]}>
                  <Text style={[styles.proposalFormTitle, { color: colors.text }]}>Votre proposition</Text>
                  <FormInput
                    control={proposalForm.control}
                    name="offer"
                    label="Ce que vous proposez en échange *"
                    error={proposalForm.formState.errors.offer}
                    inputProps={{
                      multiline: true,
                      numberOfLines: 4,
                      placeholder: 'Décrivez ce que vous proposez...',
                      returnKeyType: 'next',
                      blurOnSubmit: false,
                      style: { minHeight: 80, textAlignVertical: 'top' },
                    }}
                  />
                  <FormInput
                    control={proposalForm.control}
                    name="message"
                    label="Message (facultatif)"
                    error={proposalForm.formState.errors.message}
                    inputProps={{
                      multiline: true,
                      numberOfLines: 3,
                      placeholder: 'Ajoutez un message personnalisé...',
                      returnKeyType: 'done',
                      onSubmitEditing: () => Keyboard.dismiss(),
                      blurOnSubmit: true,
                      style: { minHeight: 60, textAlignVertical: 'top' },
                    }}
                  />
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
                        proposalForm.reset({ message: '', offer: '' });
                      }}
                    >
                      <Text style={[styles.cancelProposalText, { color: colors.text }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sendProposalButton, { backgroundColor: colors.primary }]}
                      onPress={proposalForm.handleSubmit(handleSubmitProposal)}
                      disabled={proposalLoading}
                    >
                      {proposalLoading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.sendProposalButtonText}>Envoyer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!user && (
                <View style={[styles.authPrompt, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg }, shadows.soft]}>
                  <Text style={[styles.authPromptText, { color: colors.text }]}>
                    Connectez-vous pour proposer un échange
                  </Text>
                  <TouchableOpacity
                    style={[styles.authButton, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/auth?mode=login')}
                  >
                    <Text style={styles.authButtonText}>Se connecter</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.editForm}>
              <View style={styles.formRow}>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Type</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity
                      style={[
                        styles.radioOption,
                        { borderColor: colors.border },
                        editForm.type === 'service' && { borderColor: colors.primary, backgroundColor: colors.primaryLight }
                      ]}
                      onPress={() => setEditForm({ ...editForm, type: 'service' })}
                    >
                      <Text style={[
                        styles.radioText,
                        { color: colors.textSecondary },
                        editForm.type === 'service' && { color: colors.primary }
                      ]}>
                        Service
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.radioOption,
                        { borderColor: colors.border },
                        editForm.type === 'product' && { borderColor: colors.primary, backgroundColor: colors.primaryLight }
                      ]}
                      onPress={() => setEditForm({ ...editForm, type: 'product' })}
                    >
                      <Text style={[
                        styles.radioText,
                        { color: colors.textSecondary },
                        editForm.type === 'product' && { color: colors.primary }
                      ]}>
                        Produit
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Mode d’échange</Text>
                <View style={styles.radioGroup}>
                  {(['both', 'on_site', 'remote'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.radioOption,
                        { borderColor: colors.border },
                        editForm.mode === mode && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                      ]}
                      onPress={() => setEditForm({ ...editForm, mode })}
                    >
                      <Text style={[styles.radioText, { color: colors.textSecondary }, editForm.mode === mode && { color: colors.primary }]}>
                        {mode === 'both' ? 'Les deux' : mode === 'on_site' ? 'Présentiel' : 'Distance'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {categories.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Catégorie</Text>
                  <View style={styles.chips}>
                    {categories.map((category) => {
                      const active = editForm.category_id === category.id;
                      return (
                        <TouchableOpacity
                          key={category.id}
                          style={[
                            styles.chip,
                            { borderColor: colors.border, backgroundColor: colors.surface },
                            active && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                          ]}
                          onPress={() => setEditForm({ ...editForm, category_id: active ? '' : category.id })}
                        >
                          <Text style={[styles.chipText, { color: colors.textSecondary }, active && { color: colors.primary, fontWeight: '700' }]}>
                            {category.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Titre *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={editForm.title}
                  onChangeText={(text) => setEditForm({ ...editForm, title: text })}
                  placeholder="Titre de l'annonce"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  maxLength={120}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Ce que vous offrez *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  multiline
                  numberOfLines={4}
                  value={editForm.description_offer}
                  onChangeText={(text) => setEditForm({ ...editForm, description_offer: text })}
                  placeholder="Décrivez ce que vous offrez..."
                  placeholderTextColor={colors.textTertiary}
                  textAlignVertical="top"
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Ce que vous cherchez *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  multiline
                  numberOfLines={4}
                  value={editForm.desired_exchange_desc}
                  onChangeText={(text) => setEditForm({ ...editForm, desired_exchange_desc: text })}
                  placeholder="Décrivez ce que vous cherchez..."
                  placeholderTextColor={colors.textTertiary}
                  textAlignVertical="top"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit={true}
                />
              </View>

              {editError && (
                <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
                  <Text style={[styles.errorText, { color: colors.error }]}>{editError}</Text>
                </View>
              )}

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.cancelEditButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => {
                    setEditMode(false);
                    setEditForm(formFromListing(listing));
                    setImages(listing.media?.map((m) => m.url) || []);
                  }}
                >
                  <Text style={[styles.cancelEditText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
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
            <View style={[styles.deleteConfirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.deleteConfirmText, { color: colors.text }]}>
                Retirer cette annonce ? Elle ne sera plus visible sur le marché. Les échanges déjà engagés ne sont pas affectés.
              </Text>
              <View style={styles.deleteConfirmActions}>
                <TouchableOpacity
                  style={[styles.deleteConfirmButton, { backgroundColor: colors.error }]}
                  onPress={handleArchiveListing}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.deleteConfirmButtonText}>Confirmer</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteCancelButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={[styles.deleteCancelButtonText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="listing"
        targetId={listing.id}
        targetUserId={listing.user_id}
      />
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
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
  },
  imagesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: 24,
    fontWeight: '600',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
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
    backgroundColor: '#2B86CC',
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
  },
  userNameClickable: {
    textDecorationLine: 'underline',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
  },
  newMember: {
    fontSize: 12,
    marginTop: 2,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  section: {
    marginBottom: 20,
  },
  offerBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  offerLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  offerText: {
    fontSize: 15,
    lineHeight: 22,
  },
  seekBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  seekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  seekLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  seekText: {
    fontSize: 15,
    lineHeight: 22,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dateText: {
    fontSize: 12,
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
    borderRadius: 12,
    borderWidth: 1,
  },
  editButtonText: {
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
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  proposalActions: {
    gap: 12,
    marginBottom: 20,
  },
  proposeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 20,
  },
  proposeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  proposalForm: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  proposalFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
  },
  proposalFormActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelProposalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelProposalText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sendProposalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendProposalButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  authPrompt: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  authPromptText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  authButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  authButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editForm: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
    alignItems: 'center',
  },
  radioText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  selectText: {
    fontSize: 14,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelEditButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelEditText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteConfirmBox: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  deleteConfirmText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteConfirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
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
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  deleteCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
  },
});
