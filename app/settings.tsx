import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase, DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings, errorMessage, SUPPORT_EMAIL } from '@/lib/supabase';
import { Lock, Bell, Shield, AlertTriangle, ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Mêmes clés que `users.notification_settings` lues par l'Edge Function `send-email` (et que le site). */
const NOTIFICATION_OPTIONS: { key: keyof NotificationSettings; title: string; desc: string }[] = [
  { key: 'email_new_proposal', title: 'Nouvelles propositions', desc: 'Quand un membre vous fait une proposition ou une contre-proposition.' },
  { key: 'email_accepted_proposal', title: 'Contrat prêt', desc: 'Quand une proposition est acceptée et que le contrat attend votre signature.' },
  { key: 'email_new_message', title: 'Nouveaux messages', desc: 'Au plus un e-mail par conversation et par quart d’heure.' },
  { key: 'email_review_request', title: 'Rappels d’avis', desc: 'Après un échange terminé, pour penser à noter votre partenaire.' },
  { key: 'email_exchange_reminder', title: 'Rappels d’échange', desc: 'Si un échange reste sans suite pendant plusieurs jours.' },
];

export default function SettingsScreen() {
  const { user, refreshUser, updateProfile, deleteAccount } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    if (user) {
      setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...(user.notification_settings ?? {}) });
    }
  }, [user]);

  const handlePasswordChange = async () => {
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (updateError) throw updateError;

      setSuccess('Mot de passe modifié !');
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors du changement de mot de passe'));
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async (key: keyof NotificationSettings) => {
    if (!user) return;
    const previous = notificationSettings;
    const next = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(next);

    const { error: updateError } = await supabase.from('users').update({ notification_settings: next }).eq('id', user.id).select('id');
    if (updateError) {
      setNotificationSettings(previous);
      setError(errorMessage(updateError, 'Préférence non enregistrée'));
      return;
    }
    await refreshUser();
  };

  const handleVisibilityToggle = async () => {
    if (!user) return;
    const next = (user.profile_visibility ?? 'public') === 'public' ? 'private' : 'public';
    setVisibilityLoading(true);
    setError('');
    try {
      await updateProfile({ profile_visibility: next });
    } catch (err) {
      setError(errorMessage(err, 'Visibilité non enregistrée'));
    } finally {
      setVisibilityLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setDeleting(true);
    setError('');

    try {
      // Edge Function `delete-account` : anonymisation du profil, médias supprimés, compte fermé.
      await deleteAccount();
      router.replace('/landing');
    } catch (err) {
      setError(errorMessage(err, `Erreur lors de la suppression du compte. Contactez ${SUPPORT_EMAIL}.`));
      setDeleting(false);
    }
  };

  const { colors, shadows } = useTheme();

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Veuillez vous connecter pour accéder aux paramètres</Text>
      </View>
    );
  }

  const visibility = user.profile_visibility ?? 'public';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Paramètres</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {!!success && (
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
              placeholder="Minimum 8 caractères"
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
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.submitButtonText, { color: colors.onPrimary }]}>Modifier le mot de passe</Text>}
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={styles.sectionHeader}>
            <Bell size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>NOTIFICATIONS PAR E-MAIL</Text>
          </View>

          {NOTIFICATION_OPTIONS.map((option) => (
            <View key={option.key} style={[styles.notificationItem, { borderBottomColor: colors.border }]}>
              <View style={styles.notificationInfo}>
                <Text style={[styles.notificationTitle, { color: colors.text }]}>{option.title}</Text>
                <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>{option.desc}</Text>
              </View>
              <Switch
                value={notificationSettings[option.key]}
                onValueChange={() => void handleNotificationToggle(option.key)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={styles.sectionHeader}>
            <Shield size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>CONFIDENTIALITÉ</Text>
          </View>

          <View style={[styles.notificationItem, { borderBottomColor: colors.border }]}>
            <View style={styles.notificationInfo}>
              <View style={styles.rowTitle}>
                {visibility === 'public' ? <Eye size={16} color={colors.textSecondary} /> : <EyeOff size={16} color={colors.textSecondary} />}
                <Text style={[styles.notificationTitle, { color: colors.text }]}>Profil {visibility === 'public' ? 'public' : 'privé'}</Text>
              </View>
              <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
                {visibility === 'public'
                  ? 'Votre bio, vos langues et vos compétences sont visibles par les autres membres.'
                  : 'Seuls votre nom, votre ville et votre réputation restent visibles.'}
              </Text>
            </View>
            {visibilityLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch value={visibility === 'public'} onValueChange={() => void handleVisibilityToggle()} trackColor={{ false: colors.border, true: colors.primary }} />
            )}
          </View>

          <View style={styles.privacyItem}>
            <Text style={[styles.privacyTitle, { color: colors.text }]}>Vos données</Text>
            <Text style={[styles.privacyDescription, { color: colors.textSecondary }]}>
              Pour obtenir une copie de vos données (RGPD), écrivez à {SUPPORT_EMAIL}.
            </Text>
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
                Action définitive : profil anonymisé, annonces retirées, propositions en cours annulées. Les échanges terminés et les avis sont conservés sans donnée personnelle.
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
                    Cette action ne peut pas être annulée. Votre adresse e-mail sera libérée et vous ne pourrez plus vous connecter à ce compte.
                  </Text>
                </View>
              </View>

              <View style={styles.deleteActions}>
                <TouchableOpacity
                  style={[styles.deleteConfirmButton, { backgroundColor: colors.error }]}
                  onPress={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.deleteConfirmButtonText, { color: '#FFF' }]}>Oui, supprimer définitivement</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteCancelButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#3C4856',
    textAlign: 'center',
  },
});
