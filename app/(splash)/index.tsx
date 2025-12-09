import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useAuth } from '@/lib/auth-context';

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (!loading) {
      // Attendre un court délai pour afficher le splash
      const timer = setTimeout(() => {
        if (user) {
          router.replace('/');
        } else {
          router.replace('/landing');
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [loading, user, router]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <Image 
        source={require('@/assets/images/icon.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});

