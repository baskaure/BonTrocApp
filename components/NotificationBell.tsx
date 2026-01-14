import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type NotificationBellProps = {
  onPress?: () => void;
};

export function NotificationBell({ onPress }: NotificationBellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      subscribeToNotifications();
    }
  }, [user]);

  async function loadUnreadCount() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        if (error.code === 'PGRST205') {
          setUnreadCount(0);
        } else {
          console.error('Error loading unread count:', error);
        }
      } else if (data) {
        setUnreadCount(data.length);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
      setUnreadCount(0);
    }
  }

  function subscribeToNotifications() {
    if (!user) return;

    const subscription = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadUnreadCount();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadUnreadCount();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  if (!user) return null;

  return (
    <TouchableOpacity
      style={[styles.bellContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        if (onPress) {
          onPress();
        } else {
          router.push('/notifications');
        }
      }}
    >
      <Bell size={24} color={colors.textSecondary} />
      {unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: 8,
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

