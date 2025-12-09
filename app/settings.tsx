import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Lock, Bell, Shield, Trash2, AlertTriangle } from 'lucide-react-native';
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

  const handlePasswordChange = async () => {
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
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

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Veuillez vous connecter pour accéder aux paramètres</Text>
      </View>
    );
  }

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Paramètres</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Lock size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Sécurité</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Nouveau mot de passe</Text>
            <TextInput
              style={styles.input}
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
              style={styles.input}
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

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Bell size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Nouvelles propositions</Text>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                Recevoir un email lors d'une nouvelle proposition
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailNewProposal}
              onValueChange={() => handleNotificationToggle('emailNewProposal')}
              trackColor={{ false: '#CBD5E1', true: '#19ADFA' }}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Propositions acceptées</Text>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                Notification quand votre proposition est acceptée
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailAcceptedProposal}
              onValueChange={() => handleNotificationToggle('emailAcceptedProposal')}
              trackColor={{ false: '#CBD5E1', true: '#19ADFA' }}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Nouveaux messages</Text>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                Alerte email pour les nouveaux messages
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailNewMessage}
              onValueChange={() => handleNotificationToggle('emailNewMessage')}
              trackColor={{ false: '#CBD5E1', true: '#19ADFA' }}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Résumé hebdomadaire</Text>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                Recevoir un résumé de vos activités chaque semaine
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailWeeklyDigest}
              onValueChange={() => handleNotificationToggle('emailWeeklyDigest')}
              trackColor={{ false: '#CBD5E1', true: '#19ADFA' }}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Shield size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Confidentialité</Text>
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

        <View style={[styles.section, styles.dangerSection, { backgroundColor: colors.surface, borderColor: colors.error }]}>
          <View style={styles.sectionHeader}>
            <Trash2 size={24} color={colors.error} />
            <Text style={[styles.sectionTitle, styles.dangerTitle, { color: colors.text }]}>Zone dangereuse</Text>
          </View>

          {!showDeleteConfirm ? (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.error }]}
              onPress={() => setShowDeleteConfirm(true)}
            >
              <Text style={[styles.deleteButtonText, { color: '#FFF' }]}>Supprimer mon compte</Text>
            </TouchableOpacity>
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

      <BottomNav />
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
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    backgroundColor: '#EF4444',
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
    backgroundColor: '#E2E8F0',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  deleteCancelButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
});

