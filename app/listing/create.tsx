import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase, errorMessage } from '@/lib/supabase';
import { pickImages, uploadImage, removeStorageObject } from '@/lib/image';
import { checkContent, blockedMessage } from '@/lib/moderation';
import { useStore } from '@/lib/store';
import { useCategories } from '@/lib/store/hooks';
import { ArrowLeft, Upload, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormInput } from '@/components/ui/FormInput';
import { createListingSchema, CreateListingFormData } from '@/lib/validations/listing';

export default function CreateListingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const { categories } = useCategories();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateListingFormData>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      type: 'service',
      title: '',
      description_offer: '',
      desired_exchange_desc: '',
      mode: 'both',
      category_id: '',
      estimation_min: '',
      estimation_max: '',
    },
  });

  const formValues = watch();

  const pickImage = async () => {
    if (!user) return;
    if (images.length >= 5) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez ajouter que 5 photos maximum');
      return;
    }

    setError('');
    try {
      const assets = await pickImages({ max: 5 - images.length });
      if (assets.length === 0) return;
      setUploading(true);
      // Redimensionnées et converties en JPEG avant envoi ; chemin images/<user_id>-… exigé par la policy.
      const uploaded: string[] = [];
      for (const asset of assets) {
        uploaded.push(await uploadImage({ bucket: 'listing-media', folder: 'images', userId: user.id, asset }));
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      const message = errorMessage(err, 'Échec du téléversement des images');
      setError(message);
      Alert.alert('Erreur', message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const url = images[index];
    setImages(images.filter((_, i) => i !== index));
    void removeStorageObject('listing-media', url);
  };

  const onSubmit = async (data: CreateListingFormData) => {
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      // Le serveur bloque les termes interdits (trigger moderate_row) ; on prévient avant l'envoi.
      const moderation = await checkContent(`${data.title}\n${data.description_offer}\n${data.desired_exchange_desc}`, user.id);
      if (moderation.hasBlock) {
        setError(blockedMessage(moderation, 'Votre annonce'));
        return;
      }

      const { data: listingData, error: insertError } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          type: data.type,
          title: data.title.trim(),
          description_offer: data.description_offer.trim(),
          desired_exchange_desc: data.desired_exchange_desc.trim(),
          mode: data.mode,
          category_id: data.category_id || null,
          estimation_min: data.estimation_min ? parseFloat(data.estimation_min) : null,
          estimation_max: data.estimation_max ? parseFloat(data.estimation_max) : null,
          status: 'published',
          location_lat: user.geo_lat ?? null,
          location_lng: user.geo_lng ?? null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Médias (l'URL doit pointer vers notre bucket : contrainte listing_media_url_allowed)
      if (listingData?.id && images.length > 0) {
        const { error: mediaError } = await supabase.from('listing_media').insert(
          images.map((url, index) => ({ listing_id: listingData.id, url, type: 'image', sort_order: index })),
        );
        if (mediaError) console.error('Erreur lors de l’enregistrement des médias :', mediaError.message);
      }

      useStore.getState().invalidateListings();

      Alert.alert('Succès', 'Annonce publiée !', [
        {
          text: 'OK',
          onPress: () => router.replace({ pathname: '/listing/[id]', params: { id: listingData.id } }),
        },
      ]);
    } catch (err) {
      const message = errorMessage(err, 'Une erreur est survenue');
      setError(message);
      Alert.alert('Erreur', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Créer une annonce</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                  style={[styles.addImageButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}
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
                Ajoutez jusqu’à 5 photos pour illustrer votre annonce
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Type d’annonce</Text>
            <View style={styles.radioGroup}>
              {(['service', 'product'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.radioButton,
                    { borderColor: colors.border, backgroundColor: colors.surface },
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

          {categories.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Catégorie</Text>
              <View style={styles.chips}>
                {categories.map((category) => {
                  const active = formValues.category_id === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        active && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                      ]}
                      onPress={() => setValue('category_id', active ? '' : category.id)}
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

          <FormInput
            control={control}
            name="title"
            label="Titre de l'annonce"
            error={errors.title}
            inputProps={{
              placeholder: 'Ex: Cours de guitare débutant',
              returnKeyType: 'next',
              blurOnSubmit: false,
              maxLength: 120,
            }}
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
              returnKeyType: 'next',
              blurOnSubmit: false,
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
              returnKeyType: 'done',
              onSubmitEditing: () => Keyboard.dismiss(),
              blurOnSubmit: true,
            }}
          />

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Mode d’échange</Text>
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
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={() => router.back()}
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
            <Text style={styles.submitButtonText}>Publier l’annonce</Text>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 9,
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
});

