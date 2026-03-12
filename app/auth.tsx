import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormInput } from '@/components/ui/FormInput';
import Svg, { Path } from 'react-native-svg';

const authSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
  displayName: z.string().optional(),
  username: z.string().optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

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
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const isProcessingOAuth = useRef(false);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
      username: '',
    },
  });

  const watchedValues = watch();

  // Mettre à jour le mode quand les paramètres changent
  useEffect(() => {
    if (params.mode === 'register' || params.mode === 'login') {
      setMode(params.mode as 'login' | 'register');
    }
    
    // Afficher les erreurs OAuth si présentes dans les paramètres d'URL
    if (params.error) {
      const errorMessage = decodeURIComponent(params.error as string);
      Alert.alert(
        'Erreur de connexion Google',
        errorMessage,
        [{ text: 'OK' }]
      );
      // Nettoyer l'erreur de l'URL
      router.replace('/auth');
    }
  }, [params.mode, params.error, router]);

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
    
    // Vérifier d'abord s'il y a des erreurs dans l'URL
    const urlLower = url.toLowerCase();
    if (urlLower.includes('error=') || urlLower.includes('error&')) {
      isProcessingOAuth.current = true;
      try {
        // Extraire les paramètres d'erreur
        let fragment = '';
        if (url.includes('#')) {
          fragment = url.split('#')[1];
        } else if (url.includes('?')) {
          const queryString = url.split('?')[1];
          fragment = queryString;
        }
        
        const params = new URLSearchParams(fragment);
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        
        console.error('OAuth error in URL:', error, errorDescription);
        
        let errorMessage = 'Erreur lors de la connexion Google';
        
        if (error === 'access_denied') {
          errorMessage = 'Accès refusé. Vérifiez que votre email est dans la liste des testeurs si l\'application est en mode Testing.';
        } else if (error === 'invalid_request') {
          errorMessage = 'Requête invalide. L\'application Google OAuth n\'est peut-être pas correctement configurée.';
        } else if (errorDescription) {
          errorMessage = errorDescription;
        } else if (error) {
          errorMessage = `Erreur OAuth: ${error}`;
        }
        
        Alert.alert(
          'Erreur de connexion Google',
          errorMessage + '\n\nVérifiez la configuration dans Google Cloud Console.',
          [{ text: 'OK' }]
        );
        setGoogleLoading(false);
      } catch (err) {
        console.error('Error parsing OAuth error:', err);
        Alert.alert('Erreur', 'Erreur lors de la connexion Google');
        setGoogleLoading(false);
      } finally {
        setTimeout(() => {
          isProcessingOAuth.current = false;
        }, 1000);
      }
      return;
    }
    
    // Vérifier si c'est un callback OAuth avec des tokens
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
        const error = params.get('error');
        
        // Vérifier s'il y a une erreur dans les paramètres
        if (error) {
          const errorDescription = params.get('error_description') || '';
          console.error('OAuth error in params:', error, errorDescription);
          
          let errorMessage = 'Erreur lors de la connexion Google';
          if (error === 'access_denied') {
            errorMessage = 'Accès refusé. Vérifiez que votre email est dans la liste des testeurs si l\'application est en mode Testing.';
          } else if (error === 'invalid_request') {
            errorMessage = 'Requête invalide. L\'application Google OAuth n\'est peut-être pas correctement configurée.';
          } else if (errorDescription) {
            errorMessage = errorDescription;
          }
          
          Alert.alert('Erreur de connexion Google', errorMessage);
          setGoogleLoading(false);
          return;
        }
        
        console.log('Tokens extracted:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        });
        
        if (accessToken) {
          console.log('Setting session with tokens...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (sessionError) {
            console.error('Error setting session:', sessionError);
            Alert.alert('Erreur', 'Erreur lors de la création de la session: ' + sessionError.message);
            setGoogleLoading(false);
          } else {
            console.log('Session set successfully!');
            // Le useEffect qui surveille user va gérer la redirection
          }
        } else {
          Alert.alert('Erreur', 'Aucun token d\'accès trouvé dans la réponse Google');
          setGoogleLoading(false);
        }
      } catch (error: any) {
        console.error('Error processing OAuth callback:', error);
        Alert.alert('Erreur', error.message || 'Erreur lors de la connexion');
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
      // Forcer l'utilisation du schéma de l'app (bontroc://) au lieu de exp://
      // makeRedirectUri peut retourner exp:// en développement, on force bontroc://
      const appRedirectUrl = 'bontroc://auth/callback';
      
      console.log('App redirect URL:', appRedirectUrl);
      
      // IMPORTANT: Configuration requise dans Supabase Dashboard
      // 1. Allez dans Authentication > URL Configuration > Redirect URLs
      // 2. Ajoutez l'URL exacte: bontroc://auth/callback
      //
      // IMPORTANT: Configuration requise dans Google Cloud Console
      // 1. Allez dans APIs & Services > Credentials
      // 2. Sélectionnez votre OAuth 2.0 Client ID (type Web)
      // 3. Dans "Authorized redirect URIs", ajoutez:
      //    https://[votre-projet].supabase.co/auth/v1/callback
      //    (Remplacez [votre-projet] par votre ID de projet Supabase)
      
      // Utiliser skipBrowserRedirect: true pour gérer manuellement l'ouverture
      // Cela permet de contrôler le flux et de rester dans l'app
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appRedirectUrl,
          skipBrowserRedirect: true, // On gère l'ouverture manuellement
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) {
        console.error('OAuth error:', error);
        Alert.alert(
          'Erreur de configuration',
          'Erreur OAuth: ' + error.message + '\n\nVérifiez que:\n' +
          '1. Google OAuth est activé dans Supabase\n' +
          '2. L\'URL de callback Supabase est dans Google Cloud Console\n' +
          '3. L\'URL bontroc://auth/callback est dans Supabase Redirect URLs'
        );
        setGoogleLoading(false);
        return;
      }
      
      // Si Supabase retourne une URL, l'ouvrir dans le navigateur
      if (data?.url) {
        console.log('Opening OAuth URL in browser:', data.url);
        
        // Utiliser openAuthSessionAsync pour ouvrir dans un navigateur in-app
        // qui peut rediriger vers notre deep link bontroc://
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          appRedirectUrl
        );
        
        console.log('OAuth result type:', result.type);
        
        // Traiter le résultat
        if (result.type === 'success' && 'url' in result) {
          const resultUrl = result.url as string;
          console.log('OAuth callback URL received:', resultUrl);
          
          // Vérifier si c'est notre deep link ou une URL Supabase
          if (resultUrl.startsWith('bontroc://') || resultUrl.includes('auth/callback')) {
            await handleOAuthUrl(resultUrl);
          } else {
            // Si c'est une URL Supabase, elle devrait contenir les tokens
            // ou rediriger vers notre deep link
            console.log('Processing Supabase callback URL');
            await handleOAuthUrl(resultUrl);
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          console.log('User cancelled or dismissed OAuth');
          setGoogleLoading(false);
          isProcessingOAuth.current = false;
        } else {
          console.log('Unexpected OAuth result, waiting for deep link...');
          // Attendre un peu au cas où un deep link arrive via Linking
          setTimeout(() => {
            if (!isProcessingOAuth.current) {
              console.log('No deep link received, stopping loading');
              setGoogleLoading(false);
            }
          }, 3000);
        }
      } else {
        throw new Error('Aucune URL OAuth retournée par Supabase');
      }
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      Alert.alert(
        'Erreur',
        err.message || 'Erreur lors de la connexion Google.\n\n' +
        'Vérifiez la configuration OAuth dans Supabase et Google Cloud Console.'
      );
      setGoogleLoading(false);
      isProcessingOAuth.current = false;
    }
  };


  const onSubmit = async (data: AuthFormData) => {
    if (loading) return;

    if (mode === 'register') {
      if (!data.displayName || data.displayName.length < 2) {
        setError('displayName', { message: 'Le nom doit faire au moins 2 caractères' });
        return;
      }
      if (!data.username || data.username.length < 2) {
        setError('username', { message: "Le nom d'utilisateur doit faire au moins 2 caractères" });
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
        setError('username', { message: "Lettres, chiffres et underscores uniquement" });
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(data.email, data.password);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        await signUp(data.email, data.password, data.displayName!, data.username!);
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
            <FormInput
              control={control}
              name="displayName"
              label="Nom d'affichage"
              error={errors.displayName}
              inputProps={{
                placeholder: 'Votre nom',
                returnKeyType: 'next',
                blurOnSubmit: false,
              }}
            />
            <FormInput
              control={control}
              name="username"
              label="Nom d'utilisateur"
              error={errors.username}
              inputProps={{
                placeholder: 'username',
                autoCapitalize: 'none',
                returnKeyType: 'next',
                blurOnSubmit: false,
              }}
            />
          </>
        )}

        <FormInput
          control={control}
          name="email"
          label="Email"
          error={errors.email}
          inputProps={{
            placeholder: 'votre@email.com',
            keyboardType: 'email-address',
            autoCapitalize: 'none',
            returnKeyType: 'next',
            blurOnSubmit: false,
          }}
        />

        <FormInput
          control={control}
          name="password"
          label="Mot de passe"
          error={errors.password}
          inputProps={{
            placeholder: '••••••••',
            secureTextEntry: true,
            returnKeyType: 'done',
          }}
        />

        <TouchableOpacity
          style={[
            styles.submitButton,
            (loading ||
              !watchedValues.email ||
              !watchedValues.password ||
              (mode === 'register' && (!watchedValues.displayName || !watchedValues.username))) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit(onSubmit)}
          disabled={
            loading ||
            !watchedValues.email ||
            !watchedValues.password ||
            (mode === 'register' && (!watchedValues.displayName || !watchedValues.username))
          }
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
      </TouchableWithoutFeedback>
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