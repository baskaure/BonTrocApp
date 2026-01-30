import { create } from 'zustand';
import { supabase, Listing, Category, User, Proposal, Exchange, Review, Notification } from '@/lib/supabase';
import { CachedData, ListingFilters, ListingCacheKey, CACHE_DURATIONS } from './types';

// Helper pour générer une clé de cache à partir des filtres
function getListingCacheKey(filters: ListingFilters): ListingCacheKey {
  return JSON.stringify({
    type: filters.type || 'all',
    mode: filters.mode || 'all',
    category: filters.category || null,
    searchQuery: filters.searchQuery || '',
  });
}

// Helper pour vérifier si les données sont encore valides
function isCacheValid<T>(cached: CachedData<T> | null, duration: number): boolean {
  if (!cached) return false;
  const now = Date.now();
  const age = now - cached.timestamp;
  return age < duration;
}

// Store principal
interface StoreState {
  // Listings
  listingsCache: Map<ListingCacheKey, CachedData<Listing[]>>;
  loadListings: (filters: ListingFilters, forceRefresh?: boolean) => Promise<Listing[]>;
  
  // Categories
  categoriesCache: CachedData<Category[]> | null;
  loadCategories: (forceRefresh?: boolean) => Promise<Category[]>;
  
  // Users
  usersCache: Map<string, CachedData<User>>;
  loadUser: (userId: string, forceRefresh?: boolean) => Promise<User | null>;
  updateUserCache: (user: User) => void;
  
  // Proposals
  proposalsCache: Map<string, CachedData<Proposal[]>>; // key = userId + filter
  loadProposals: (userId: string, filter: 'all' | 'sent' | 'received', forceRefresh?: boolean) => Promise<Proposal[]>;
  
  // Exchanges
  exchangesCache: Map<string, CachedData<Exchange[]>>; // key = userId
  loadExchanges: (userId: string, forceRefresh?: boolean) => Promise<Exchange[]>;
  
  // Reviews
  reviewsCache: Map<string, CachedData<Review[]>>; // key = userId
  loadReviews: (userId: string, forceRefresh?: boolean) => Promise<Review[]>;
  
  // Notifications
  notificationsCache: Map<string, CachedData<Notification[]>>; // key = userId
  unreadCountCache: Map<string, CachedData<number>>; // key = userId
  loadNotifications: (userId: string, forceRefresh?: boolean) => Promise<Notification[]>;
  loadUnreadCount: (userId: string, forceRefresh?: boolean) => Promise<number>;
  
  // Actions de nettoyage
  clearCache: () => void;
  clearUserCache: (userId: string) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  // Initialisation des caches
  listingsCache: new Map(),
  categoriesCache: null,
  usersCache: new Map(),
  proposalsCache: new Map(),
  exchangesCache: new Map(),
  reviewsCache: new Map(),
  notificationsCache: new Map(),
  unreadCountCache: new Map(),

