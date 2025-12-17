import { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { X, Upload, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

type CreateListingModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CreateListingModal({ visible, onClose, onSuccess }: CreateListingModalProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const resetForm = () => {
    setFormData({
      type: 'service',
      title: '',
      description_offer: '',
      desired_exchange_desc: '',
      mode: 'both',
      estimation_min: '',
      estimation_max: '',
    });
    setImages([]);
    setError('');
    setUploading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const [formData, setFormData] = useState({
    type: 'service' as 'service' | 'product',
    title: '',
    description_offer: '',
    desired_exchange_desc: '',
    mode: 'both' as 'remote' | 'on_site' | 'both',
    estimation_min: '',
    estimation_max: '',
  });

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
      setError('');

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
        setError(err.message || "Échec du téléversement des images");
        Alert.alert('Erreur', err.message || "Échec du téléversement des images");
      } finally {
        setUploading(false);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const { data: listingData, error: insertError } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          type: formData.type,
          title: formData.title,
          description_offer: formData.description_offer,
          desired_exchange_desc: formData.desired_exchange_desc,
          mode: formData.mode,
          estimation_min: formData.estimation_min ? parseFloat(formData.estimation_min) : null,
          estimation_max: formData.estimation_max ? parseFloat(formData.estimation_max) : null,
          status: 'published',
          location_lat: user.geo_lat,
          location_lng: user.geo_lng,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Upload des images
      if (listingData?.id && images.length > 0) {
        const mediaPromises = images.map((url, index) =>
          supabase.from('listing_media').insert({
            listing_id: listingData.id,
            url: url,
            type: 'image',
            sort_order: index,
          })
        );

        const results = await Promise.all(mediaPromises);
        const hasError = results.some(({ error }) => error);
        if (hasError) {
          console.error('Erreur lors de l\'upload des médias');
        }
      }

      setFormData({
        type: 'service',
        title: '',
        description_offer: '',
        desired_exchange_desc: '',
        mode: 'both',
        estimation_min: '',
        estimation_max: '',
      });
      resetForm();

      onSuccess();
      handleClose();
      Alert.alert('Succès', 'Annonce créée avec succès !');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
      Alert.alert('Erreur', err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Créer une annonce</Text>
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Photos (max 5)</Text>
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
                      <>
                        <Upload size={24} color={colors.primary} />
                        <Text style={[styles.addImageText, { color: colors.primary }]}>Ajouter</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              {images.length === 0 && (
                <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                  Ajoutez jusqu'à 5 photos pour illustrer votre annonce
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Type d'annonce</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    { borderColor: colors.border },
                    formData.type === 'service' && { borderColor: colors.primary, backgroundColor: colors.primaryLight }
                  ]}
                  onPress={() => setFormData({ ...formData, type: 'service' })}
                >
                  <Text style={[
                    styles.radioText,
                    { color: colors.textSecondary },
                    formData.type === 'service' && { color: colors.primary }
                  ]}>
                    Service
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    { borderColor: colors.border },
                    formData.type === 'product' && { borderColor: colors.primary, backgroundColor: colors.primaryLight }
                  ]}
                  onPress={() => setFormData({ ...formData, type: 'product' })}
                >
                  <Text style={[
                    styles.radioText,
                    { color: colors.textSecondary },
                    formData.type === 'product' && { color: colors.primary }
                  ]}>
                    Produit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Titre de l'annonce</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="Ex: Cours de guitare débutant"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Ce que vous offrez</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.description_offer}
                onChangeText={(text) => setFormData({ ...formData, description_offer: text })}
                placeholder="Décrivez en détail ce que vous proposez..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Ce que vous recherchez en échange</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.desired_exchange_desc}
                onChangeText={(text) => setFormData({ ...formData, desired_exchange_desc: text })}
                placeholder="Décrivez ce que vous aimeriez recevoir en échange..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Mode d'échange</Text>
              <View style={[styles.selectContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.selectText, { color: colors.text }]}>
                  {formData.mode === 'both' ? 'Présentiel et À distance' : 
                   formData.mode === 'on_site' ? 'Présentiel uniquement' : 
                   'À distance uniquement'}
                </Text>
              </View>
              <View style={styles.modeButtons}>
                {['both', 'on_site', 'remote'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeButton,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      formData.mode === mode && { borderColor: colors.primary, backgroundColor: colors.primaryLight }
                    ]}
                    onPress={() => setFormData({ ...formData, mode: mode as any })}
                  >
                    <Text style={[
                      styles.modeButtonText,
                      { color: colors.textSecondary },
                      formData.mode === mode && { color: colors.primary, fontWeight: '600' }
                    ]}>
                      {mode === 'both' ? 'Les deux' : mode === 'on_site' ? 'Présentiel' : 'Distance'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={handleClose}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading || !formData.title || !formData.description_offer || !formData.desired_exchange_desc}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Publier l'annonce</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
  },
  scrollView: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
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
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  radioButton: {
    flex: 1,
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  radioText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  selectText: {
    fontSize: 16,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: 14,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 20,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
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
    gap: 4,
  },
  addImageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
});

