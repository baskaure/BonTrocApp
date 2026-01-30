import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { NotificationBell } from './NotificationBell';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';

type PageHeaderProps = {
  title: string;
  showNotificationBell?: boolean;
  showCreateButton?: boolean;
  createButtonLabel?: string;
  onCreatePress?: () => void;
  rightAction?: React.ReactNode;
};

export const PageHeader = React.memo<PageHeaderProps>(({
  title,
  showNotificationBell = false,
  showCreateButton = false,
  createButtonLabel = '+ Créer',
  onCreatePress,
  rightAction,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const { setPageHeaderHeight, safeAreaTop } = useHeaderHeightStore();

  const handleCreate = useMemo(() => {
    if (onCreatePress) return onCreatePress;
    return () => router.push('/listing/create');
  }, [onCreatePress, router]);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const { height: headerHeight } = event.nativeEvent.layout;
    // Stocker uniquement la hauteur du header (sans safe area)
    // La hauteur totale sera calculée automatiquement dans le store
    setPageHeaderHeight(headerHeight);
  }, [setPageHeaderHeight]);

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          paddingTop: safeAreaTop, // Utiliser la safe area du store directement
        }
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
              <Text style={styles.createButtonText}>{createButtonLabel}</Text>
            </TouchableOpacity>
          )}
          {rightAction}
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
