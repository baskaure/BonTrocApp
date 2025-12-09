import { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { X, FileText, CheckCircle, Download } from 'lucide-react-native';
import { supabase, Contract } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type ContractModalProps = {
  contract: Contract & {
    proposal?: {
      from_user_id: string;
      to_user_id: string;
      from_user?: { display_name: string };
      to_user?: { display_name: string };
    };
  };
  visible: boolean;
  onClose: () => void;
  onAccepted: () => void;
};

export function ContractModal({ contract, visible, onClose, onAccepted }: ContractModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFullContract, setShowFullContract] = useState(false);
  const [hasReadAndAccepted, setHasReadAndAccepted] = useState(false);

  const isFromUser = contract.proposal?.from_user_id === user?.id;
  const hasUserAccepted = isFromUser ? !!contract.accepted_by_from_at : !!contract.accepted_by_to_at;
  const hasOtherAccepted = isFromUser ? !!contract.accepted_by_to_at : !!contract.accepted_by_from_at;
  const otherPartyName = isFromUser
    ? contract.proposal?.to_user?.display_name
    : contract.proposal?.from_user?.display_name;

  async function handleAccept() {
    if (hasUserAccepted) {
      setError('Vous avez déjà accepté ce contrat.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: currentContract } = await supabase
        .from('contracts')
        .select('accepted_by_from_at, accepted_by_to_at')
        .eq('id', contract.id)
        .single();

      if (!currentContract) {
        throw new Error('Contrat introuvable');
      }

      const alreadyAccepted = isFromUser
        ? !!currentContract.accepted_by_from_at
        : !!currentContract.accepted_by_to_at;

      if (alreadyAccepted) {
        setError('Vous avez déjà accepté ce contrat.');
        setLoading(false);
        onAccepted();
        return;
      }

      const updateField = isFromUser ? 'accepted_by_from_at' : 'accepted_by_to_at';

      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          [updateField]: new Date().toISOString(),
        })
        .eq('id', contract.id);

      if (updateError) throw updateError;

      const { data: updatedContract } = await supabase
        .from('contracts')
        .select('accepted_by_from_at, accepted_by_to_at')
        .eq('id', contract.id)
        .single();

      if (updatedContract?.accepted_by_from_at && updatedContract?.accepted_by_to_at) {
        await supabase
          .from('contracts')
          .update({ status: 'active' })
          .eq('id', contract.id);
      }

      onAccepted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'acceptation');
    } finally {
      setLoading(false);
    }
  }

  async function downloadContract() {
    try {
      const fileUri = FileSystem.documentDirectory + `contrat-${contract.id}.html`;
      await FileSystem.writeAsStringAsync(fileUri, contract.html_content);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Info', 'Le partage de fichiers n\'est pas disponible sur cet appareil');
      }
    } catch (err) {
      console.error('Error downloading contract:', err);
      Alert.alert('Erreur', 'Impossible de télécharger le contrat');
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
            <View style={styles.headerTitle}>
              <FileText size={24} color="#19ADFA" />
              <Text style={styles.title}>Contrat d'échange</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.statusBox}>
              <Text style={styles.statusTitle}>Statut des signatures électroniques</Text>
              <View style={styles.statusItem}>
                {hasUserAccepted ? (
                  <CheckCircle size={20} color="#10B981" />
                ) : (
                  <View style={styles.statusPending} />
                )}
                <Text style={[styles.statusText, hasUserAccepted && styles.statusTextAccepted]}>
                  Vous: {hasUserAccepted ? 'Accepté' : 'En attente'}
                </Text>
              </View>
              <View style={styles.statusItem}>
                {hasOtherAccepted ? (
                  <CheckCircle size={20} color="#10B981" />
                ) : (
                  <View style={styles.statusPending} />
                )}
                <Text style={[styles.statusText, hasOtherAccepted && styles.statusTextAccepted]}>
                  {otherPartyName}: {hasOtherAccepted ? 'Accepté' : 'En attente'}
                </Text>
              </View>

              {hasUserAccepted && hasOtherAccepted && (
                <View style={styles.successBox}>
                  <CheckCircle size={20} color="#10B981" />
                  <Text style={styles.successText}>
                    Contrat entièrement signé électroniquement et désormais actif.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.contractSection}>
              <View style={styles.contractHeader}>
                <Text style={styles.contractTitle}>Contenu du contrat</Text>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={downloadContract}
                >
                  <Download size={16} color="#19ADFA" />
                  <Text style={styles.downloadText}>Télécharger</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={[styles.contractContent, !showFullContract && styles.contractContentCollapsed]}
                nestedScrollEnabled={true}
              >
                <Text style={styles.contractHtml}>
                  {contract.html_content.replace(/<[^>]*>/g, ' ').substring(0, showFullContract ? undefined : 500)}
                  {!showFullContract && '...'}
                </Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setShowFullContract(!showFullContract)}
              >
                <Text style={styles.toggleButtonText}>
                  {showFullContract ? 'Réduire' : 'Voir le contrat complet'}
                </Text>
              </TouchableOpacity>
            </View>

            {!hasUserAccepted ? (
              <View style={styles.acceptSection}>
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    La signature est réalisée directement sur BonTroc : en cochant la case ci-dessous
                    puis en cliquant sur « Signer le contrat », vous apposez votre signature
                    électronique simple sur ce contrat. Le contrat deviendra actif une fois que les deux
                    parties l'auront signé.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setHasReadAndAccepted(!hasReadAndAccepted)}
                >
                  <View style={[styles.checkbox, hasReadAndAccepted && styles.checkboxChecked]}>
                    {hasReadAndAccepted && <CheckCircle size={16} color="#10B981" />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    J'ai lu l'intégralité de ce contrat, j'en comprends les termes et conditions, et je
                    reconnais que mon clic sur le bouton ci-dessous vaut signature électronique et accord
                    ferme sur ce contrat.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.signButton, (!hasReadAndAccepted || loading) && styles.signButtonDisabled]}
                  onPress={handleAccept}
                  disabled={loading || !hasReadAndAccepted}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <CheckCircle size={20} color="#FFF" />
                      <Text style={styles.signButtonText}>Signer électroniquement ce contrat</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.acceptedBox}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={styles.acceptedText}>
                  Vous avez déjà accepté ce contrat
                  {hasOtherAccepted
                    ? '. L\'échange peut maintenant commencer.'
                    : '. En attente de l\'acceptation de l\'autre partie.'}
                </Text>
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Contrat généré le {new Date(contract.created_at).toLocaleDateString('fr-FR')}
              </Text>
              <Text style={styles.footerText}>ID: {contract.id}</Text>
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
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  statusBox: {
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#19ADFA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusPending: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  statusText: {
    fontSize: 14,
    color: '#475569',
  },
  statusTextAccepted: {
    color: '#059669',
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#065F46',
    fontWeight: '600',
  },
  contractSection: {
    marginBottom: 20,
  },
  contractHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contractTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadText: {
    fontSize: 14,
    color: '#19ADFA',
    fontWeight: '600',
  },
  contractContent: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    maxHeight: 200,
  },
  contractContentCollapsed: {
    maxHeight: 100,
  },
  contractHtml: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  toggleButton: {
    marginTop: 8,
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#19ADFA',
    fontWeight: '600',
  },
  acceptSection: {
    marginBottom: 20,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 20,
  },
  signButtonDisabled: {
    opacity: 0.5,
  },
  signButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  acceptedText: {
    flex: 1,
    fontSize: 14,
    color: '#065F46',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
});

