import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase, Notification } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type NotificationBellProps = {
  onPress?: () => void;
};

export function NotificationBell({ onPress }: NotificationBellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      subscribeToNotifications();
    }
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Si la table n'existe pas, on ignore silencieusement
        if (error.code === 'PGRST205') {
          console.warn('Table notifications does not exist. Please run the SQL script to create it.');
          setNotifications([]);
          setUnreadCount(0);
        } else {
          console.error('Error loading notifications:', error);
        }
      } else if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read_at).length);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
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
        loadNotifications();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  async function markAsRead(notificationId: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    loadNotifications();
  }

  async function markAllAsRead() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    loadNotifications();
  }

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);
    setShowModal(false);

    if (notification.type === 'proposal_received') {
      router.push({
        pathname: '/proposal/[id]',
        params: { id: notification.related_id }
      });
    } else if (notification.type === 'proposal_accepted') {
      router.push('/exchanges');
    } else if (notification.type === 'message_received') {
      router.push({
        pathname: '/proposal/[id]',
        params: { id: notification.related_id }
      });
    } else if (notification.type === 'exchange_update') {
      router.push('/exchanges');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'proposal_received':
        return '📨';
      case 'proposal_accepted':
        return '✅';
      case 'message_received':
        return '💬';
      case 'exchange_update':
        return '📦';
      default:
        return '🔔';
    }
  };

  const getNotificationTitle = (notification: Notification) => {
    switch (notification.type) {
      case 'proposal_received':
        return 'Nouvelle proposition';
      case 'proposal_accepted':
        return 'Proposition acceptée';
      case 'message_received':
        return 'Nouveau message';
      case 'exchange_update':
        return 'Mise à jour d\'échange';
      default:
        return 'Notification';
    }
  };

  if (!user) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.bellContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          if (onPress) {
            onPress();
          } else {
            setShowModal(true);
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

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Notifications</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead}>
                  <Text style={[styles.markAllReadText, { color: colors.primary }]}>Tout marquer comme lu</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={[styles.closeButton, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.centerContainer}>
                <Bell size={64} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune notification</Text>
              </View>
            ) : (
              <ScrollView style={styles.notificationsList}>
                {notifications.map((notification) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      { borderColor: colors.border },
                      !notification.read_at && { backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => handleNotificationPress(notification)}
                  >
                    <View style={styles.notificationIcon}>
                      <Text style={styles.notificationIconText}>
                        {getNotificationIcon(notification.type)}
                      </Text>
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notificationTitle, { color: colors.text }]}>
                        {getNotificationTitle(notification)}
                      </Text>
                      <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                        {notification.message}
                      </Text>
                      <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
                        {new Date(notification.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    {!notification.read_at && (
                      <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  markAllReadText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  closeButton: {
    fontSize: 24,
    fontWeight: '300',
  },
  centerContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  notificationsList: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
  },
  notificationItemUnread: {},
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationIconText: {
    fontSize: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#19ADFA',
    alignSelf: 'center',
  },
});

