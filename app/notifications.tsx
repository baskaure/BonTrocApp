import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, Mail, CheckCircle, MessageCircle, Package, Star, FileSignature, XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { useActivityStore, ActivityItem } from '@/lib/activity';

/**
 * Fil d'activité : calculé à partir des propositions, échanges et messages (voir lib/activity.ts).
 * Il remplace l'ancienne table `notifications`, absente des migrations du site.
 */
export default function ActivityScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const items = useActivityStore((s) => s.items);
  const loading = useActivityStore((s) => s.loading);
  const refresh = useActivityStore((s) => s.refresh);
  const markSeen = useActivityStore((s) => s.markSeen);
  const markAllSeen = useActivityStore((s) => s.markAllSeen);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = items.filter((i) => i.unread).length;

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    await refresh(user.id);
    setRefreshing(false);
  }, [user, refresh]);

  const handlePress = (item: ActivityItem) => {
    if (!user) return;
    void markSeen(user.id, item.key, item.at);
    router.push(item.route);
  };

  const iconFor = (item: ActivityItem) => {
    if (item.kind === 'proposal_received') return Mail;
    if (item.kind === 'message') return MessageCircle;
    if (item.kind === 'proposal_update') return item.title === 'Proposition refusée' ? XCircle : CheckCircle;
    if (item.title === 'Contrat à signer') return FileSignature;
    if (item.title === 'Laissez un avis') return Star;
    if (item.title === 'Échange annulé') return XCircle;
    return Package;
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Veuillez vous connecter</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Activité</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => void markAllSeen(user.id)} style={styles.markAllButton}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>Tout marquer comme lu</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 100 }} />
        )}
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <Bell size={64} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Rien de nouveau pour le moment</Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {items.map((item) => {
            const Icon = iconFor(item);
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.notificationItem,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: item.unread ? colors.primaryLight + '20' : colors.background,
                  },
                ]}
                onPress={() => handlePress(item)}
              >
                <View style={[styles.notificationIcon, { backgroundColor: item.actionable ? colors.secondaryLight : colors.primaryLight }]}>
                  <Icon size={22} color={item.actionable ? colors.warning : colors.primary} />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: colors.text }]}>{item.title}</Text>
                    {item.unread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={3}>
                    {item.message}
                  </Text>
                  <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
                    {new Date(item.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  markAllButton: {
    padding: 4,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});
