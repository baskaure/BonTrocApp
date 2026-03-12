import { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { X, Upload } from 'lucide-react-native';
import { FormInput } from '@/components/ui/FormInput';
import { createListingSchema, CreateListingFormData } from '@/lib/validations/listing';
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

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateListingFormData>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      type: 'service',
      title: '',
      description_offer: '',
      desired_exchange_desc: '',
      mode: 'both',
      estimation_min: '',
      estimation_max: '',
    },
  });

  const formValues = watch();

  const resetForm = () => {
    reset();
    setImages([]);
    setError('');
    setUploading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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
      // @ts-ignore - MediaTypeOptions est déprécié mais fonctionne toujours
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

  const onSubmit = async (data: CreateListingFormData) => {
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const { data: listingData, error: insertError } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          type: data.type,
          title: data.title,
          description_offer: data.description_offer,
          desired_exchange_desc: data.desired_exchange_desc,
          mode: data.mode,
          estimation_min: data.estimation_min ? parseFloat(data.estimation_min) : null,
          estimation_max: data.estimation_max ? parseFloat(data.estimation_max) : null,
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
                {(['service', 'product'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.radioButton,
                      { borderColor: colors.border },
                      formValues.type === type && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => setValue('type', type)}
                  >
                    <Text
                      style={[
                        styles.radioText,
                        { color: colors.textSecondary },
                        formValues.type === type && { color: colors.primary },
                      ]}
                    >
                      {type === 'service' ? 'Service' : 'Produit'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <FormInput
              control={control}
              name="title"
              label="Titre de l'annonce"
              error={errors.title}
              inputProps={{ placeholder: 'Ex: Cours de guitare débutant' }}
            />

            <FormInput
              control={control}
              name="description_offer"
              label="Ce que vous offrez"
              error={errors.description_offer}
              inputProps={{
                placeholder: 'Décrivez en détail ce que vous proposez...',
                multiline: true,
                numberOfLines: 4,
                textAlignVertical: 'top',
                style: { minHeight: 100 },
              }}
            />

            <FormInput
              control={control}
              name="desired_exchange_desc"
              label="Ce que vous recherchez en échange"
              error={errors.desired_exchange_desc}
              inputProps={{
                placeholder: 'Décrivez ce que vous aimeriez recevoir en échange...',
                multiline: true,
                numberOfLines: 4,
                textAlignVertical: 'top',
                style: { minHeight: 100 },
              }}
            />

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Mode d'échange</Text>
              <View style={styles.modeButtons}>
                {(['both', 'on_site', 'remote'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeButton,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      formValues.mode === mode && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => setValue('mode', mode)}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        { color: colors.textSecondary },
                        formValues.mode === mode && { color: colors.primary, fontWeight: '600' },
                      ]}
                    >
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
              onPress={handleSubmit(onSubmit)}
              disabled={loading || !formValues.title || !formValues.description_offer || !formValues.desired_exchange_desc}
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

