import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { NotificationBell } from './NotificationBell';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';
import { useAuth } from '@/lib/auth-context';

export const AppHeader = React.memo(() => {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { setPageHeaderHeight, safeAreaTop } = useHeaderHeightStore();

  const handleCreate = useCallback(() => {
    router.push('/listing/create');
  }, [router]);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const { height: headerHeight } = event.nativeEvent.layout;
    setPageHeaderHeight(headerHeight);
  }, [setPageHeaderHeight]);

  // Config du header selon la route
  const headerConfig = useMemo(() => {
    if (!user) return null;
    if (pathname === '/') {
      return { title: 'Annonces', showNotificationBell: true, showCreateButton: true };
    }
    if (pathname === '/proposals') {
      return { title: 'Mes propositions', showNotificationBell: false, showCreateButton: false };
    }
    if (pathname === '/exchanges') {
      return { title: 'Mes échanges', showNotificationBell: false, showCreateButton: false };
    }
    return null;
  }, [pathname, user]);

  if (!headerConfig) return null;

  const { title, showNotificationBell, showCreateButton } = headerConfig;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: safeAreaTop,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[styles.header, { backgroundColor: colors.background }]}
        onLayout={onHeaderLayout}
      >
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={styles.headerActions}>
          {showNotificationBell && <NotificationBell />}
          {showCreateButton && (
            <TouchableOpacity
              onPress={handleCreate}
              style={[styles.createButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.createButtonText}>+ Créer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});
