import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase, Review } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Settings, LogOut, Star, Edit2, X, Check, Mail, Phone, MapPin, Calendar, Shield, Camera, ImageUp, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

type ReviewWithReviewer = Review & {
  reviewer?: { display_name: string; avatar_url?: string };
};

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [listingsCount, setListingsCount] = useState(0);
  const [mediaUploading, setMediaUploading] = useState({ avatar: false, banner: false });
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    phone: '',
    city: '',
    country: '',
    languages: [] as string[],
    skills: [] as string[],
    search_radius_km: 50,
    avatar_url: '',
    banner_url: '',
  });
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
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
      loadReviews();
      loadListingsCount();
    }
  }, [user]);

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

  async function loadReviews() {
    if (!user) return;
    setReviewsLoading(true);
    try {
      const { data } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:users!reviews_reviewer_id_fkey(display_name, avatar_url)
        `)
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setReviews(data);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  }

  const uploadProfileMedia = async (type: 'avatar' | 'banner') => {
    if (!user) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (result.canceled) return;

    setMediaUploading((prev) => ({ ...prev, [type]: true }));
    setError('');

    try {
      const file = result.assets[0];
      const fileExt = file.uri.split('.').pop() || 'jpg';
      const fileName = `${type}/${user.id}-${Date.now()}.${fileExt}`;

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any);

      const { data: { publicUrl }, error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, {
          uri: file.uri,
          type: `image/${fileExt}`,
        } as any, {
          upsert: true,
          contentType: `image/${fileExt}`,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(fileName);
      
      if (type === 'avatar') {
        setFormData((prev) => ({ ...prev, avatar_url: urlData.publicUrl }));
      } else {
        setFormData((prev) => ({ ...prev, banner_url: urlData.publicUrl }));
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du téléversement');
    } finally {
      setMediaUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: formData.display_name,
          username: formData.username,
          bio: formData.bio,
          phone: formData.phone,
          city: formData.city,
          country: formData.country,
          languages: formData.languages,
          skills: formData.skills,
          search_radius_km: formData.search_radius_km,
          avatar_url: formData.avatar_url,
          banner_url: formData.banner_url,
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
            await signOut();
            router.replace('/landing');
          },
        },
      ]
    );
  };

  if (!user) {
    return null;
  }

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.bannerContainer}>
            {formData.banner_url ? (
              <Image source={{ uri: formData.banner_url }} style={styles.banner} />
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
              {formData.avatar_url ? (
                <Image source={{ uri: formData.avatar_url }} style={[styles.avatar, { borderColor: colors.surface }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { borderColor: colors.surface }]}>
                  <Text style={styles.avatarText}>
                    {formData.display_name[0]?.toUpperCase() || 'U'}
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
              <Text style={[styles.name, { color: colors.text }]}>{formData.display_name}</Text>
              <Text style={[styles.username, { color: colors.textSecondary }]}>@{formData.username}</Text>
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
                  setFormData({
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
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Nom d'affichage *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={formData.display_name}
                    onChangeText={(text) => setFormData({ ...formData, display_name: text })}
                    placeholder="Votre nom"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Nom d'utilisateur *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={formData.username}
                    onChangeText={(text) => setFormData({ ...formData, username: text })}
                    placeholder="@username"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Ville</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={formData.city}
                    onChangeText={(text) => setFormData({ ...formData, city: text })}
                    placeholder="Ville"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Pays</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={formData.country}
                    onChangeText={(text) => setFormData({ ...formData, country: text })}
                    placeholder="Pays"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Téléphone</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="+33 6 12 34 56 78"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Biographie</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  multiline
                  numberOfLines={4}
                  value={formData.bio}
                  onChangeText={(text) => setFormData({ ...formData, bio: text })}
                  placeholder="Parlez-nous un peu de vous..."
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Langues parlées</Text>
                <View style={styles.tags}>
                  {formData.languages.map((lang) => (
                    <View key={lang} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.tagText, { color: colors.primary }]}>{lang}</Text>
                      <TouchableOpacity
                        onPress={() => setFormData({
                          ...formData,
                          languages: formData.languages.filter(l => l !== lang)
                        })}
                      >
                        <X size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.addTagRow}>
                  <TextInput
                    style={[styles.addTagInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={newLanguage}
                    onChangeText={setNewLanguage}
                    placeholder="Ajouter une langue"
                    placeholderTextColor={colors.textTertiary}
                    onSubmitEditing={() => {
                      if (newLanguage.trim() && !formData.languages.includes(newLanguage.trim())) {
                        setFormData({
                          ...formData,
                          languages: [...formData.languages, newLanguage.trim()]
                        });
                        setNewLanguage('');
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.addTagButton}
                    onPress={() => {
                      if (newLanguage.trim() && !formData.languages.includes(newLanguage.trim())) {
                        setFormData({
                          ...formData,
                          languages: [...formData.languages, newLanguage.trim()]
                        });
                        setNewLanguage('');
                      }
                    }}
                  >
                    <Text style={styles.addTagButtonText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Compétences / Tags</Text>
                <View style={styles.tags}>
                  {formData.skills.map((skill) => (
                    <View key={skill} style={[styles.tag, styles.skillTag, { backgroundColor: colors.successLight }]}>
                      <Text style={[styles.tagText, styles.skillTagText, { color: colors.success }]}>{skill}</Text>
                      <TouchableOpacity
                        onPress={() => setFormData({
                          ...formData,
                          skills: formData.skills.filter(s => s !== skill)
                        })}
                      >
                        <X size={14} color={colors.success} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.addTagRow}>
                  <TextInput
                    style={[styles.addTagInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={newSkill}
                    onChangeText={setNewSkill}
                    placeholder="Ajouter une compétence"
                    placeholderTextColor={colors.textTertiary}
                    onSubmitEditing={() => {
                      if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
                        setFormData({
                          ...formData,
                          skills: [...formData.skills, newSkill.trim()]
                        });
                        setNewSkill('');
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.addTagButton}
                    onPress={() => {
                      if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
                        setFormData({
                          ...formData,
                          skills: [...formData.skills, newSkill.trim()]
                        });
                        setNewSkill('');
                      }
                    }}
                  >
                    <Text style={styles.addTagButtonText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSubmit}
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
              {formData.bio && (
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                  <Text style={[styles.bio, { color: colors.text }]}>{formData.bio}</Text>
                </View>
              )}

              <View style={[styles.infoSection, { borderTopColor: colors.border }]}>
                <View style={styles.infoItem}>
                  <Mail size={16} color={colors.textSecondary} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>{user.email}</Text>
                </View>
                {(formData.city || formData.country) && (
                  <View style={styles.infoItem}>
                    <MapPin size={16} color={colors.textSecondary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      {[formData.city, formData.country].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}
                {formData.phone && (
                  <View style={styles.infoItem}>
                    <Phone size={16} color={colors.textSecondary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{formData.phone}</Text>
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

              {formData.languages.length > 0 && (
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Langues</Text>
                  <View style={styles.tags}>
                    {formData.languages.map((lang) => (
                      <View key={lang} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.tagText, { color: colors.primary }]}>{lang}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {formData.skills.length > 0 && (
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Compétences</Text>
                  <View style={styles.tags}>
                    {formData.skills.map((skill) => (
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
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Statistiques</Text>
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{listingsCount}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Annonces</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{reviews.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avis reçus</Text>
                  </View>
                  <View style={styles.stat}>
                    {reviews.length > 0 ? (
                      <View style={styles.statRating}>
                        <Star size={20} color={colors.secondary} fill={colors.secondary} />
                        <Text style={[styles.statValue, { color: colors.text }]}>
                          {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.statValue, { color: colors.text }]}>-</Text>
                    )}
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Note moyenne</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.reviewsSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Avis reçus ({reviews.length})</Text>
                {reviewsLoading ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : reviews.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun avis pour le moment</Text>
                ) : (
                  <View style={styles.reviewsList}>
                    {reviews.map((review) => (
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

      <BottomNav />
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
    paddingBottom: 16,
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
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#19ADFA',
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
  },
  avatarPlaceholder: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#F59E0B',
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
    backgroundColor: '#19ADFA',
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
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  reviewsSection: {
    padding: 16,
    borderTopWidth: 1,
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
    backgroundColor: '#F59E0B',
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

