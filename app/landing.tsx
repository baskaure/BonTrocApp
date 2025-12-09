import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { Sparkles, Shield, MessageCircle, Users, FileText, Star, Zap } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LandingScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Sparkles size={16} color="#19ADFA" />
          <Text style={styles.badgeText}>Contrats, chat, avis, mobile-first</Text>
        </View>

        <Text style={styles.title}>
          BonTroc{'\n'}
          <Text style={styles.titleHighlight}>le troc pro et mobile</Text>
        </Text>

        <Text style={styles.subtitle}>
          Services, produits, barters : chat, contrat PDF, suivi et avis intégrés.
        </Text>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Shield size={20} color="#19ADFA" />
            <Text style={styles.featureText}>Contrat & suivi</Text>
          </View>
          <View style={styles.featureItem}>
            <MessageCircle size={20} color="#19ADFA" />
            <Text style={styles.featureText}>Chat + notif e-mail</Text>
          </View>
          <View style={styles.featureItem}>
            <Users size={20} color="#19ADFA" />
            <Text style={styles.featureText}>Profils & avis</Text>
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth?mode=register')}
          >
            <Text style={styles.primaryButtonText}>Créer mon compte</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth?mode=login')}
          >
            <Text style={styles.secondaryButtonText}>Parcourir les trocs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Star size={16} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.statText}>Notes & avis vérifiés</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pour tous vos échanges</Text>
        <Text style={styles.sectionSubtitle}>Services, matériel, entraide ou barters B2B.</Text>

        <View style={styles.useCases}>
          <View style={styles.useCaseCard}>
            <Text style={styles.useCaseTitle}>Services pros</Text>
            <Text style={styles.useCaseDetail}>Coaching, dev, design, marketing</Text>
            <View style={styles.useCaseBadge}>
              <Text style={styles.useCaseBadgeText}>1 200+ offres actives</Text>
            </View>
          </View>
          <View style={styles.useCaseCard}>
            <Text style={styles.useCaseTitle}>Échanges matériels</Text>
            <Text style={styles.useCaseDetail}>Outillage, équipement, matériel créatif</Text>
            <View style={styles.useCaseBadge}>
              <Text style={styles.useCaseBadgeText}>640+ trocs sécurisés</Text>
            </View>
          </View>
          <View style={styles.useCaseCard}>
            <Text style={styles.useCaseTitle}>Solidarité locale</Text>
            <Text style={styles.useCaseDetail}>Aide ponctuelle, garde, soutien scolaire</Text>
            <View style={styles.useCaseBadge}>
              <Text style={styles.useCaseBadgeText}>Communauté vérifiée</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>L'essentiel, prêt à l'emploi</Text>
        <Text style={styles.sectionSubtitle}>Contrat, chat, suivi, avis, modération : tout est inclus.</Text>

        <View style={styles.featureCards}>
          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <FileText size={24} color="#19ADFA" />
            </View>
            <Text style={styles.featureCardTitle}>Contrat & PDF</Text>
            <Text style={styles.featureCardDesc}>Contrat prêt à télécharger et à partager.</Text>
          </View>
          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <MessageCircle size={24} color="#19ADFA" />
            </View>
            <Text style={styles.featureCardTitle}>Chat en direct</Text>
            <Text style={styles.featureCardDesc}>Messagerie intégrée, alertes e-mail.</Text>
          </View>
          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Star size={24} color="#19ADFA" />
            </View>
            <Text style={styles.featureCardTitle}>Suivi & avis</Text>
            <Text style={styles.featureCardDesc}>Statut d'échange, avis vérifiés.</Text>
          </View>
          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Shield size={24} color="#19ADFA" />
            </View>
            <Text style={styles.featureCardTitle}>Sécurité</Text>
            <Text style={styles.featureCardDesc}>Signalements, modération.</Text>
          </View>
        </View>
      </View>

      <View style={styles.ctaSection}>
        <View style={styles.ctaIcon}>
          <Zap size={32} color="#FFF" />
        </View>
        <Text style={styles.ctaTitle}>Lancez votre prochain échange avec BonTroc</Text>
        <Text style={styles.ctaSubtitle}>
          Contrat PDF, chat, suivi, avis, modération : tout est prêt pour un troc sérieux.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/auth?mode=register')}
        >
          <Text style={styles.ctaButtonText}>Créer mon compte</Text>
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
    paddingBottom: 32,
  },
  hero: {
    padding: 24,
    paddingTop: 48,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    color: '#19ADFA',
    fontWeight: '600',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
    lineHeight: 44,
  },
  titleHighlight: {
    color: '#19ADFA',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
    lineHeight: 24,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureText: {
    fontSize: 12,
    color: '#475569',
  },
  buttons: {
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#19ADFA',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    color: '#64748B',
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
  },
  useCases: {
    gap: 12,
  },
  useCaseCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  useCaseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  useCaseDetail: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  useCaseBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  useCaseBadgeText: {
    fontSize: 12,
    color: '#19ADFA',
    fontWeight: '600',
  },
  featureCards: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  featureCardDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  ctaSection: {
    backgroundColor: '#E0F2FE',
    padding: 32,
    margin: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  ctaIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#19ADFA',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: '#19ADFA',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  ctaButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

