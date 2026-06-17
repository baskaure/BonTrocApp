import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { Compass, FileText, ArrowLeftRight, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotificationBadges } from '@/hooks/useNotificationBadges';

export const BottomNav = React.memo(() => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { colors, radius, shadows } = useTheme();
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
  const navigate = useCallback((path: '/' | '/proposals' | '/exchanges' | '/profile') => {
    if (pathname === path) return;
    router.replace(path);
  }, [pathname, router]);

  // La barre d'onglets ne s'affiche que sur les écrans de premier niveau.
  // Les écrans de détail (poussés avec bouton retour) sont en plein écran.
  const TAB_ROUTES = ['/', '/proposals', '/exchanges', '/profile'];
  if (!user || !TAB_ROUTES.includes(pathname)) return null;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: colors.surface }]} pointerEvents="box-none">
      <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigate('/')}
          activeOpacity={0.7}
        >
          <Compass size={23} color={activeStates.home ? colors.primary : colors.textTertiary} />
          <Text style={[styles.navButtonText, { color: activeStates.home ? colors.primary : colors.textTertiary }]}>
            Annonces
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigate('/proposals')}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <FileText size={23} color={activeStates.proposals ? colors.primary : colors.textTertiary} />
            {badges.proposals > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.surface }]}>
                <Text style={styles.badgeText}>{badges.proposals > 9 ? '9+' : String(badges.proposals)}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navButtonText, { color: activeStates.proposals ? colors.primary : colors.textTertiary }]}>
            Propositions
          </Text>
        </TouchableOpacity>

        {/* Bouton central : créer une annonce */}
        <View style={styles.centerSlot} pointerEvents="box-none">
          <TouchableOpacity
            style={[
              styles.centerButton,
              { backgroundColor: colors.primary, borderColor: colors.surface, borderRadius: radius.lg + 2 },
              shadows.card,
              { shadowColor: colors.primary },
            ]}
            onPress={() => router.push('/listing/create')}
            activeOpacity={0.85}
          >
            <Plus size={26} color={colors.onPrimary} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigate('/exchanges')}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <ArrowLeftRight size={23} color={activeStates.exchanges ? colors.primary : colors.textTertiary} />
            {badges.exchanges > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.surface }]}>
                <Text style={styles.badgeText}>{badges.exchanges > 9 ? '9+' : String(badges.exchanges)}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navButtonText, { color: activeStates.exchanges ? colors.primary : colors.textTertiary }]}>
            Échanges
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigate('/profile')}
          activeOpacity={0.7}
        >
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={[styles.profileAvatar, { borderColor: activeStates.profile ? colors.primary : colors.border }]} />
          ) : (
            <View style={[styles.profileAvatarPlaceholder, { backgroundColor: colors.primary, borderColor: activeStates.profile ? colors.primary : colors.border }]}>
              <Text style={[styles.profileAvatarText, { color: colors.onPrimary }]}>
                {user.display_name[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <Text style={[styles.navButtonText, { color: activeStates.profile ? colors.primary : colors.textTertiary }]}>
            Profil
          </Text>
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
  },
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  navButton: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
    position: 'relative',
  },
  navButtonText: {
    fontSize: 10,
    fontWeight: '700',
  },
  centerSlot: {
    flex: 0,
    width: 64,
    alignItems: 'center',
  },
  centerButton: {
    width: 56,
    height: 56,
    marginTop: -26,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  profileAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  profileAvatarText: {
    fontWeight: 'bold',
    fontSize: 13,
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
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
