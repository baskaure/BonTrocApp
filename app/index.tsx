import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase, Listing, Category } from '@/lib/supabase';
import { ListingCard } from '@/components/ListingCard';
import { CreateListingModal } from '@/components/CreateListingModal';
import { ListingDetailModal } from '@/components/ListingDetailModal';
import { BottomNav } from '@/components/BottomNav';
import { Filter } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationBell } from '@/components/NotificationBell';

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'remote' | 'on_site' | 'both'>('all');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/landing');
      } else {
        // Utilisateur connecté, charger les données
        loadCategories();
        loadListings();
      }
    }
  }, [authLoading, user]);

  // Charger les listings quand les filtres changent (seulement si user est connecté)
  useEffect(() => {
    if (user && !authLoading) {
      loadListings();
    }
  }, [filterType, filterMode, filterCategory, searchQuery]);

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');
    if (data) setCategories(data);
  }

  async function loadListings() {
    if (!refreshing) setLoading(true);
    try {
      let query = supabase
        .from('listings')
        .select(`
          *,
          user:users(*),
          media:listing_media(*)
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      if (filterMode !== 'all') {
        query = query.eq('mode', filterMode);
      }

      if (filterCategory) {
        query = query.eq('category_id', filterCategory);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description_offer.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadListings();
            }}
            tintColor={colors.textSecondary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Annonces</Text>
          <View style={styles.headerActions}>
            <NotificationBell />
            <TouchableOpacity onPress={() => setShowCreateModal(true)} style={[styles.createButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.createButtonText}>+ Créer</Text>
            </TouchableOpacity>
          </View>
        </View>

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
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune annonce trouvée</Text>
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
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
                  onPress={() => setSelectedListing(listing)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomNav />

      <CreateListingModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadListings}
      />

      <ListingDetailModal
        listing={selectedListing}
        visible={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        onSuccess={loadListings}
        onUserClick={(userId) => {
          setSelectedListing(null);
          router.push(`/user/${userId}`);
        }}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
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
    gap: 12,
    paddingBottom: 16,
  },
  listingCardWrapper: {
    width: '48%',
  },
});
