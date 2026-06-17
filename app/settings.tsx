import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Lock, Bell, Shield, AlertTriangle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNewProposal: true,
    emailAcceptedProposal: true,
    emailNewMessage: true,
    emailWeeklyDigest: false,
  });

  useEffect(() => {
    if (user?.notification_settings) {
      setNotificationSettings((prev) => ({
        ...prev,
        ...user.notification_settings,
      }));
    }
  }, [user]);

  const handlePasswordChange = async () => {
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 10) {
      setError('Le mot de passe doit contenir au moins 10 caractères');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) throw updateError;

      setSuccess('Mot de passe modifié avec succès!');
      setPasswordData({
        newPassword: '',
        confirmPassword: '',
      });

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async (key: keyof typeof notificationSettings) => {
    const newSettings = {
      ...notificationSettings,
      [key]: !notificationSettings[key],
    };
    setNotificationSettings(newSettings);

    if (user) {
      await supabase
        .from('users')
        .update({ notification_settings: newSettings })
        .eq('id', user.id);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('users')
        .update({ status: 'deleted' })
        .eq('id', user.id);

      if (deleteError) throw deleteError;

      await signOut();
      router.replace('/landing');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression du compte');
      setLoading(false);
    }
  };

  const { colors, radius, shadows } = useTheme();

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Veuillez vous connecter pour accéder aux paramètres</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Paramètres</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={[styles.successBox, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.successText, { color: colors.success }]}>{success}</Text>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={styles.sectionHeader}>
            <Lock size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>SÉCURITÉ DU COMPTE</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Nouveau mot de passe</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
              placeholder="Minimum 6 caractères"
              secureTextEntry
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Confirmer le mot de passe</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
              placeholder="Retapez votre mot de passe"
              secureTextEntry
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handlePasswordChange}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Modifier le mot de passe</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={styles.sectionHeader}>
            <Bell size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>NOTIFICATIONS</Text>
          </View>

          <View style={[styles.notificationItem, { borderBottomColor: colors.border }]}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Nouvelles propositions</Text>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                Recevoir un email lors d'une nouvelle proposition
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailNewProposal}
              onValueChange={() => handleNotificationToggle('emailNewProposal')}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={[styles.notificationItem, { borderBottomColor: colors.border }]}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Propositions acceptées</Text>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                Notification quand votre proposition est acceptée
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailAcceptedProposal}
              onValueChange={() => handleNotificationToggle('emailAcceptedProposal')}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={[styles.notificationItem, { borderBottomColor: colors.border }]}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Nouveaux messages</Text>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                Alerte email pour les nouveaux messages
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailNewMessage}
              onValueChange={() => handleNotificationToggle('emailNewMessage')}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={[styles.notificationItem, { borderBottomColor: colors.border }]}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Résumé hebdomadaire</Text>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                Recevoir un résumé de vos activités chaque semaine
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailWeeklyDigest}
              onValueChange={() => handleNotificationToggle('emailWeeklyDigest')}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={styles.sectionHeader}>
            <Shield size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>CONFIDENTIALITÉ</Text>
          </View>

          <View style={styles.privacyItem}>
            <Text style={[styles.privacyTitle, { color: colors.text }]}>Télécharger mes données</Text>
            <Text style={[styles.privacyDescription, { color: colors.textSecondary }]}>
              Obtenez une copie de toutes vos données (conforme RGPD).
            </Text>
            <TouchableOpacity
              style={[styles.privacyButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                Alert.alert('Info', 'Fonctionnalité à venir');
              }}
            >
              <Text style={[styles.privacyButtonText, { color: colors.text }]}>Demander mes données</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={15} color={colors.error} />
            <Text style={[styles.sectionTitle, { color: colors.error }]}>ZONE SENSIBLE</Text>
          </View>
          {!showDeleteConfirm ? (
            <>
              <Text style={[styles.dangerHeading, { color: colors.error }]}>Supprimer mon compte</Text>
              <Text style={[styles.dangerDescription, { color: colors.error }]}>
                Action définitive : annonces, messages et historique seront supprimés.
              </Text>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: colors.error }]}
                onPress={() => setShowDeleteConfirm(true)}
              >
                <Text style={[styles.deleteButtonText, { color: '#FFF' }]}>Supprimer mon compte</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.deleteConfirm}>
              <View style={[styles.deleteWarning, { backgroundColor: colors.errorLight }]}>
                <AlertTriangle size={20} color={colors.error} />
                <View style={styles.deleteWarningText}>
                  <Text style={[styles.deleteWarningTitle, { color: colors.error }]}>Êtes-vous absolument sûr ?</Text>
                  <Text style={[styles.deleteWarningDescription, { color: colors.error }]}>
                    Cette action ne peut pas être annulée. Vos annonces, messages et toutes vos données seront supprimés.
                  </Text>
                </View>
              </View>

              <View style={styles.deleteActions}>
                <TouchableOpacity
                  style={[styles.deleteConfirmButton, { backgroundColor: colors.error }]}
                  onPress={handleDeleteAccount}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={[styles.deleteConfirmButtonText, { color: '#FFF' }]}>Oui, supprimer définitivement</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteCancelButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={[styles.deleteCancelButtonText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
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
    padding: 16,
  },
  header: {
    padding: 16,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 16,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  successBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dangerHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 5,
  },
  dangerDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
    opacity: 0.85,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  submitButton: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notificationInfo: {
    flex: 1,
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 13,
  },
  privacyItem: {
    paddingVertical: 12,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  privacyButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  privacyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dangerSection: {
  },
  dangerTitle: {
  },
  deleteButton: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirm: {
    gap: 16,
  },
  deleteWarning: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  deleteWarningText: {
    flex: 1,
  },
  deleteWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  deleteWarningDescription: {
    fontSize: 13,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#D8463E',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteCancelButton: {
    flex: 1,
    backgroundColor: '#E7EDF3',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  deleteCancelButtonText: {
    color: '#3C4856',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#3C4856',
    textAlign: 'center',
  },
});

