import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { ArrowRight, Shield, MessageCircle, Star } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LandingScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/images/5.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Trouve le bon troc{'\n'}qui peut faire la différence
          </Text>

          {/* Quick Features */}
          <View style={styles.quickFeatures}>
            <View style={styles.quickFeature}>
              <Shield size={20} color={colors.primary} />
              <Text style={[styles.quickFeatureText, { color: colors.textSecondary }]}>Sécurisé</Text>
            </View>
            <View style={styles.quickFeature}>
              <MessageCircle size={20} color={colors.primary} />
              <Text style={[styles.quickFeatureText, { color: colors.textSecondary }]}>Chat intégré</Text>
            </View>
            <View style={styles.quickFeature}>
              <Star size={20} color={colors.secondary} fill={colors.secondary} />
              <Text style={[styles.quickFeatureText, { color: colors.textSecondary }]}>Avis vérifiés</Text>
            </View>
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/auth', params: { mode: 'register' } })}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Commencer</Text>
            <ArrowRight size={20} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
              J'ai déjà un compte
            </Text>
          </TouchableOpacity>
        </View>
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
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  hero: {
    flex: 1,
    padding: 32,
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 250,
    height: 250,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    marginTop: -20,
    marginBottom: 48,
  },
  quickFeatures: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 24,
  },
  quickFeature: {
    alignItems: 'center',
    gap: 8,
  },
  quickFeatureText: {
    fontSize: 13,
    fontWeight: '500',
  },
  ctaSection: {
    padding: 32,
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 28,
    shadowColor: '#19ADFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
