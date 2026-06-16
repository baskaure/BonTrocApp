import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase, Review } from '@/lib/supabase';
import { Settings, LogOut, Star, Edit2, X, Check, Mail, Phone, MapPin, Calendar, Shield, Camera, ImageUp, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReviews } from '@/lib/store/hooks';
import { FormInput } from '@/components/ui/FormInput';
import { FormTagInput } from '@/components/ui/FormTagInput';
import { profileSchema, ProfileFormData } from '@/lib/validations/profile';


export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [listingsCount, setListingsCount] = useState(0);
  const [mediaUploading, setMediaUploading] = useState({ avatar: false, banner: false });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: '',
      username: '',
      bio: '',
      phone: '',
      city: '',
      country: '',
      languages: [],
      skills: [],
      search_radius_km: 50,
      avatar_url: '',
      banner_url: '',
    },
  });

  const formValues = watch();

  // Utiliser le store pour charger les reviews
  const { reviews, loading: reviewsLoading, refresh: refreshReviews } = useReviews(user?.id || null, { autoLoad: !!user });

  useEffect(() => {
    if (user) {
      reset({
        display_name: user.display_name || '',
        username: user.username || '',
        bio: user.bio || '',
        phone: user.phone || '',
        city: user.city || '',
        country: user.country || '',
        languages: user.languages || [],
        skills: user.skills || [],
        search_radius_km: user.search_radius_km || 50,
        avatar_url: user.avatar_url || '',
        banner_url: user.banner_url || '',
      });
      loadListingsCount();
    }
  }, [user, reset]);

  async function loadListingsCount() {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'published');

      if (count !== null) {
        setListingsCount(count);
      }
    } catch (err) {
      console.error('Error loading listings count:', err);
    }
  }

  const uploadProfileMedia = async (type: 'avatar' | 'banner') => {
    if (!user) return;

    // Demander la permission d'accès à la bibliothèque de photos
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de votre permission pour accéder aux photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // @ts-ignore - MediaTypeOptions est déprécié mais fonctionne toujours
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.9,
    });

    if (result.canceled) return;

    setMediaUploading((prev) => ({ ...prev, [type]: true }));
    setError('');

    try {
      const file = result.assets[0];
      
      // Utiliser .jpg pour éviter les problèmes de transparence
      const fileName = `${type}/${user.id}-${Date.now()}.jpg`;
      const mime = file.mimeType || 'image/jpeg';

      // Vérifier la taille du fichier
      const size = file.fileSize || 0;
      const maxBytes = 5 * 1024 * 1024; // 5 Mo
      if (size > maxBytes) {
        throw new Error('Image trop volumineuse (max 5 Mo).');
      }

      // Pour React Native, il faut lire le fichier et l'uploader via fetch
      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convertir base64 en ArrayBuffer
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Upload vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, byteArray, {
          upsert: true,
          contentType: mime,
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }

      // Obtenir l'URL publique avec un timestamp pour forcer le rechargement
      const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(fileName);
      if (!urlData?.publicUrl) {
        throw new Error('Impossible de récupérer l\'URL publique de l\'image');
      }
      
      // Ajouter un timestamp pour éviter le cache
      const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      
      console.log('Image uploaded successfully:', imageUrl);
      
      setValue(type === 'avatar' ? 'avatar_url' : 'banner_url', imageUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Erreur lors du téléversement');
    } finally {
      setMediaUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: data.display_name,
          username: data.username,
          bio: data.bio,
          phone: data.phone,
          city: data.city,
          country: data.country,
          languages: data.languages,
          skills: data.skills,
          search_radius_km: data.search_radius_km,
          avatar_url: data.avatar_url,
          banner_url: data.banner_url,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshUser();
      setSuccess('Profil mis à jour avec succès!');
      setIsEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const { colors } = useTheme();

  const handleSignOut = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // La redirection sera gérée automatiquement par _layout.tsx
              // via le useEffect qui écoute les changements de user
            } catch (err: any) {
              Alert.alert('Erreur', err.message || 'Erreur lors de la déconnexion');
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.bannerContainer}>
            {formValues.banner_url ? (
              <Image 
                source={{ uri: formValues.banner_url }} 
                style={styles.banner}
                onError={(e) => {
                  console.error('Error loading banner image:', e.nativeEvent.error);
                  setError('Erreur lors du chargement de la bannière');
                }}
              />
            ) : (
              <View style={styles.bannerPlaceholder} />
            )}
            {isEditing && (
              <TouchableOpacity
                style={styles.bannerEditButton}
                onPress={() => uploadProfileMedia('banner')}
                disabled={mediaUploading.banner}
              >
                {mediaUploading.banner ? (
                  <Loader2 size={16} color="#FFF" />
                ) : (
                  <ImageUp size={16} color="#FFF" />
                )}
                <Text style={styles.bannerEditText}>
                  {mediaUploading.banner ? 'Téléversement...' : 'Changer'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {formValues.avatar_url ? (
                <Image 
                  source={{ uri: formValues.avatar_url }} 
                  style={[styles.avatar, { borderColor: colors.surface }]}
                  onError={(e) => {
                    console.error('Error loading avatar image:', e.nativeEvent.error);
                    setError('Erreur lors du chargement de l\'avatar');
                    setValue('avatar_url', user.avatar_url || '');
                  }}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { borderColor: colors.surface }]}>
                  <Text style={styles.avatarText}>
                    {formValues.display_name[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              {isEditing && (
                <TouchableOpacity
                  style={[styles.avatarEditButton, { backgroundColor: colors.primary }]}
                  onPress={() => uploadProfileMedia('avatar')}
                  disabled={mediaUploading.avatar}
                >
                  {mediaUploading.avatar ? (
                    <Loader2 size={16} color="#FFF" />
                  ) : (
                    <Camera size={16} color="#FFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.profileInfoSection}>
            <View style={styles.profileInfo}>
              <Text style={[styles.name, { color: colors.text }]}>{formValues.display_name}</Text>
              <Text style={[styles.username, { color: colors.textSecondary }]}>@{formValues.username}</Text>
              {user.rating_count > 0 && (
                <View style={styles.rating}>
                  <Star size={16} color={colors.secondary} fill={colors.secondary} />
                  <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                    {user.rating_avg.toFixed(1)} · {user.rating_count} avis
                  </Text>
                </View>
              )}
            </View>

            {!isEditing ? (
              <TouchableOpacity
                style={[styles.editButton, { borderColor: colors.primary }]}
                onPress={() => setIsEditing(true)}
              >
                <Edit2 size={16} color={colors.primary} />
                <Text style={[styles.editButtonText, { color: colors.primary }]}>Modifier</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.cancelEditButton, { borderColor: colors.border }]}
                onPress={() => {
                  setIsEditing(false);
                  reset({
                    display_name: user.display_name || '',
                    username: user.username || '',
                    bio: user.bio || '',
                    phone: user.phone || '',
                    city: user.city || '',
                    country: user.country || '',
                    languages: user.languages || [],
                    skills: user.skills || [],
                    search_radius_km: user.search_radius_km || 50,
                    avatar_url: user.avatar_url || '',
                    banner_url: user.banner_url || '',
                  });
                }}
              >
                <X size={16} color={colors.textSecondary} />
                <Text style={[styles.cancelEditText, { color: colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={[styles.successBox, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.successText, { color: colors.success }]}>{success}</Text>
            </View>
          )}

          {isEditing ? (
            <View style={styles.editForm}>
              <View style={styles.formRow}>
                <FormInput
                  control={control}
                  name="display_name"
                  label="Nom d'affichage *"
                  containerStyle={styles.formGroup}
                  inputProps={{ placeholder: 'Votre nom' }}
                />
                <FormInput
                  control={control}
                  name="username"
                  label="Nom d'utilisateur *"
                  containerStyle={styles.formGroup}
                  inputProps={{ placeholder: '@username', autoCapitalize: 'none' }}
                />
              </View>

              <View style={styles.formRow}>
                <FormInput
                  control={control}
                  name="city"
                  label="Ville"
                  containerStyle={styles.formGroup}
                  inputProps={{ placeholder: 'Ville' }}
                />
                <FormInput
                  control={control}
                  name="country"
                  label="Pays"
                  containerStyle={styles.formGroup}
                  inputProps={{ placeholder: 'Pays' }}
                />
              </View>

              <FormInput
                control={control}
                name="phone"
                label="Téléphone"
                inputProps={{
                  placeholder: '+33 6 12 34 56 78',
                  keyboardType: 'phone-pad',
                }}
              />

              <FormInput
                control={control}
                name="bio"
                label="Biographie"
                inputProps={{
                  placeholder: 'Parlez-nous un peu de vous...',
                  multiline: true,
                  numberOfLines: 4,
                  style: { minHeight: 100, textAlignVertical: 'top' },
                }}
              />

              <FormTagInput
                control={control}
                name="languages"
                label="Langues parlées"
                placeholder="Ajouter une langue"
                tagStyle="primary"
              />

              <FormTagInput
                control={control}
                name="skills"
                label="Compétences / Tags"
                placeholder="Ajouter une compétence"
                tagStyle="success"
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSubmit(onSubmit)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFF" />
                    <Text style={styles.saveButtonText}>Enregistrer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {formValues.bio && (
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                  <Text style={[styles.bio, { color: colors.text }]}>{formValues.bio}</Text>
                </View>
              )}

              <View style={[styles.infoSection, { borderTopColor: colors.border }]}>
                <View style={styles.infoItem}>
                  <Mail size={16} color={colors.textSecondary} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>{user.email}</Text>
                </View>
                {(formValues.city || formValues.country) && (
                  <View style={styles.infoItem}>
                    <MapPin size={16} color={colors.textSecondary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      {[formValues.city, formValues.country].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}
                {formValues.phone && (
                  <View style={styles.infoItem}>
                    <Phone size={16} color={colors.textSecondary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{formValues.phone}</Text>
                  </View>
                )}
                <View style={styles.infoItem}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    Membre depuis {new Date(user.created_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              </View>

              {formValues.languages.length > 0 && (
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Langues</Text>
                  <View style={styles.tags}>
                    {formValues.languages.map((lang) => (
                      <View key={lang} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.tagText, { color: colors.primary }]}>{lang}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {formValues.skills.length > 0 && (
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Compétences</Text>
                  <View style={styles.tags}>
                    {formValues.skills.map((skill) => (
                      <View key={skill} style={[styles.tag, styles.skillTag, { backgroundColor: colors.successLight }]}>
                        <Text style={[styles.tagText, styles.skillTagText, { color: colors.success }]}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={[styles.verificationSection, { borderTopColor: colors.border }]}>
                <View style={styles.verificationHeader}>
                  <Shield size={20} color={colors.primary} />
                  <Text style={[styles.verificationTitle, { color: colors.text }]}>Vérification du profil</Text>
                </View>
                {user.verification_status === 'verified' ? (
                  <View style={[styles.verificationStatus, { backgroundColor: colors.successLight }]}>
                    <CheckCircle size={24} color={colors.success} />
                    <View>
                      <Text style={[styles.verificationStatusTitle, { color: colors.text }]}>Profil vérifié</Text>
                      <Text style={[styles.verificationStatusText, { color: colors.textSecondary }]}>Votre identité a été confirmée</Text>
                    </View>
                  </View>
                ) : user.verification_status === 'pending' ? (
                  <View style={[styles.verificationStatus, { backgroundColor: colors.warningLight }]}>
                    <Clock size={24} color={colors.warning} />
                    <View>
                      <Text style={[styles.verificationStatusTitle, { color: colors.text }]}>Vérification en cours</Text>
                      <Text style={[styles.verificationStatusText, { color: colors.textSecondary }]}>Votre document est en cours d'examen</Text>
                    </View>
                  </View>
                ) : user.verification_status === 'rejected' ? (
                  <View style={[styles.verificationStatus, { backgroundColor: colors.errorLight }]}>
                    <XCircle size={24} color={colors.error} />
                    <View>
                      <Text style={[styles.verificationStatusTitle, { color: colors.text }]}>Vérification refusée</Text>
                      <Text style={[styles.verificationStatusText, { color: colors.textSecondary }]}>Vous pouvez soumettre un nouveau document</Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.verificationPrompt, { backgroundColor: colors.background }]}>
                    <Text style={[styles.verificationPromptText, { color: colors.text }]}>
                      Faites vérifier votre profil pour gagner la confiance des autres membres.
                    </Text>
                    <TouchableOpacity
                      style={[styles.verificationButton, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        Alert.alert('Info', 'Fonctionnalité de vérification à venir');
                      }}
                    >
                      <Shield size={16} color="#FFF" />
                      <Text style={styles.verificationButtonText}>Envoyer un document</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={[styles.statsSection, { borderTopColor: colors.border }]}>
                <View style={styles.statsCards}>
                  <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.statCardValue, { color: colors.primary }]}>{listingsCount}</Text>
                    <Text style={[styles.statCardLabel, { color: colors.textTertiary }]}>ANNONCES</Text>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.statCardValue, { color: colors.primary }]}>{reviews.length}</Text>
                    <Text style={[styles.statCardLabel, { color: colors.textTertiary }]}>AVIS</Text>
                  </View>
                  <View style={[styles.statCard, styles.statCardAccent, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.statCardValue, { color: colors.onSecondary }]}>
                      {reviews.length > 0
                        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                        : '-'}
                    </Text>
                    <Text style={[styles.statCardLabel, { color: colors.onSecondary }]}>NOTE</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.reviewsSection, { borderTopColor: colors.border }]}>
                <View style={styles.reviewsSectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Avis reçus ({reviews.length})</Text>
                  {reviews.length > 2 && (
                    <TouchableOpacity
                      onPress={() => {
                        // @ts-ignore - Route dynamique
                        router.push(`/reviews/${user.id}`);
                      }}
                      style={styles.seeMoreButton}
                    >
                      <Text style={[styles.seeMoreText, { color: colors.primary }]}>Voir plus</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {reviewsLoading ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : reviews.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun avis pour le moment</Text>
                ) : (
                  <View style={styles.reviewsList}>
                    {reviews.slice(0, 2).map((review) => (
                      <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.reviewHeader}>
                          {review.reviewer?.avatar_url ? (
                            <Image
                              source={{ uri: review.reviewer.avatar_url }}
                              style={styles.reviewerAvatar}
                            />
                          ) : (
                            <View style={styles.reviewerAvatarPlaceholder}>
                              <Text style={styles.reviewerAvatarText}>
                                {review.reviewer?.display_name?.[0]?.toUpperCase() || '?'}
                              </Text>
                            </View>
                          )}
                          <View style={styles.reviewerInfo}>
                            <Text style={[styles.reviewerName, { color: colors.text }]}>
                              {review.reviewer?.display_name || 'Utilisateur'}
                            </Text>
                            <View style={styles.reviewStars}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={14}
                                  color={star <= review.rating ? colors.secondary : colors.border}
                                  fill={star <= review.rating ? colors.secondary : 'transparent'}
                                />
                              ))}
                            </View>
                          </View>
                        </View>
                        {review.comment && (
                          <Text style={[styles.reviewComment, { color: colors.text }]}>{review.comment}</Text>
                        )}
                        {review.tags && review.tags.length > 0 && (
                          <View style={styles.reviewTags}>
                            {review.tags.map((tag) => (
                              <View key={tag} style={[styles.reviewTag, { backgroundColor: colors.primaryLight }]}>
                                <Text style={[styles.reviewTagText, { color: colors.primary }]}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>
                          {new Date(review.created_at).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}

          <View style={[styles.menuSection, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/exchanges')}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>Mes échanges</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/settings')}
            >
              <Settings size={20} color={colors.textSecondary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Paramètres</Text>
            </TouchableOpacity>
            {user.role === 'admin' || user.role === 'moderator' ? (
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                onPress={() => router.push('/admin')}
              >
                <Shield size={20} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.primary }]}>Administration</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={handleSignOut}
            >
              <LogOut size={20} color={colors.error} />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 100, // Espace pour la bottom bar fixe
  },
  profileCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  bannerContainer: {
    height: 160,
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2B86CC',
  },
  bannerEditButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bannerEditText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 16,
    paddingTop: 0,
    marginTop: -64,
  },
  profileInfoSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: '#FFF',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#2B86CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 48,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2B86CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  username: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 14,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  cancelEditText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    margin: 16,
    marginTop: 0,
  },
  errorText: {
    fontSize: 14,
  },
  successBox: {
    padding: 12,
    borderRadius: 8,
    margin: 16,
    marginTop: 0,
  },
  successText: {
    fontSize: 14,
  },
  editForm: {
    padding: 16,
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
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  skillTag: {
    // backgroundColor will be set dynamically
  },
  skillTagText: {
    // color will be set dynamically
  },
  addTagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addTagInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  addTagButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addTagButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 20,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
  },
  infoSection: {
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
  },
  verificationSection: {
    padding: 16,
    borderTopWidth: 1,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  verificationStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  verificationStatusText: {
    fontSize: 13,
  },
  verificationPrompt: {
    padding: 12,
    borderRadius: 12,
  },
  verificationPromptText: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  verificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 20,
  },
  verificationButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsSection: {
    padding: 16,
    borderTopWidth: 1,
  },
  statsCards: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statCardAccent: {
    borderWidth: 0,
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reviewsSection: {
    padding: 16,
    borderTopWidth: 1,
  },
  reviewsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeMoreButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2B86CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  reviewTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewTagText: {
    fontSize: 11,
  },
  reviewDate: {
    fontSize: 12,
  },
  menuSection: {
    padding: 16,
    borderTopWidth: 1,
    gap: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  centerContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
});

