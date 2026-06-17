import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { usePathname } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import { NotificationBell } from './NotificationBell';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';
import { useAuth } from '@/lib/auth-context';

/** Logo BonTroc : deux chevrons (bleu ← / jaune →) + mot-symbole. */
function BonTrocLogo({ primary, secondary, ink }: { primary: string; secondary: string; ink: string }) {
  return (
    <View style={styles.logo}>
      <Svg width={22} height={17} viewBox="0 0 26 20" fill="none">
        <Path d="M11 3 3 10l8 7" stroke={primary} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3 10h7" stroke={primary} strokeWidth={3.4} strokeLinecap="round" />
      </Svg>
      <Svg width={22} height={17} viewBox="0 0 26 20" fill="none" style={styles.logoArrow2}>
        <Path d="M15 3 23 10l-8 7" stroke={secondary} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M23 10h-7" stroke={secondary} strokeWidth={3.4} strokeLinecap="round" />
      </Svg>
      <Text style={styles.logoText}>
        <Text style={{ color: primary }}>Bon</Text>
        <Text style={{ color: ink }}>Troc</Text>
      </Text>
    </View>
  );
}

export const AppHeader = React.memo(() => {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { user } = useAuth();
  const { setPageHeaderHeight, safeAreaTop } = useHeaderHeightStore();

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const { height: headerHeight } = event.nativeEvent.layout;
    setPageHeaderHeight(headerHeight);
  }, [setPageHeaderHeight]);

  // Config du header selon la route
  const headerConfig = useMemo(() => {
    if (!user) return null;
    if (pathname === '/') {
      return { showLogo: true, title: '', subtitle: '', showNotificationBell: true };
    }
    if (pathname === '/proposals') {
      return { showLogo: false, title: 'Mes propositions', subtitle: 'Pilotez vos offres jusqu\'à l\'échange.', showNotificationBell: false };
    }
    if (pathname === '/exchanges') {
      return { showLogo: false, title: 'Mes échanges', subtitle: 'Suivez vos échanges en cours et passés.', showNotificationBell: false };
    }
    return null;
  }, [pathname, user]);

  if (!headerConfig) return null;

  const { showLogo, title, subtitle, showNotificationBell } = headerConfig;

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
        {showLogo ? (
          <BonTrocLogo primary={colors.primary} secondary={colors.secondary} ink={colors.text} />
        ) : (
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {!!subtitle && <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>}
          </View>
        )}
        <View style={styles.headerActions}>
          {showNotificationBell && <NotificationBell />}
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
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoArrow2: {
    marginLeft: -8,
    marginRight: 6,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
