import { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, AlertTriangle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { FormInput } from './ui/FormInput';
import { reportSchema, ReportFormData } from '@/lib/validations/report';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'inappropriate', label: 'Contenu inapproprié' },
  { value: 'fraud', label: 'Arnaque ou fraude' },
  { value: 'harassment', label: 'Harcèlement' },
  { value: 'fake', label: 'Faux profil ou annonce' },
  { value: 'other', label: 'Autre' },
];

type ReportModalProps = {
  visible: boolean;
  onClose: () => void;
  targetType: 'listing' | 'user' | 'proposal' | 'chat';
  targetId: string;
  targetUserId?: string;
};

export function ReportModal({ visible, onClose, targetType, targetId, targetUserId }: ReportModalProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: { reason: undefined, details: '' },
  });

  const reason = watch('reason');

  const onSubmit = async (data: ReportFormData) => {
    if (!user) return;

    setLoading(true);

    try {
      const reportData: any = {
        reporter_id: user.id,
        reason: data.reason,
        details: data.details || undefined,
      };

      if (targetUserId) {
        reportData.reported_user_id = targetUserId;
      }

      if (targetType === 'listing') {
        reportData.listing_id = targetId;
      } else if (targetType === 'proposal') {
        reportData.proposal_id = targetId;
      } else if (targetType === 'chat') {
        reportData.chat_id = targetId;
      } else if (targetType === 'user') {
        reportData.reported_user_id = targetId;
      }

      const { error: insertError } = await supabase
        .from('reports')
        .insert(reportData);

      if (insertError) throw insertError;

      setSuccess(true);
      reset({ reason: undefined, details: '' });
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Erreur lors de l\'envoi du signalement');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (targetType) {
      case 'listing': return 'Signaler cette annonce';
      case 'user': return 'Signaler cet utilisateur';
      case 'proposal': return 'Signaler cette proposition';
      case 'chat': return 'Signaler cette conversation';
      default: return 'Signaler';
    }
  };

  if (!visible) return null;

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
            <View style={styles.headerTitle}>
              <AlertTriangle size={20} color={colors.error} />
              <Text style={[styles.title, { color: colors.error }]}>{getTitle()}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {success ? (
            <View style={styles.successContainer}>
              <View style={[styles.successIcon, { backgroundColor: colors.successLight }]}>
                <AlertTriangle size={32} color={colors.success} />
              </View>
              <Text style={[styles.successTitle, { color: colors.success }]}>Signalement envoyé !</Text>
              <Text style={[styles.successText, { color: colors.textSecondary }]}>Merci pour votre vigilance</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.reasonsSection}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Motif du signalement *</Text>
                <View style={styles.reasons}>
                  {REPORT_REASONS.map((r) => {
                    const selected = reason === r.value;
                    return (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        styles.reasonItem,
                        { borderColor: colors.border },
                        selected && { backgroundColor: colors.errorLight, borderColor: colors.error },
                      ]}
                      onPress={() => setValue('reason', r.value as 'spam' | 'inappropriate' | 'fraud' | 'harassment' | 'fake' | 'other')}
                    >
                      <View style={[
                        styles.radio,
                        { borderColor: colors.borderStrong },
                        selected && { borderColor: colors.error },
                      ]}>
                        {selected && <View style={[styles.radioInner, { backgroundColor: colors.error }]} />}
                      </View>
                      <Text style={[
                        styles.reasonText,
                        { color: colors.text },
                        selected && { color: colors.error, fontWeight: '600' },
                      ]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <FormInput
                control={control}
                name="details"
                label="Détails (optionnel)"
                inputProps={{
                  multiline: true,
                  numberOfLines: 3,
                  placeholder: 'Décrivez le problème...',
                  style: { minHeight: 100, textAlignVertical: 'top' },
                }}
              />
            </ScrollView>
          )}

          {!success && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.error }, (!reason || loading) && styles.submitButtonDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={!reason || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Signaler</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
    borderBottomColor: '#E7EDF3',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#D8463E',
  },
  scrollView: {
    padding: 20,
  },
  reasonsSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  reasons: {
    gap: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7EDF3',
  },
  reasonItemSelected: {
    backgroundColor: '#FBE7E5',
    borderColor: '#D8463E',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#D8463E',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D8463E',
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: '#3C4856',
  },
  reasonTextSelected: {
    color: '#D8463E',
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 20,
  },
  textArea: {
    backgroundColor: '#EEF2F6',
    borderWidth: 1,
    borderColor: '#E7EDF3',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E7EDF3',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7EDF3',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#3C4856',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#D8463E',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    padding: 40,
    alignItems: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCF2E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B9A5F',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#3C4856',
    textAlign: 'center',
  },
});

