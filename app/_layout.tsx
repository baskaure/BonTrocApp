import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import * as SplashScreen from 'expo-splash-screen';

// Empêcher le splash screen natif de se masquer automatiquement
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        if (!loading) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          await SplashScreen.hideAsync();
          setIsReady(true);
        }
      } catch (e) {
        console.warn(e);
        await SplashScreen.hideAsync();
        setIsReady(true);
      }
    };

    prepare();
  }, [loading]);

  useEffect(() => {
    if (!isReady || loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inSplashGroup = segments[0] === '(splash)';

    // La page splash gère sa propre redirection
    if (inSplashGroup) return;

    if (!user && !inAuthGroup) {
      router.replace('/landing');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, segments, isReady, loading, router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }} initialRouteName="(splash)">
      <Stack.Screen name="(splash)" options={{ headerShown: false }} />
      <Stack.Screen name="landing" />
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="proposals" />
      <Stack.Screen name="proposal/[id]" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="exchanges" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Start auto refresh when app mounts
    supabase.auth.startAutoRefresh();

    // Tells Supabase Auth to continuously refresh the session automatically if
    // the app is in the foreground. When this is added, you will continue to receive
    // `onAuthStateChange` events with the `TOKEN_REFRESHED` or `SIGNED_OUT` event
    // if the user's session is terminated. This should only be registered once.
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    // Gérer les deep links OAuth - Supabase redirige vers l'app via deep link
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      console.log('Deep link received in _layout:', url);
      
      if (url.includes('/auth/callback') || url.includes('access_token') || url.includes('refresh_token')) {
        // Le callback sera géré par la page auth/callback.tsx via expo-router
        console.log('OAuth callback deep link detected');
      }
    };

    // Écouter les deep links initiaux (quand l'app s'ouvre depuis un lien)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    // Écouter les deep links suivants (quand l'app est déjà ouverte)
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
      linkingSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <AuthProvider>
      <RootLayoutNav />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
