import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import * as SplashScreen from 'expo-splash-screen';

// Empêcher le splash screen natif de se masquer automatiquement
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Gérer le splash screen
  useEffect(() => {
    const prepare = async () => {
      try {
        if (!loading) {
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

  // Gérer la navigation basée sur l'authentification
  useEffect(() => {
    if (!isReady || loading) return;

    const inSplashGroup = segments[0] === '(splash)';
    const isOnAuthPage = pathname === '/auth' || pathname?.startsWith('/auth/');
    const isOnLandingPage = pathname === '/landing';

    // La page splash gère sa propre redirection
    if (inSplashGroup) return;

    // Utiliser un petit délai pour s'assurer que le router est prêt
    const timer = setTimeout(() => {
      try {
        // Rediriger vers home si connecté et sur une page auth ou landing
        if (user && (isOnAuthPage || isOnLandingPage)) {
          router.replace('/');
        }
        // Rediriger vers landing si pas connecté et sur une page protégée
        else if (!user && !isOnAuthPage && !isOnLandingPage) {
          router.replace('/landing');
        }
      } catch (error) {
        // Ignorer les erreurs de navigation si le router n'est pas encore prêt
        console.warn('Navigation error (router not ready):', error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [user, segments, pathname, isReady, loading, router]);

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false, 
        animation: 'fade',
        animationDuration: 150, // Transition rapide (150ms)
      }} 
      initialRouteName="(splash)"
    >
      <Stack.Screen name="(splash)" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="landing" options={{ animation: 'fade' }} />
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="auth" options={{ animation: 'fade' }} />
      <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
      <Stack.Screen name="proposals" options={{ animation: 'fade' }} />
      <Stack.Screen name="proposal/[id]" options={{ animation: 'slide_from_right', animationDuration: 200 }} />
      <Stack.Screen name="listing/[id]" options={{ animation: 'slide_from_right', animationDuration: 200 }} />
      <Stack.Screen name="listing/create" options={{ animation: 'slide_from_right', animationDuration: 200 }} />
      <Stack.Screen name="profile" options={{ animation: 'fade' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right', animationDuration: 200 }} />
      <Stack.Screen name="exchanges" options={{ animation: 'fade' }} />
      <Stack.Screen name="admin" options={{ animation: 'fade' }} />
      <Stack.Screen name="user/[id]" options={{ animation: 'slide_from_right', animationDuration: 200 }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Gérer le rafraîchissement automatique de la session
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    // Gérer les deep links OAuth
    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      console.log('Deep link received in _layout:', url);
      
      // Ne pas interférer avec les deep links OAuth
      // Laisser les composants individuels les gérer
      if (url.includes('/auth/callback') || url.includes('access_token') || url.includes('refresh_token')) {
        console.log('OAuth callback deep link detected, letting auth components handle it');
      }
    };

    // Écouter l'URL initiale
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    // Écouter les nouveaux deep links
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