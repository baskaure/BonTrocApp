import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Star, CheckCircle } from 'lucide-react-native';

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

export default function ReviewScreen() {
  const { exchangeId } = useLocalSearchParams<{ exchangeId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [exchange, setExchange] = useState<any>(null);
  const [revieweeName, setRevieweeName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (exchangeId) {
      loadExchange();
    }
  }, [exchangeId]);

  async function loadExchange() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exchanges')
        .select(`
          *,
          contract:contracts(
            proposal:proposals(
              from_user_id,
              to_user_id,
              from_user:users!proposals_from_user_id_fkey(display_name),
              to_user:users!proposals_to_user_id_fkey(display_name)
            )
          )
        `)
        .eq('id', exchangeId)
        .single();

      if (error) throw error;

      setExchange(data);

      // Déterminer qui est l'autre partie
      const proposal = data?.contract?.proposal;
      if (proposal && user) {
        const otherUserId = proposal.from_user_id === user.id ? proposal.to_user_id : proposal.from_user_id;
        const otherUser = proposal.from_user_id === user.id ? proposal.to_user : proposal.from_user;
        setRevieweeName(otherUser?.display_name || 'Utilisateur');
      }

      // Vérifier si l'utilisateur a déjà laissé un avis
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('exchange_id', exchangeId)
        .eq('reviewer_id', user?.id)
        .single();

      if (existingReview) {
        Alert.alert('Avis déjà laissé', 'Vous avez déjà laissé un avis pour cet échange.');
        router.back();
      }
    } catch (err: any) {
      console.error('Error loading exchange:', err);
      setError('Impossible de charger l\'échange.');
    } finally {
      setLoading(false);
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  async function handleSubmit() {
    if (rating === 0) {
      setError('Veuillez donner une note');
      return;
    }

    if (!exchange || !user) {
      setError('Données manquantes');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const proposal = exchange.contract?.proposal;
      if (!proposal) {
        throw new Error('Proposition introuvable');
      }

      const revieweeId = proposal.from_user_id === user.id ? proposal.to_user_id : proposal.from_user_id;

      const { error: reviewError } = await supabase.from('reviews').insert({
        exchange_id: exchange.id,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || null,
        tags: selectedTags,
      });

      if (reviewError) throw reviewError;

      // Mettre à jour la note moyenne de l'utilisateur
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
        router.back();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de l\'avis');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <CheckCircle size={64} color={colors.success} />
          <Text style={[styles.successTitle, { color: colors.text }]}>Merci pour votre avis !</Text>
          <Text style={[styles.successText, { color: colors.textSecondary }]}>
            Votre retour a été publié avec succès et aide la communauté BonTroc.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Laisser un avis</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.description, { color: colors.text }]}>
            Comment s'est passé votre échange avec <Text style={styles.bold}>{revieweeName}</Text> ?
          </Text>

          <View style={styles.ratingSection}>
            <Text style={[styles.label, { color: colors.text }]}>Note globale *</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
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
                <Text style={[styles.ratingText, { color: colors.text }]}>{rating}/5</Text>
              )}
            </View>
          </View>

          <View style={styles.tagsSection}>
            <Text style={[styles.label, { color: colors.text }]}>Points forts (optionnel)</Text>
            <View style={styles.tags}>
              {REVIEW_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selectedTags.includes(tag) && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                  ]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text
                    style={[
                      styles.tagText,
                      { color: colors.text },
                      selectedTags.includes(tag) && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.commentSection}>
            <Text style={[styles.label, { color: colors.text }]}>Commentaire (optionnel)</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
              multiline
              numberOfLines={4}
              placeholder="Partagez votre expérience avec la communauté..."
              value={comment}
              onChangeText={setComment}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="default"
              blurOnSubmit={true}
              textAlignVertical="top"
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Votre avis sera visible publiquement sur le profil de {revieweeName}
            </Text>
          </View>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              (submitting || rating === 0) && { opacity: 0.5 },
            ]}
            onPress={handleSubmit}
            disabled={submitting || rating === 0}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Publier l'avis</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  bold: {
    fontWeight: 'bold',
  },
  ratingSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
  },
  tagText: {
    fontSize: 14,
  },
  commentSection: {
    marginBottom: 24,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

