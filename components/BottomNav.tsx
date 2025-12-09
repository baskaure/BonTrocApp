import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { Grid, List, Package } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { colors } = useTheme();

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  if (!user) return null;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/')}
        >
          <Grid size={24} color={isActive('/') ? colors.primary : colors.textSecondary} />
          <Text style={[styles.navButtonText, { color: isActive('/') ? colors.primary : colors.textSecondary }, isActive('/') && styles.navButtonTextActive]}>
            Annonces
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/proposals')}
        >
          <List size={24} color={isActive('/proposals') ? colors.primary : colors.textSecondary} />
          <Text style={[styles.navButtonText, { color: isActive('/proposals') ? colors.primary : colors.textSecondary }, isActive('/proposals') && styles.navButtonTextActive]}>
            Propositions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/exchanges')}
        >
          <Package size={24} color={isActive('/exchanges') ? colors.primary : colors.textSecondary} />
          <Text style={[styles.navButtonText, { color: isActive('/exchanges') ? colors.primary : colors.textSecondary }, isActive('/exchanges') && styles.navButtonTextActive]}>
            Échanges
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/profile')}
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
          {isActive('/profile') && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
});