  // Load Listings
  loadListings: async (filters: ListingFilters, forceRefresh = false) => {
    const cacheKey = getListingCacheKey(filters);
    const cached = get().listingsCache.get(cacheKey);
    
    // Si les données sont en cache et valides, les retourner immédiatement
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.listings)) {
      return cached!.data;
    }
    
    // Sinon, charger depuis l'API
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

      if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }

      if (filters.mode && filters.mode !== 'all') {
        query = query.eq('mode', filters.mode);
      }

      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }

      if (filters.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,description_offer.ilike.%${filters.searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const listings = data || [];
      
      // Mettre en cache
      set((state) => {
        const newCache = new Map(state.listingsCache);
        newCache.set(cacheKey, {
          data: listings,
          timestamp: Date.now(),
        });
        return { listingsCache: newCache };
      });
      
      return listings;
    } catch (error) {
      console.error('Error loading listings:', error);
      // En cas d'erreur, retourner le cache même s'il est expiré
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  },

  // Load Categories
  loadCategories: async (forceRefresh = false) => {
    const cached = get().categoriesCache;
    
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.categories)) {
      return cached!.data;
    }
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      
      const categories = data || [];
      
      set({
        categoriesCache: {
          data: categories,
          timestamp: Date.now(),
        },
      });
      
      return categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  },

  // Load User
  loadUser: async (userId: string, forceRefresh = false) => {
    const cached = get().usersCache.get(userId);
    
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.users)) {
      return cached!.data;
    }
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      // Mettre en cache
      set((state) => {
        const newCache = new Map(state.usersCache);
        newCache.set(userId, {
          data,
          timestamp: Date.now(),
        });
        return { usersCache: newCache };
      });
      
      return data;
    } catch (error) {
      console.error('Error loading user:', error);
      if (cached) {
        return cached.data;
      }
      return null;
    }
  },

  // Update User Cache
  updateUserCache: (user: User) => {
    set((state) => {
      const newCache = new Map(state.usersCache);
      newCache.set(user.id, {
        data: user,
        timestamp: Date.now(),
      });
      return { usersCache: newCache };
    });
  },

  // Load Proposals
  loadProposals: async (userId: string, filter: 'all' | 'sent' | 'received', forceRefresh = false) => {
    const cacheKey = `${userId}:${filter}`;
    const cached = get().proposalsCache.get(cacheKey);
    
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.proposals)) {
      return cached!.data;
    }
    
    try {
      let query = supabase
        .from('proposals')
        .select(`
          *,
          from_user:users!proposals_from_user_id_fkey(*),
          to_user:users!proposals_to_user_id_fkey(*),
          listing:listings(*)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'sent') {
        query = query.eq('from_user_id', userId);
      } else if (filter === 'received') {
        query = query.eq('to_user_id', userId);
      } else {
        query = query.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const proposals = data || [];
      
      set((state) => {
        const newCache = new Map(state.proposalsCache);
        newCache.set(cacheKey, {
          data: proposals,
          timestamp: Date.now(),
        });
        return { proposalsCache: newCache };
      });
      
      return proposals;
    } catch (error) {
      console.error('Error loading proposals:', error);
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  },

  // Load Exchanges
  loadExchanges: async (userId: string, forceRefresh = false) => {
    const cached = get().exchangesCache.get(userId);
    
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.exchanges)) {
      return cached!.data;
    }
    
    try {
      const { data, error } = await supabase
        .from('exchanges')
        .select(`
          *,
          dispute:disputes(*),
          contract:contracts(
            *,
            proposal:proposals(
              *,
              from_user:users!proposals_from_user_id_fkey(display_name, avatar_url),
              to_user:users!proposals_to_user_id_fkey(display_name, avatar_url),
              listing:listings(title)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrer pour ne garder que les échanges de l'utilisateur
      const filtered = data?.filter((ex: any) => {
        const proposal = ex.contract?.proposal;
        if (!proposal) return false;
        return proposal.from_user_id === userId || proposal.to_user_id === userId;
      }) || [];

      const normalized = filtered.map((ex: any) => ({
        ...ex,
        dispute: Array.isArray(ex.dispute) ? ex.dispute[0] : ex.dispute,
      }));
      
      set((state) => {
        const newCache = new Map(state.exchangesCache);
        newCache.set(userId, {
          data: normalized,
          timestamp: Date.now(),
        });
        return { exchangesCache: newCache };
      });
      
      return normalized;
    } catch (error) {
      console.error('Error loading exchanges:', error);
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  },

  // Load Reviews
  loadReviews: async (userId: string, forceRefresh = false) => {
    const cached = get().reviewsCache.get(userId);
    
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.reviews)) {
      return cached!.data;
    }
    
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:users!reviews_reviewer_id_fkey(display_name, avatar_url)
        `)
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const reviews = data || [];
      
      set((state) => {
        const newCache = new Map(state.reviewsCache);
        newCache.set(userId, {
          data: reviews,
          timestamp: Date.now(),
        });
        return { reviewsCache: newCache };
      });
      
      return reviews;
    } catch (error) {
      console.error('Error loading reviews:', error);
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  },

  // Load Notifications
  loadNotifications: async (userId: string, forceRefresh = false) => {
    const cached = get().notificationsCache.get(userId);
    
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.notifications)) {
      return cached!.data;
    }
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === 'PGRST205') {
          // Table n'existe pas
          return [];
        }
        throw error;
      }
      
      const notifications = data || [];
      
      set((state) => {
        const newCache = new Map(state.notificationsCache);
        newCache.set(userId, {
          data: notifications,
          timestamp: Date.now(),
        });
        return { notificationsCache: newCache };
      });
      
      return notifications;
    } catch (error) {
      console.error('Error loading notifications:', error);
      if (cached) {
        return cached.data;
      }
      return [];
    }
  },

  // Load Unread Count
  loadUnreadCount: async (userId: string, forceRefresh = false) => {
    const cached = get().unreadCountCache.get(userId);
    
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.notifications)) {
      return cached!.data;
    }
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .is('read_at', null);

      if (error) {
        if (error.code === 'PGRST205') {
          return 0;
        }
        throw error;
      }
      
      const count = data?.length || 0;
      
      set((state) => {
        const newCache = new Map(state.unreadCountCache);
        newCache.set(userId, {
          data: count,
          timestamp: Date.now(),
        });
        return { unreadCountCache: newCache };
      });
      
      return count;
    } catch (error) {
      console.error('Error loading unread count:', error);
      if (cached) {
        return cached.data;
      }
      return 0;
    }
  },

  // Clear Cache
  clearCache: () => {
    set({
      listingsCache: new Map(),
      categoriesCache: null,
      usersCache: new Map(),
      proposalsCache: new Map(),
      exchangesCache: new Map(),
      reviewsCache: new Map(),
      notificationsCache: new Map(),
      unreadCountCache: new Map(),
    });
  },

  // Clear User Cache
  clearUserCache: (userId: string) => {
    set((state) => {
      const newUsersCache = new Map(state.usersCache);
      newUsersCache.delete(userId);
      
      const newProposalsCache = new Map(state.proposalsCache);
      Array.from(newProposalsCache.keys()).forEach(key => {
        if (key.startsWith(`${userId}:`)) {
          newProposalsCache.delete(key);
        }
      });
      
      const newExchangesCache = new Map(state.exchangesCache);
      newExchangesCache.delete(userId);
      
      const newReviewsCache = new Map(state.reviewsCache);
      newReviewsCache.delete(userId);
      
      const newNotificationsCache = new Map(state.notificationsCache);
      newNotificationsCache.delete(userId);
      
      const newUnreadCountCache = new Map(state.unreadCountCache);
      newUnreadCountCache.delete(userId);
      
      return {
        usersCache: newUsersCache,
        proposalsCache: newProposalsCache,
        exchangesCache: newExchangesCache,
        reviewsCache: newReviewsCache,
        notificationsCache: newNotificationsCache,
        unreadCountCache: newUnreadCountCache,
      };
    });
  },
}));
