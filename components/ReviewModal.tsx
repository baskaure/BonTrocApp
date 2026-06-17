import { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Star, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme, Theme } from '@/lib/theme';
import { FormInput } from './ui/FormInput';
import { reviewSchema, ReviewFormData } from '@/lib/validations/review';

const REVIEW_TAGS = [
  'Ponctuel',
  'Qualité excellente',
  'Bonne communication',
  'Professionnel',
  'Sympathique',
  'Fiable',
  'Rapide',
  'Soigné',
];

type ReviewModalProps = {
  exchange: any;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function ReviewModal({ exchange, visible, onClose, onSuccess }: ReviewModalProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const { colors } = theme;
  const styles = makeStyles(theme);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: '', tags: [] },
  });

  const rating = watch('rating');
  const selectedTags = watch('tags') || [];

  const proposal = exchange.contract?.proposal;
  const revieweeId = proposal?.from_user_id === user?.id
    ? proposal?.to_user_id
    : proposal?.from_user_id;
  const revieweeName = proposal?.from_user_id === user?.id
    ? proposal?.to_user?.display_name
    : proposal?.from_user?.display_name;

  const toggleTag = (tag: string) => {
    const current = selectedTags;
    setValue('tags', current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
  };

  const onSubmit = async (data: ReviewFormData) => {
    setLoading(true);
    setError('');

    try {
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          exchange_id: exchange.id,
          reviewer_id: user?.id,
          reviewee_id: revieweeId,
          rating: data.rating,
          comment: data.comment?.trim() || null,
          tags: data.tags,
        });

      if (reviewError) throw reviewError;

      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', revieweeId);

      if (existingReviews) {
        const totalRating = existingReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = totalRating / existingReviews.length;

        await supabase
          .from('users')
          .update({
            rating_avg: avgRating,
            rating_count: existingReviews.length,
          })
          .eq('id', revieweeId);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de l\'avis');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.successModal}>
            <CheckCircle size={64} color={colors.success} />
            <Text style={styles.successTitle}>Merci pour votre avis !</Text>
            <Text style={styles.successText}>
              Votre retour a été publié avec succès et aide la communauté BonTroc.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Laisser un avis</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Comment s'est passé votre échange avec <Text style={styles.bold}>{revieweeName}</Text> ?
            </Text>

            <View style={styles.ratingSection}>
              <Text style={styles.label}>Note globale *</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setValue('rating', star)}
                    style={styles.starButton}
                  >
                    <Star
                      size={40}
                      color={star <= rating ? colors.secondary : colors.border}
                      fill={star <= rating ? colors.secondary : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
                {rating > 0 && (
                  <Text style={styles.ratingText}>{rating}/5</Text>
                )}
              </View>
            </View>

            <View style={styles.tagsSection}>
              <Text style={styles.label}>Points forts (optionnel)</Text>
              <View style={styles.tags}>
                {REVIEW_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tag,
                      selectedTags.includes(tag) && styles.tagSelected,
                    ]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        selectedTags.includes(tag) && styles.tagTextSelected,
                      ]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.commentSection}>
              <FormInput
                control={control}
                name="comment"
                label="Commentaire (optionnel)"
                inputProps={{
                  multiline: true,
                  numberOfLines: 4,
                  placeholder: 'Partagez votre expérience avec la communauté...',
                  returnKeyType: 'default',
                  blurOnSubmit: true,
                  style: { minHeight: 100, textAlignVertical: 'top' },
                }}
              />
              <Text style={styles.hint}>
                Votre avis sera visible publiquement sur le profil de {revieweeName}
              </Text>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, (loading || rating === 0) && styles.submitButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={loading || rating === 0}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Publier l'avis</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  const c = theme.colors;
  const { card } = theme.shadows;
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: c.surface,
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
    borderBottomColor: c.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: c.text,
  },
  scrollView: {
    padding: 20,
  },
  description: {
    fontSize: 15,
    color: c.textSecondary,
    marginBottom: 24,
  },
  bold: {
    fontWeight: '600',
    color: c.text,
  },
  ratingSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: c.textSecondary,
    marginBottom: 12,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: c.text,
    marginLeft: 12,
  },
  tagsSection: {
    marginBottom: 24,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceContainer,
  },
  tagSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  tagText: {
    fontSize: 13,
    color: c.textSecondary,
    fontWeight: '600',
  },
  tagTextSelected: {
    color: '#FFF',
  },
  commentSection: {
    marginBottom: 24,
  },
  textArea: {
    backgroundColor: c.surfaceContainer,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
    color: c.text,
  },
  hint: {
    fontSize: 12,
    color: c.textTertiary,
  },
  errorBox: {
    backgroundColor: c.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: c.error,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: c.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: c.primary,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successModal: {
    ...card,
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: '90%',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: c.text,
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
  },
  });
}

