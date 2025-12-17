import { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { X, FileText, CheckCircle, Download } from 'lucide-react-native';
import { supabase, Contract } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { WebView } from 'react-native-webview';
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
  const { colors } = useTheme();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'acceptation');
    } finally {
      setLoading(false);
    }
  }

  async function downloadContract() {
    try {
      // Créer un fichier HTML temporaire
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrat ${contract.id}</title>
</head>
<body>
  ${contract.html_content}
</body>
</html>
      `;

      const fileUri = `${FileSystem.documentDirectory}contrat-${contract.id}.html`;
      await FileSystem.writeAsStringAsync(fileUri, htmlContent, { encoding: FileSystem.EncodingType.UTF8 });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/html',
          dialogTitle: 'Partager le contrat',
        });
      } else {
        Alert.alert('Erreur', 'Le partage de fichiers n\'est pas disponible sur cet appareil.');
      }
    } catch (err) {
      console.error('Error downloading contract:', err);
      Alert.alert('Erreur', 'Impossible de télécharger le contrat.');
    }
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <FileText size={24} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Contrat d'échange
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            <View style={[styles.signatureStatus, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Text style={[styles.signatureStatusTitle, { color: colors.primary }]}>
                Statut des signatures électroniques
              </Text>
              <View style={styles.signatureRow}>
                {hasUserAccepted ? (
                  <CheckCircle size={20} color={colors.success} />
                ) : (
                  <View style={[styles.circle, { borderColor: colors.border }]} />
                )}
                <Text style={[styles.signatureText, { color: colors.text }]}>
                  Vous: {hasUserAccepted ? 'Accepté' : 'En attente'}
                </Text>
              </View>
              <View style={styles.signatureRow}>
                {hasOtherAccepted ? (
                  <CheckCircle size={20} color={colors.success} />
                ) : (
                  <View style={[styles.circle, { borderColor: colors.border }]} />
                )}
                <Text style={[styles.signatureText, { color: colors.text }]}>
                  {otherPartyName}: {hasOtherAccepted ? 'Accepté' : 'En attente'}
                </Text>
              </View>

              {hasUserAccepted && hasOtherAccepted && (
                <View style={[styles.successBox, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                  <Text style={[styles.successText, { color: colors.success }]}>
                    ✓ Contrat entièrement signé électroniquement sur BonTroc et désormais actif.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.contractSection}>
              <View style={styles.contractHeader}>
                <Text style={[styles.contractTitle, { color: colors.text }]}>Contenu du contrat</Text>
                <TouchableOpacity onPress={downloadContract} style={styles.downloadButton}>
                  <Download size={18} color={colors.primary} />
                  <Text style={[styles.downloadText, { color: colors.primary }]}>Télécharger</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.contractContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <WebView
                  source={{ html: contract.html_content }}
                  style={styles.webview}
                  scrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                />
              </View>

              <TouchableOpacity
                onPress={() => setShowFullContract(!showFullContract)}
                style={styles.toggleButton}
              >
                <Text style={[styles.toggleText, { color: colors.primary }]}>
                  {showFullContract ? 'Réduire' : 'Voir le contrat complet'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.actionSection, { borderTopColor: colors.border }]}>
              {!hasUserAccepted ? (
                <>
                  <View style={[styles.warningBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                    <Text style={[styles.warningText, { color: colors.warning }]}>
                      La signature est réalisée directement sur BonTroc : en cochant la case ci-dessous puis en cliquant sur « Signer le contrat », vous apposez votre signature électronique simple sur ce contrat. Le contrat deviendra actif une fois que les deux parties l'auront signé.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => setHasReadAndAccepted(!hasReadAndAccepted)}
                  >
                    <View style={[styles.checkbox, hasReadAndAccepted && { backgroundColor: colors.success, borderColor: colors.success }]}>
                      {hasReadAndAccepted && <CheckCircle size={16} color="#FFF" />}
                    </View>
                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                      J'ai lu l'intégralité de ce contrat, j'en comprends les termes et conditions, et je reconnais que mon clic sur le bouton ci-dessous vaut signature électronique et accord ferme sur ce contrat.
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.signButton, { backgroundColor: colors.success }, (!hasReadAndAccepted || loading) && styles.signButtonDisabled]}
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
                </>
              ) : (
                <View style={[styles.successBox, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                  <CheckCircle size={20} color={colors.success} />
                  <Text style={[styles.successText, { color: colors.success }]}>
                    Vous avez déjà accepté ce contrat
                    {hasOtherAccepted
                      ? '. L\'échange peut maintenant commencer.'
                      : '. En attente de l\'acceptation de l\'autre partie.'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.closeButtonText, { color: colors.text }]}>Fermer</Text>
              </TouchableOpacity>

              <Text style={[styles.contractInfo, { color: colors.textTertiary }]}>
                Contrat généré le {new Date(contract.created_at).toLocaleDateString('fr-FR')}
                {'\n'}ID: {contract.id}
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  errorBox: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
  },
  signatureStatus: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  signatureStatusTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  signatureText: {
    fontSize: 14,
  },
  successBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  contractSection: {
    margin: 16,
    marginTop: 0,
  },
  contractHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  contractTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  contractContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 400,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  toggleButton: {
    marginTop: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionSection: {
    margin: 16,
    marginTop: 0,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  warningBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxLabel: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  signButtonDisabled: {
    opacity: 0.5,
  },
  signButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  contractInfo: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
});
