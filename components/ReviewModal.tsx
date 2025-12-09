import { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { X, Star, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const proposal = exchange.contract?.proposal;
  const revieweeId = proposal?.from_user_id === user?.id
    ? proposal?.to_user_id
    : proposal?.from_user_id;
  const revieweeName = proposal?.from_user_id === user?.id
    ? proposal?.to_user?.display_name
    : proposal?.from_user?.display_name;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  async function handleSubmit() {
    if (rating === 0) {
      setError('Veuillez donner une note');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          exchange_id: exchange.id,
          reviewer_id: user?.id,
          reviewee_id: revieweeId,
          rating,
          comment: comment.trim() || null,
          tags: selectedTags,
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
            <CheckCircle size={64} color="#10B981" />
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
              <X size={24} color="#64748B" />
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
                    onPress={() => setRating(star)}
                    style={styles.starButton}
                  >
                    <Star
                      size={40}
                      color={star <= rating ? '#F59E0B' : '#CBD5E1'}
                      fill={star <= rating ? '#F59E0B' : 'transparent'}
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
              <Text style={styles.label}>Commentaire (optionnel)</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder="Partagez votre expérience avec la communauté..."
                value={comment}
                onChangeText={setComment}
                placeholderTextColor="#999"
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
              onPress={handleSubmit}
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFF',
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
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  scrollView: {
    padding: 20,
  },
  description: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 24,
  },
  bold: {
    fontWeight: '600',
    color: '#1E293B',
  },
  ratingSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
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
    color: '#1E293B',
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
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tagSelected: {
    backgroundColor: '#19ADFA',
    borderColor: '#19ADFA',
  },
  tagText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  tagTextSelected: {
    color: '#FFF',
  },
  commentSection: {
    marginBottom: 24,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#19ADFA',
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
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: '90%',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});

