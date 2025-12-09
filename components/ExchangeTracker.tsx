import { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { X, Package, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type ExchangeTrackerProps = {
  exchange: any;
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
};

const steps = [
  { id: 'not_started', label: 'Non démarré', icon: Clock },
  { id: 'in_progress', label: 'En cours', icon: Package },
  { id: 'delivered', label: 'Livré', icon: Truck },
  { id: 'confirmed', label: 'Confirmé', icon: CheckCircle },
];

export function ExchangeTracker({ exchange, visible, onClose, onUpdate }: ExchangeTrackerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);

  const proposal = exchange.contract?.proposal;
  const isFromUser = proposal?.from_user_id === user?.id;
  const currentStepIndex = steps.findIndex(s => s.id === exchange.status);

  const canMarkAsInProgress = exchange.status === 'not_started';
  const canMarkAsDelivered = exchange.status === 'in_progress';
  const canConfirm = exchange.status === 'delivered' && exchange.delivered_by !== user?.id;
  const canOpenDispute = exchange.status === 'delivered' || exchange.status === 'in_progress';

  async function handleStartExchange() {
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('exchanges')
        .update({ status: 'in_progress' })
        .eq('id', exchange.id);

      if (updateError) throw updateError;
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du démarrage');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsDelivered() {
    setLoading(true);
    setError('');

    try {
      if (!user?.id) {
        setError('Session expirée');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('exchanges')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivered_by: user.id,
        })
        .eq('id', exchange.id);

      if (updateError) throw updateError;
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la livraison');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!user?.id) {
      setError('Session expirée');
      return;
    }

    if (exchange.delivered_by === user.id) {
      setError('Vous ne pouvez pas confirmer votre propre livraison');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('exchanges')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', exchange.id);

      if (updateError) throw updateError;
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la confirmation');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenDispute() {
    if (!disputeReason.trim()) return;
    if (!user) {
      setError('Session expirée');
      return;
    }

    setDisputeLoading(true);
    setError('');

    try {
      const { error: disputeError } = await supabase
        .from('disputes')
        .insert({
          exchange_id: exchange.id,
          opened_by: user.id,
          reason: disputeReason,
          status: 'open',
        });

      if (disputeError) throw disputeError;
      setShowDisputeForm(false);
      setDisputeReason('');
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Impossible d\'ouvrir un litige');
    } finally {
      setDisputeLoading(false);
    }
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
            <Text style={styles.title}>Suivi de l'échange</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {error && (
              <View style={styles.errorBox}>
                <AlertCircle size={20} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.timeline}>
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <View key={step.id} style={styles.timelineStep}>
                    <View
                      style={[
                        styles.timelineIcon,
                        isCompleted && styles.timelineIconCompleted,
                        isCurrent && styles.timelineIconCurrent,
                      ]}
                    >
                      <Icon size={24} color={isCompleted || isCurrent ? '#FFF' : '#CBD5E1'} />
                    </View>
                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.timelineLabel,
                          (isCompleted || isCurrent) && styles.timelineLabelActive,
                        ]}
                      >
                        {step.label}
                      </Text>
                      {step.id === 'delivered' && isCurrent && exchange.delivered_at && (
                        <Text style={styles.timelineDate}>
                          Livré le {new Date(exchange.delivered_at).toLocaleDateString('fr-FR')}
                        </Text>
                      )}
                      {step.id === 'confirmed' && isCompleted && exchange.confirmed_at && (
                        <Text style={styles.timelineDate}>
                          Confirmé le {new Date(exchange.confirmed_at).toLocaleDateString('fr-FR')}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {exchange.due_date && (
              <View style={styles.dueDateBox}>
                <Clock size={20} color="#19ADFA" />
                <View>
                  <Text style={styles.dueDateLabel}>Date limite</Text>
                  <Text style={styles.dueDateText}>
                    {new Date(exchange.due_date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.actions}>
              {canMarkAsInProgress && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleStartExchange}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>Démarrer l'échange</Text>
                  )}
                </TouchableOpacity>
              )}

              {canMarkAsDelivered && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.deliveredButton]}
                  onPress={handleMarkAsDelivered}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>Marquer comme livré</Text>
                  )}
                </TouchableOpacity>
              )}

              {canConfirm && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.confirmButton]}
                  onPress={handleConfirmDelivery}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>Confirmer la réception</Text>
                  )}
                </TouchableOpacity>
              )}

              {canOpenDispute && !exchange.dispute && (
                <>
                  {!showDisputeForm ? (
                    <TouchableOpacity
                      style={styles.disputeButton}
                      onPress={() => setShowDisputeForm(true)}
                    >
                      <Text style={styles.disputeButtonText}>Ouvrir un litige</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.disputeForm}>
                      <TextInput
                        style={styles.disputeInput}
                        multiline
                        numberOfLines={4}
                        placeholder="Expliquez le problème..."
                        value={disputeReason}
                        onChangeText={setDisputeReason}
                        placeholderTextColor="#999"
                      />
                      <View style={styles.disputeActions}>
                        <TouchableOpacity
                          style={styles.disputeCancelButton}
                          onPress={() => {
                            setShowDisputeForm(false);
                            setDisputeReason('');
                          }}
                        >
                          <Text style={styles.disputeCancelText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.disputeSubmitButton}
                          onPress={handleOpenDispute}
                          disabled={disputeLoading || !disputeReason.trim()}
                        >
                          {disputeLoading ? (
                            <ActivityIndicator color="#FFF" />
                          ) : (
                            <Text style={styles.disputeSubmitText}>Envoyer</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}

              {exchange.dispute && (
                <View style={styles.disputeInfo}>
                  <AlertCircle size={20} color="#EF4444" />
                  <View>
                    <Text style={styles.disputeInfoTitle}>
                      Litige {exchange.dispute.status === 'resolved' ? 'résolu' : 'en cours'}
                    </Text>
                    <Text style={styles.disputeInfoText}>{exchange.dispute.reason}</Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 14,
  },
  timeline: {
    marginBottom: 24,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  timelineIconCompleted: {
    backgroundColor: '#10B981',
  },
  timelineIconCurrent: {
    backgroundColor: '#19ADFA',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 8,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 4,
  },
  timelineLabelActive: {
    color: '#1E293B',
  },
  timelineDate: {
    fontSize: 12,
    color: '#64748B',
  },
  dueDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  dueDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#19ADFA',
    marginBottom: 4,
  },
  dueDateText: {
    fontSize: 14,
    color: '#1E293B',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#19ADFA',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  deliveredButton: {
    backgroundColor: '#10B981',
  },
  confirmButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disputeButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 20,
    alignItems: 'center',
  },
  disputeButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  disputeForm: {
    gap: 12,
  },
  disputeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  disputeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  disputeCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  disputeCancelText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  disputeSubmitButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  disputeSubmitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disputeInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
  },
  disputeInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  disputeInfoText: {
    fontSize: 14,
    color: '#991B1B',
  },
});

