import { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { X, AlertTriangle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;

    setLoading(true);

    try {
      const reportData: any = {
        reporter_id: user.id,
        reason,
        details: details || undefined,
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
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason('');
        setDetails('');
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
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <AlertTriangle size={20} color="#EF4444" />
              <Text style={styles.title}>{getTitle()}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {success ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <AlertTriangle size={32} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Signalement envoyé !</Text>
              <Text style={styles.successText}>Merci pour votre vigilance</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.reasonsSection}>
                <Text style={styles.label}>Motif du signalement *</Text>
                <View style={styles.reasons}>
                  {REPORT_REASONS.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        styles.reasonItem,
                        reason === r.value && styles.reasonItemSelected,
                      ]}
                      onPress={() => setReason(r.value)}
                    >
                      <View style={[
                        styles.radio,
                        reason === r.value && styles.radioSelected,
                      ]}>
                        {reason === r.value && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[
                        styles.reasonText,
                        reason === r.value && styles.reasonTextSelected,
                      ]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.detailsSection}>
                <Text style={styles.label}>Détails (optionnel)</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={3}
                  placeholder="Décrivez le problème..."
                  value={details}
                  onChangeText={setDetails}
                  placeholderTextColor="#999"
                />
              </View>
            </ScrollView>
          )}

          {!success && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (!reason || loading) && styles.submitButtonDisabled]}
                onPress={handleSubmit}
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
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
  },
  scrollView: {
    padding: 20,
  },
  reasonsSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
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
    borderColor: '#E2E8F0',
  },
  reasonItemSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
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
    borderColor: '#EF4444',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: '#475569',
  },
  reasonTextSelected: {
    color: '#991B1B',
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 20,
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
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#EF4444',
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
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});

