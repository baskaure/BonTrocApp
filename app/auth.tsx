import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fermer le navigateur web après authentification
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>(params.mode === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Rediriger vers la page principale si l'utilisateur est connecté
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Construire l'URL de redirection avec le schéma de l'app
      // En développement, utiliser l'URL Expo, sinon le deep link de l'app
      const redirectUrl = __DEV__
        ? 'exp://127.0.0.1:8081/--/auth/callback'
        : Linking.createURL('/auth/callback', {
            scheme: 'bontroc',
          });
      
      console.log('Starting OAuth with redirect:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });
      
      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }
      
      // Ouvrir le navigateur avec WebBrowser pour capturer le retour
      if (data?.url) {
        console.log('Opening OAuth URL:', data.url);
        console.log('Expected redirect:', redirectUrl);
        
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
          {
            showInRecents: true,
          }
        );
        
        console.log('OAuth result type:', result.type);
        console.log('OAuth result URL:', result.url);
        
        if (result.type === 'success' && result.url) {
          // Extraire les tokens de l'URL de retour
          const { access_token, refresh_token } = extractTokensFromUrl(result.url);
          
          console.log('Tokens extracted:', { 
            hasAccessToken: !!access_token, 
            hasRefreshToken: !!refresh_token 
          });
          
          if (access_token && refresh_token) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            
            if (sessionError) {
              console.error('Session error:', sessionError);
              throw sessionError;
            }
            
            if (sessionData.session) {
              console.log('OAuth success, session created');
              // Succès ! La redirection sera gérée par le useEffect qui écoute user
            } else {
              throw new Error('Aucune session créée');
            }
          } else {
            throw new Error('Tokens non trouvés dans l\'URL de retour');
          }
        } else if (result.type === 'cancel') {
          Alert.alert('Annulé', 'Connexion Google annulée');
        } else if (result.type === 'dismiss') {
          Alert.alert('Annulé', 'Fenêtre fermée');
        } else {
          console.warn('Unexpected result type:', result.type);
        }
      } else {
        throw new Error('Aucune URL OAuth retournée');
      }
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      Alert.alert('Erreur', err.message || 'Erreur lors de la connexion Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Fonction pour extraire les tokens de l'URL
  const extractTokensFromUrl = (url: string) => {
    let access_token: string | null = null;
    let refresh_token: string | null = null;

    // Vérifier le hash (#)
    if (url.includes('#')) {
      const hash = url.split('#')[1];
      const hashParams = new URLSearchParams(hash);
      access_token = hashParams.get('access_token');
      refresh_token = hashParams.get('refresh_token');
    }

    // Vérifier les query params (?)
    if (!access_token && url.includes('?')) {
      const parsed = Linking.parse(url);
      const queryParams = parsed.queryParams || {};
      access_token = (queryParams.access_token as string) || null;
      refresh_token = (queryParams.refresh_token as string) || null;
    }

    return { access_token, refresh_token };
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        // La redirection sera gérée automatiquement par le useEffect qui écoute les changements de user
      } else {
        await signUp(email, password, displayName, username);
        Alert.alert('Succès', 'Compte créé ! Vous pouvez maintenant vous connecter.');
        setMode('login');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {mode === 'login' ? 'Connexion' : 'Créer un compte'}
      </Text>
      <Text style={styles.subtitle}>
        Accédez à BonTroc pour publier vos annonces et gérer vos échanges.
      </Text>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <ActivityIndicator color="#475569" />
        ) : (
          <Text style={styles.googleButtonText}>Continuer avec Google</Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      {mode === 'register' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom d'affichage</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Votre nom"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom d'utilisateur</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="votre@email.com"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading || !email || !password || (mode === 'register' && (!displayName || !username))}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            {mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        <Text style={styles.switchButtonText}>
          {mode === 'login'
            ? "Pas encore de compte ? S'inscrire"
            : "Déjà un compte ? Se connecter"}
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 32,
  },
  googleButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#94A3B8',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1E293B',
  },
  submitButton: {
    backgroundColor: '#19ADFA',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#19ADFA',
    fontSize: 14,
    fontWeight: '600',
  },
});

