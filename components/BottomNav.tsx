import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { Grid, List, Package } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotificationBadges } from '@/hooks/useNotificationBadges';

export const BottomNav = React.memo(() => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { colors } = useTheme();
  const badges = useNotificationBadges();

  const isActive = useCallback((path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  }, [pathname]);

  // Mémoriser les états actifs pour éviter les recalculs
  const activeStates = useMemo(() => ({
    home: isActive('/'),
    proposals: isActive('/proposals'),
    exchanges: isActive('/exchanges'),
    profile: isActive('/profile'),
  }), [isActive]);

  // Navigation instantanée sans animation
  const navigate = useCallback((path: string) => {
    if (pathname === path) return; // Déjà sur cette page
    router.replace(path); // Utiliser replace pour une navigation instantanée
  }, [pathname, router]);

  if (!user) return null;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: colors.surface }]} pointerEvents="box-none">
      <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigate('/')}
          activeOpacity={0.7}
        >
          <Grid size={24} color={activeStates.home ? colors.primary : colors.textSecondary} />
          <Text style={[styles.navButtonText, { color: activeStates.home ? colors.primary : colors.textSecondary }, activeStates.home && styles.navButtonTextActive]}>
            Annonces
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigate('/proposals')}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <List size={24} color={activeStates.proposals ? colors.primary : colors.textSecondary} />
            {badges.proposals > 0 && (
              <View style={[styles.badge, { backgroundColor: '#EF4444', borderColor: colors.background }]}>
                <Text style={styles.badgeText}>{badges.proposals > 9 ? '9+' : String(badges.proposals)}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navButtonText, { color: activeStates.proposals ? colors.primary : colors.textSecondary }, activeStates.proposals && styles.navButtonTextActive]}>
            Propositions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigate('/exchanges')}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Package size={24} color={activeStates.exchanges ? colors.primary : colors.textSecondary} />
            {badges.exchanges > 0 && (
              <View style={[styles.badge, { backgroundColor: '#EF4444', borderColor: colors.background }]}>
                <Text style={styles.badgeText}>{badges.exchanges > 9 ? '9+' : String(badges.exchanges)}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navButtonText, { color: activeStates.exchanges ? colors.primary : colors.textSecondary }, activeStates.exchanges && styles.navButtonTextActive]}>
            Échanges
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigate('/profile')}
          activeOpacity={0.7}
        >
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={[styles.profileAvatar, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.profileAvatarPlaceholder, { borderColor: colors.border }]}>
              <Text style={styles.profileAvatarText}>
                {user.display_name[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          {activeStates.profile && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    // backgroundColor will be set dynamically
  },
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navButton: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
    position: 'relative',
  },
  navButtonText: {
    fontSize: 11,
  },
  navButtonTextActive: {
    fontWeight: '600',
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  profileAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  profileAvatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

