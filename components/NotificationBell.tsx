import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { useActivityBadges } from '@/hooks/useActivity';

type NotificationBellProps = {
  onPress?: () => void;
};

/** Cloche d'activité : compte les éléments non lus (propositions, échanges, messages). */
export function NotificationBell({ onPress }: NotificationBellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { unread } = useActivityBadges();

  if (!user) return null;

  return (
    <TouchableOpacity
      style={styles.bellContainer}
      hitSlop={8}
      accessibilityLabel={unread > 0 ? `Activité, ${unread} non lus` : 'Activité'}
      onPress={() => {
        if (onPress) {
          onPress();
        } else {
          router.push('/notifications');
        }
      }}
    >
      <Bell size={24} color={colors.textSecondary} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.background }]}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
