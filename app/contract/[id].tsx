import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, CheckCircle, Download, ArrowLeft } from 'lucide-react-native';
import { supabase, Contract } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BottomNav } from '@/components/BottomNav';

export default function ContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [contract, setContract] = useState<Contract & {
    proposal?: {
      from_user_id: string;
      to_user_id: string;
      from_user?: { display_name: string };
      to_user?: { display_name: string };
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [hasReadAndAccepted, setHasReadAndAccepted] = useState(false);

  useEffect(() => {
    if (id) {
      loadContract();
    }
  }, [id]);

  async function loadContract() {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          proposal:proposals(
            *,
            from_user:users!proposals_from_user_id_fkey(display_name),
            to_user:users!proposals_to_user_id_fkey(display_name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setContract(data);
    } catch (err: any) {
      console.error('Error loading contract:', err);
      setError('Impossible de charger ce contrat.');
    } finally {
      setLoading(false);
    }
  }

  const reloadExchangeIfNeeded = async () => {
    // Trouver l'échange associé à ce contrat pour le recharger
    if (!contract?.id) return;
    
    try {
      const { data: exchangeData } = await supabase
        .from('exchanges')
        .select('id')
        .eq('contract_id', contract.id)
        .single();

      if (exchangeData) {
        // Simplement revenir en arrière, useFocusEffect rechargera silencieusement
        router.back();
      }
    } catch (err) {
      // Ignorer si l'échange n'existe pas encore
      console.log('Exchange not found for contract, continuing...');
    }
  };

  if (!contract) {
    if (loading) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <BottomNav />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Contrat</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error || 'Contrat introuvable'}</Text>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  const isFromUser = contract.proposal?.from_user_id === user?.id;
  const hasUserAccepted = isFromUser ? !!contract.accepted_by_from_at : !!contract.accepted_by_to_at;
  const hasOtherAccepted = isFromUser ? !!contract.accepted_by_to_at : !!contract.accepted_by_from_at;
  const otherPartyName = isFromUser
    ? contract.proposal?.to_user?.display_name
    : contract.proposal?.from_user?.display_name;

  async function handleAccept() {
    if (!contract) return;
    if (hasUserAccepted) {
      setError('Vous avez déjà accepté ce contrat.');
      return;
    }

    setActionLoading(true);
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
        setActionLoading(false);
        loadContract();
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

      Alert.alert('Succès', 'Contrat signé avec succès !');
      await loadContract();
      // Recharger la page échange après signature
      await reloadExchangeIfNeeded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'acceptation');
    } finally {
      setActionLoading(false);
    }
  }

  async function downloadContract() {
    if (!contract) return;
    try {
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <FileText size={20} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Contrat d'échange</Text>
        </View>
        <TouchableOpacity onPress={downloadContract} style={styles.downloadButton}>
          <Download size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {/* Statut des signatures */}
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

        {/* Contenu du contrat */}
        <View style={styles.contractSection}>
          <View style={styles.contractHeader}>
            <Text style={[styles.contractTitle, { color: colors.text }]}>Contenu du contrat</Text>
          </View>

          <View style={[styles.contractContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <WebView
              source={{ html: contract.html_content }}
              style={styles.webview}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
            />
          </View>
        </View>

        {/* Actions */}
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
                <View style={[
                  styles.checkbox, 
                  { borderColor: colors.border },
                  hasReadAndAccepted && { backgroundColor: colors.success, borderColor: colors.success }
                ]}>
                  {hasReadAndAccepted && <CheckCircle size={16} color="#FFF" />}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                  J'ai lu l'intégralité de ce contrat, j'en comprends les termes et conditions, et je reconnais que mon clic sur le bouton ci-dessous vaut signature électronique et accord ferme sur ce contrat.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.signButton, 
                  { backgroundColor: colors.success }, 
                  (!hasReadAndAccepted || actionLoading) && styles.signButtonDisabled
                ]}
                onPress={handleAccept}
                disabled={actionLoading || !hasReadAndAccepted}
              >
                {actionLoading ? (
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

          <Text style={[styles.contractInfo, { color: colors.textTertiary }]}>
            Contrat généré le {new Date(contract.created_at).toLocaleDateString('fr-FR')}
            {'\n'}ID: {contract.id}
          </Text>
        </View>
      </ScrollView>

      <BottomNav />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  downloadButton: {
    padding: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  errorBox: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
  },
  signatureStatus: {
    marginBottom: 24,
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
    marginBottom: 24,
  },
  contractHeader: {
    marginBottom: 12,
  },
  contractTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  contractContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 500,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  actionSection: {
    marginTop: 24,
    paddingTop: 24,
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
    lineHeight: 18,
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
  contractInfo: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
});

