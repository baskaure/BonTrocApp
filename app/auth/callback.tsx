import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleAuthCallback = async (url?: string) => {
      try {
        // Attendre un peu pour que l'URL soit complètement chargée
        await new Promise(resolve => setTimeout(resolve, 300));

        // Récupérer l'URL depuis les paramètres, le deep link, ou l'argument
        if (!url) {
          url = params.url as string;
        }
        
        if (!url) {
          // Essayer de récupérer depuis le deep link actuel
          const initialUrl = await Linking.getInitialURL();
          url = initialUrl || undefined;
        }

        if (!url) {
          console.warn('No URL found in callback, waiting for deep link...');
          return;
        }

        console.log('Processing OAuth callback:', url);

        // Extraire les paramètres depuis le hash (#) ou query (?)
        let access_token: string | null = null;
        let refresh_token: string | null = null;
        let error: string | null = null;
        let error_description: string | null = null;

        // Vérifier le hash (format: #access_token=...&refresh_token=...)
        if (url.includes('#')) {
          const hash = url.split('#')[1];
          const hashParams = new URLSearchParams(hash);
          access_token = hashParams.get('access_token');
          refresh_token = hashParams.get('refresh_token');
          error = hashParams.get('error');
          error_description = hashParams.get('error_description');
        }

        // Vérifier les query params (format: ?access_token=...)
        if (!access_token && url.includes('?')) {
          const parsed = Linking.parse(url);
          const queryParams = parsed.queryParams || {};
          access_token = (queryParams.access_token as string) || null;
          refresh_token = (queryParams.refresh_token as string) || null;
          error = (queryParams.error as string) || null;
          error_description = (queryParams.error_description as string) || null;
        }

        if (error) {
          console.error('OAuth error:', error, error_description);
          router.replace('/auth?error=' + encodeURIComponent(error_description || error));
          return;
        }

        if (access_token && refresh_token) {
          // Échanger les tokens avec Supabase
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            router.replace('/auth?error=' + encodeURIComponent(sessionError.message));
            return;
          }

          if (data.session) {
            console.log('OAuth success, session created');
            // Succès ! Rediriger vers l'app
            router.replace('/');
          } else {
            router.replace('/auth?error=No session created');
          }
        } else {
          console.warn('No tokens found in callback URL');
          // Pas de tokens trouvés, rediriger vers la page d'auth
          router.replace('/auth');
        }
      } catch (err: any) {
        console.error('Callback error:', err);
        router.replace('/auth?error=' + encodeURIComponent(err.message || 'Erreur inconnue'));
      }
    };

    // Essayer de traiter le callback immédiatement
    handleAuthCallback();

    // Écouter les deep links en temps réel (au cas où le callback arrive après le montage)
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('Deep link received in callback:', event.url);
      if (event.url.includes('/auth/callback') || event.url.includes('access_token') || event.url.includes('refresh_token')) {
        handleAuthCallback(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [params, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#19ADFA" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});

