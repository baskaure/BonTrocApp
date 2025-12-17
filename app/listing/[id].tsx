import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase, Listing } from '@/lib/supabase';
import { ArrowLeft, MapPin, Star, TrendingUp, Sparkles, Shield, MessageCircle, Pencil, Trash2, Calendar, Flag } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNav } from '@/components/BottomNav';
import { ReportModal } from '@/components/ReportModal';
import * as ImagePicker from 'expo-image-picker';
import { X } from 'lucide-react-native';

export default function ListingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
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
    if (id) {
      loadListing();
    }
  }, [id]);

  async function loadListing() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          user:users(*),
          media:listing_media(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setListing(data);
      
      if (data) {
        setEditForm({
          type: data.type,
          title: data.title,
          description_offer: data.description_offer,
          desired_exchange_desc: data.desired_exchange_desc,
          mode: data.mode,
          estimation_min: data.estimation_min?.toString() || '',
          estimation_max: data.estimation_max?.toString() || '',
        });
        setImages(data.media?.map((m: any) => m.url) || []);
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
    if (images.length >= 5) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez ajouter que 5 photos maximum');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de votre permission pour accéder aux photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - images.length,
    });

    if (!result.canceled && result.assets.length > 0) {
      setUploading(true);
      setEditError('');

      try {
        const uploadPromises = result.assets.map(async (asset) => {
          const ext = asset.uri.split('.').pop() || 'jpg';
          const fileName = `${user?.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

          const response = await fetch(asset.uri);
          const blob = await response.blob();

          const { error: uploadError } = await supabase.storage
            .from('listing-media')
            .upload(`images/${fileName}`, blob, {
              contentType: `image/${ext}`,
              cacheControl: '3600',
            });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('listing-media').getPublicUrl(`images/${fileName}`);
          if (!data?.publicUrl) throw new Error("Impossible de récupérer l'URL publique");

          return data.publicUrl;
        });

        const uploadedUrls = await Promise.all(uploadPromises);
        setImages([...images, ...uploadedUrls]);
      } catch (err: any) {
        console.error(err);
        setEditError(err.message || "Échec du téléversement des images");
        Alert.alert('Erreur', err.message || "Échec du téléversement des images");
      } finally {
        setUploading(false);
      }
    }
  };

  const removeImage = async (index: number) => {
    const imageToRemove = images[index];
    setImages(images.filter((_, i) => i !== index));
    
    // Si l'image existe dans la base de données, la supprimer
    if (listing && imageToRemove) {
      try {
        await supabase
          .from('listing_media')
          .delete()
          .eq('listing_id', listing.id)
          .eq('url', imageToRemove);
      } catch (err) {
        console.error('Error removing image from database:', err);
      }
    }
  };

  const handleSubmitProposal = async () => {
    if (!user || !proposalMessage.trim() || !proposalOffer.trim() || !listing) {
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
      router.push(`/proposal/${data.id}`);
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
        .eq('user_id', user!.id);

      if (updateError) throw updateError;

      // Mettre à jour les images
      if (listing.id) {
        // Supprimer toutes les anciennes images
        await supabase
          .from('listing_media')
          .delete()
          .eq('listing_id', listing.id);

        // Ajouter les nouvelles images
        if (images.length > 0) {
          const mediaPromises = images.map((url, index) =>
            supabase.from('listing_media').insert({
              listing_id: listing.id,
              url: url,
              type: 'image',
              sort_order: index,
            })
          );

          await Promise.all(mediaPromises);
        }
      }

      setEditMode(false);
      await loadListing();
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
        .eq('user_id', user!.id);

      if (deleteError) throw deleteError;

      Alert.alert('Succès', 'Annonce supprimée avec succès');
      router.back();
    } catch (err: any) {
      setEditError(err.message || 'Impossible de supprimer l\'annonce');
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
        <BottomNav />
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
        <BottomNav />
      </SafeAreaView>
    );
  }

  const imageUrl = images.length > 0 ? images[0] : 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800';
  const isOwnListing = user?.id === listing.user_id;

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
            <Image source={{ uri: imageUrl }} style={styles.image} />
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
            style={styles.userSection}
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

          {!editMode ? (
            <>
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
                    onPress={() => setEditMode(true)}
                  >
                    <Pencil size={16} color={colors.primary} />
                    <Text style={[styles.editButtonText, { color: colors.primary }]}>Modifier l'annonce</Text>
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

              {!isOwnListing && user && !showProposalForm && (
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
                      onSubmitEditing={Keyboard.dismiss}
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
                        <Text style={styles.sendProposalButtonText}>Envoyer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!user && (
                <View style={[styles.authPrompt, { backgroundColor: colors.background }]}>
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
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Mode</Text>
                  <View style={[styles.selectContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.selectText, { color: colors.text }]}>
                      {editForm.mode === 'both' ? 'Les deux' :
                       editForm.mode === 'remote' ? 'Distance' : 'Présentiel'}
                    </Text>
                  </View>
                </View>
              </View>

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
                    setEditForm({
                      type: listing.type,
                      title: listing.title,
                      description_offer: listing.description_offer,
                      desired_exchange_desc: listing.desired_exchange_desc,
                      mode: listing.mode,
                      estimation_min: listing.estimation_min?.toString() || '',
                      estimation_max: listing.estimation_max?.toString() || '',
                    });
                    setImages(listing.media?.map((m: any) => m.url) || []);
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
                Cette action est irréversible. Confirmez la suppression de l'annonce.
              </Text>
              <View style={styles.deleteConfirmActions}>
                <TouchableOpacity
                  style={[styles.deleteConfirmButton, { backgroundColor: colors.error }]}
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

      <BottomNav />

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
    paddingBottom: 100,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  offerBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
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
    borderRadius: 12,
    borderWidth: 2,
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
