import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

WebBrowser.maybeCompleteAuthSession();

function GoogleIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

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
  const isProcessingOAuth = useRef(false);

  // Mettre à jour le mode quand les paramètres changent
  useEffect(() => {
    if (params.mode === 'register' || params.mode === 'login') {
      setMode(params.mode);
    }
  }, [params.mode]);

  // Rediriger vers la page principale si l'utilisateur est connecté
  useEffect(() => {
    if (!authLoading && user) {
      setGoogleLoading(false);
      const timer = setTimeout(() => {
        router.replace('/');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, router]);

  // Fonction pour traiter les URLs OAuth
  const handleOAuthUrl = async (url: string) => {
    console.log('Processing OAuth callback URL:', url);
    
    // Éviter le traitement multiple
    if (isProcessingOAuth.current) {
      console.log('Already processing OAuth, skipping...');
      return;
    }
    
    // Vérifier si c'est un callback OAuth
    if (url.includes('#access_token=') || url.includes('?access_token=') || url.includes('&access_token=')) {
      isProcessingOAuth.current = true;
      
      try {
        // Extraire les paramètres
        let fragment = '';
        if (url.includes('#')) {
          fragment = url.split('#')[1];
        } else if (url.includes('?')) {
          const queryString = url.split('?')[1];
          fragment = queryString;
        }
        
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        console.log('Tokens extracted:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        });
        
        if (accessToken) {
          console.log('Setting session with tokens...');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (error) {
            console.error('Error setting session:', error);
            Alert.alert('Erreur', 'Erreur lors de la connexion');
            setGoogleLoading(false);
          } else {
            console.log('Session set successfully!');
            // Le useEffect qui surveille user va gérer la redirection
          }
        }
      } catch (error) {
        console.error('Error processing OAuth callback:', error);
        Alert.alert('Erreur', 'Erreur lors de la connexion');
        setGoogleLoading(false);
      } finally {
        setTimeout(() => {
          isProcessingOAuth.current = false;
        }, 1000);
      }
    }
  };

  // Écouter les deep links OAuth
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      console.log('Deep link received in auth:', event.url);
      handleOAuthUrl(event.url);
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    
    setGoogleLoading(true);
    isProcessingOAuth.current = false;
    
    try {
      // Créer l'URL de redirection avec expo-auth-session
      // Force l'utilisation du schéma de l'app (bontroc://) au lieu d'une URL web
      const redirectUrl = makeRedirectUri({
        scheme: 'bontroc',
        path: 'auth/callback',
      });
      
      // S'assurer que l'URL utilise bien le schéma de l'app et non HTTP/HTTPS
      // Si makeRedirectUri retourne une URL web, on force l'utilisation du schéma de l'app
      const appRedirectUrl = redirectUrl.startsWith('http') 
        ? `bontroc://auth/callback` 
        : redirectUrl;
      
      console.log('OAuth redirect URL (original):', redirectUrl);
      console.log('OAuth redirect URL (app):', appRedirectUrl);
      
      // IMPORTANT: Ajoutez cette URL EXACTE dans Supabase Dashboard
      // Authentication > URL Configuration > Redirect URLs
      // Format attendu: bontroc://auth/callback
      // 
      // Pour vérifier l'URL exacte, regardez dans la console lors de l'exécution
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appRedirectUrl,
          skipBrowserRedirect: true, // On gère l'ouverture du navigateur manuellement
          // Ne pas forcer prompt: 'consent' car cela peut causer des problèmes avec les apps en mode Testing
          queryParams: {
            access_type: 'offline',
          },
        },
      });
      
      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }
      
      if (data?.url) {
        console.log('Opening OAuth URL in browser...');
        console.log('OAuth URL (original):', data.url);
        
        // Remplacer l'URL de redirection web par l'URL de l'app dans l'URL OAuth
        // Supabase peut générer une URL avec redirect_uri pointant vers le site web
        // On doit la remplacer par notre URL d'app
        let oauthUrl = data.url;
        
        // Extraire et remplacer le paramètre redirect_uri
        // Format attendu: redirect_uri=https://... ou redirect_uri=http://...
        const redirectUriPattern = /redirect_uri=([^&]+)/;
        const match = oauthUrl.match(redirectUriPattern);
        
        if (match) {
          const currentRedirectUri = decodeURIComponent(match[1]);
          console.log('Current redirect_uri in OAuth URL:', currentRedirectUri);
          
          // Si c'est une URL web, la remplacer par l'URL de l'app
          if (currentRedirectUri.startsWith('http://') || currentRedirectUri.startsWith('https://')) {
            oauthUrl = oauthUrl.replace(
              redirectUriPattern,
              `redirect_uri=${encodeURIComponent(appRedirectUrl)}`
            );
            console.log('OAuth URL (modified - web URL replaced):', oauthUrl);
          } else {
            console.log('Redirect URI is already an app URL, keeping it');
          }
        } else {
          // Si pas de redirect_uri trouvé, l'ajouter
          const separator = oauthUrl.includes('?') ? '&' : '?';
          oauthUrl = `${oauthUrl}${separator}redirect_uri=${encodeURIComponent(appRedirectUrl)}`;
          console.log('OAuth URL (with redirect_uri added):', oauthUrl);
        }
        
        // Ouvrir le navigateur pour l'authentification
        // Utiliser openAuthSessionAsync pour gérer correctement le retour vers l'app
        // Cette méthode attend que l'URL de redirection soit appelée
        const result = await WebBrowser.openAuthSessionAsync(
          oauthUrl,
          appRedirectUrl
        );
        
        console.log('Browser result type:', result.type);
        
        // Traiter le résultat
        if (result.type === 'success') {
          // Type guard pour vérifier que result a une propriété url
          const successResult = result as { type: 'success'; url: string };
          if (successResult.url) {
            console.log('Got result URL, processing...', successResult.url);
            await handleOAuthUrl(successResult.url);
          } else {
            console.log('Success but no URL in result');
            setGoogleLoading(false);
            isProcessingOAuth.current = false;
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          console.log('Browser dismissed or cancelled');
          setGoogleLoading(false);
          isProcessingOAuth.current = false;
        } else if (result.type === 'locked') {
          console.log('Browser locked');
          setGoogleLoading(false);
          isProcessingOAuth.current = false;
        } else {
          console.log('Unexpected result type:', result.type);
          // Attendre un peu pour voir si un deep link arrive
          setTimeout(() => {
            if (!isProcessingOAuth.current) {
              setGoogleLoading(false);
            }
          }, 2000);
        }
      } else {
        throw new Error('Aucune URL OAuth retournée');
      }
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      Alert.alert('Erreur', err.message || 'Erreur lors de la connexion Google');
      setGoogleLoading(false);
      isProcessingOAuth.current = false;
    }
  };


  const handleSubmit = async () => {
    if (loading) return;
    
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        await new Promise(resolve => setTimeout(resolve, 500));
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
        <Text style={[styles.title, { color: colors.text }]}>
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Accédez à BonTroc pour publier vos annonces et gérer vos échanges.
        </Text>

        <TouchableOpacity
          style={[
            styles.googleButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            googleLoading && { opacity: 0.7 }
          ]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#475569" />
          ) : (
            <>
              <GoogleIcon />
              <Text style={[styles.googleButtonText, { color: colors.text }]}>
                Continuer avec Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>ou</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {mode === 'register' && (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Nom d'affichage</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }
                ]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Votre nom"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Nom d'utilisateur</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }
                ]}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Mot de passe</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }
            ]}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton, 
            (loading || !email || !password || (mode === 'register' && (!displayName || !username))) && styles.submitButtonDisabled
          ]}
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
          <Text style={[styles.switchButtonText, { color: colors.primary }]}>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  googleButton: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
  },
});