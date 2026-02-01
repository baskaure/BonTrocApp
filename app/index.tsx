import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { ListingCard } from '@/components/ListingCard';
import { Filter } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useListings, useCategories } from '@/lib/store/hooks';
import { useHeaderHeightStore } from '@/lib/store/headerHeight';

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'remote' | 'on_site' | 'both'>('all');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Utiliser le store pour charger les listings et catégories
  const { listings, loading, error: listingsError, refresh: refreshListings } = useListings({
    type: filterType,
    mode: filterMode,
    category: filterCategory,
    searchQuery,
  }, { autoLoad: !!user && !authLoading });

  const { categories } = useCategories({ autoLoad: !!user && !authLoading });
  
  // Récupérer la hauteur dynamique du header (hauteur totale avec safe area)
  const { pageHeaderTotalHeight } = useHeaderHeightStore();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/landing');
    }
  }, [authLoading, user]);

  // Recharger silencieusement quand les filtres changent
  useEffect(() => {
    if (user && !authLoading) {
      refreshListings();
    }
  }, [filterType, filterMode, filterCategory, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    refreshListings();
    setTimeout(() => setRefreshing(false), 500);
  };

  if (authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#19ADFA" />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={[styles.contentWrapper, { marginTop: pageHeaderTotalHeight }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textSecondary}
            colors={[colors.primary]}
          />
        }
      >

        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Rechercher..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textTertiary}
          />
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Filter size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={[styles.filtersContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Type</Text>
              <View style={styles.filterButtons}>
                {['all', 'service', 'product'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setFilterType(type as any)}
                    style={[
                      styles.filterButton,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      filterType === type && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      { color: colors.textSecondary },
                      filterType === type && styles.filterButtonTextActive
                    ]}>
                      {type === 'all' ? 'Tous' : type === 'service' ? 'Services' : 'Produits'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Mode</Text>
              <View style={styles.filterButtons}>
                {['all', 'remote', 'on_site', 'both'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setFilterMode(mode as any)}
                    style={[
                      styles.filterButton,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      filterMode === mode && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      { color: colors.textSecondary },
                      filterMode === mode && styles.filterButtonTextActive
                    ]}>
                      {mode === 'all' ? 'Tous' : mode === 'remote' ? 'Distance' : mode === 'on_site' ? 'Présentiel' : 'Les deux'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#19ADFA" />
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.emptyContainer}>
          {listingsError && <Text style={[styles.emptyText, { color: colors.error }]}>{listingsError.message}</Text>}
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune annonce trouvée</Text>
            <TouchableOpacity
              onPress={() => router.push('/listing/create')}
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.emptyButtonText}>Créer une annonce</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listingsGrid}>
            {listings.map((listing) => (
              <View key={listing.id} style={styles.listingCardWrapper}>
                <ListingCard
                  listing={listing}
                  onPress={() => router.push(`/listing/${listing.id}`)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 100, // Espace pour la bottom bar fixe
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButton: {
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  filtersContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButtonText: {
    fontSize: 12,
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 16,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 16,
  },
  listingCardWrapper: {
    width: '50%',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
