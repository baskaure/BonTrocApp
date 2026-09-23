import { create } from 'zustand';
import { supabase, Listing, Category, PublicProfile, Proposal, Exchange, Review } from '@/lib/supabase';
import { EXCHANGE_SELECT, LISTING_SELECT, PROPOSAL_SELECT, PUBLIC_PROFILE_COLS, REVIEW_SELECT } from '@/lib/queries';
import { CachedData, ListingFilters, ListingCacheKey, CACHE_DURATIONS } from './types';

/** Nombre d'annonces chargées par requête (le site pagine par 24). */
const LISTINGS_PAGE_SIZE = 60;

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
function isCacheValid<T>(cached: CachedData<T> | null | undefined, duration: number): boolean {
  if (!cached) return false;
  return Date.now() - cached.timestamp < duration;
}

/** Échappe les caractères réservés par PostgREST dans un filtre `or(...ilike...)`. */
function escapeSearch(value: string) {
  return value.replace(/[,()"\\%]/g, ' ').trim();
}

// Store principal
interface StoreState {
  // Listings
  listingsCache: Map<ListingCacheKey, CachedData<Listing[]>>;
  loadListings: (filters: ListingFilters, forceRefresh?: boolean) => Promise<Listing[]>;
  invalidateListings: () => void;

  // Categories
  categoriesCache: CachedData<Category[]> | null;
  loadCategories: (forceRefresh?: boolean) => Promise<Category[]>;

  // Profils publics des autres membres (vue public_profiles)
  usersCache: Map<string, CachedData<PublicProfile>>;
  loadUser: (userId: string, forceRefresh?: boolean) => Promise<PublicProfile | null>;

  // Proposals
  proposalsCache: Map<string, CachedData<Proposal[]>>; // key = userId + filter
  loadProposals: (userId: string, filter: 'all' | 'sent' | 'received', forceRefresh?: boolean) => Promise<Proposal[]>;
  invalidateProposals: (userId?: string) => void;

  // Exchanges
  exchangesCache: Map<string, CachedData<Exchange[]>>; // key = userId
  loadExchanges: (userId: string, forceRefresh?: boolean) => Promise<Exchange[]>;
  invalidateExchanges: (userId?: string) => void;

  // Reviews
  reviewsCache: Map<string, CachedData<Review[]>>; // key = userId (reviewee)
  loadReviews: (userId: string, forceRefresh?: boolean) => Promise<Review[]>;

  // Actions de nettoyage
  clearCache: () => void;
  clearUserCache: (userId: string) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  listingsCache: new Map(),
  categoriesCache: null,
  usersCache: new Map(),
  proposalsCache: new Map(),
  exchangesCache: new Map(),
  reviewsCache: new Map(),

  // Load Listings
  loadListings: async (filters: ListingFilters, forceRefresh = false) => {
    const cacheKey = getListingCacheKey(filters);
    const cached = get().listingsCache.get(cacheKey);

    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.listings)) {
      return cached!.data;
    }

    try {
      let query = supabase
        .from('listings')
        .select(LISTING_SELECT)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(LISTINGS_PAGE_SIZE);

      if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type);
      if (filters.mode && filters.mode !== 'all') query = query.eq('mode', filters.mode);
      if (filters.category) query = query.eq('category_id', filters.category);
      if (filters.searchQuery) {
        const q = escapeSearch(filters.searchQuery);
        if (q) query = query.or(`title.ilike.%${q}%,description_offer.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Un membre supprimé ou banni conserve ses lignes : son profil public est masqué, on écarte l'annonce.
      const listings = ((data || []) as unknown as Listing[]).filter((l) => l.user && l.user.status !== 'deleted');

      set((state) => {
        const newCache = new Map(state.listingsCache);
        newCache.set(cacheKey, { data: listings, timestamp: Date.now() });
        return { listingsCache: newCache };
      });

      return listings;
    } catch (error) {
      console.error('Error loading listings:', error);
      if (cached) return cached.data;
      throw error;
    }
  },

  invalidateListings: () => set({ listingsCache: new Map() }),

  // Load Categories
  loadCategories: async (forceRefresh = false) => {
    const cached = get().categoriesCache;
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.categories)) {
      return cached!.data;
    }

    try {
      const { data, error } = await supabase.from('categories').select('id, name, slug, icon, sort_order').order('sort_order');
      if (error) throw error;
      const categories = (data || []) as Category[];
      set({ categoriesCache: { data: categories, timestamp: Date.now() } });
      return categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      if (cached) return cached.data;
      throw error;
    }
  },

  // Load public profile
  loadUser: async (userId: string, forceRefresh = false) => {
    const cached = get().usersCache.get(userId);
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.users)) {
      return cached!.data;
    }

    try {
      const { data, error } = await supabase
        .from('public_profiles')
        .select(`${PUBLIC_PROFILE_COLS}, banner_url, bio, languages, skills, created_at`)
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const profile = data as unknown as PublicProfile;
      set((state) => {
        const newCache = new Map(state.usersCache);
        newCache.set(userId, { data: profile, timestamp: Date.now() });
        return { usersCache: newCache };
      });
      return profile;
    } catch (error) {
      console.error('Error loading user:', error);
      if (cached) return cached.data;
      return null;
    }
  },

  // Load Proposals
  loadProposals: async (userId: string, filter: 'all' | 'sent' | 'received', forceRefresh = false) => {
    const cacheKey = `${userId}:${filter}`;
    const cached = get().proposalsCache.get(cacheKey);
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.proposals)) {
      return cached!.data;
    }

    try {
      let query = supabase.from('proposals').select(PROPOSAL_SELECT).order('created_at', { ascending: false }).limit(100);

      if (filter === 'sent') query = query.eq('from_user_id', userId);
      else if (filter === 'received') query = query.eq('to_user_id', userId);
      else query = query.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);

      const { data, error } = await query;
      if (error) throw error;

      const proposals = (data || []) as unknown as Proposal[];
      set((state) => {
        const newCache = new Map(state.proposalsCache);
        newCache.set(cacheKey, { data: proposals, timestamp: Date.now() });
        return { proposalsCache: newCache };
      });
      return proposals;
    } catch (error) {
      console.error('Error loading proposals:', error);
      if (cached) return cached.data;
      throw error;
    }
  },

  invalidateProposals: (userId) =>
    set((state) => {
      const next = new Map(state.proposalsCache);
      for (const key of next.keys()) if (!userId || key.startsWith(`${userId}:`)) next.delete(key);
      return { proposalsCache: next };
    }),

  // Load Exchanges
  loadExchanges: async (userId: string, forceRefresh = false) => {
    const cached = get().exchangesCache.get(userId);
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.exchanges)) {
      return cached!.data;
    }

    try {
      const { data, error } = await supabase.from('exchanges').select(EXCHANGE_SELECT).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;

      // La RLS ne renvoie que les échanges de l'utilisateur ; on filtre tout de même et on normalise le litige.
      const normalized = ((data || []) as unknown as (Exchange & { dispute?: unknown })[])
        .filter((ex) => {
          const proposal = ex.contract?.proposal;
          return !!proposal && (proposal.from_user_id === userId || proposal.to_user_id === userId);
        })
        .map((ex) => ({
          ...ex,
          dispute: Array.isArray(ex.dispute) ? (ex.dispute.find((d) => d.status === 'open' || d.status === 'in_review') ?? ex.dispute[0] ?? null) : (ex.dispute ?? null),
        })) as Exchange[];

      set((state) => {
        const newCache = new Map(state.exchangesCache);
        newCache.set(userId, { data: normalized, timestamp: Date.now() });
        return { exchangesCache: newCache };
      });
      return normalized;
    } catch (error) {
      console.error('Error loading exchanges:', error);
      if (cached) return cached.data;
      throw error;
    }
  },

  invalidateExchanges: (userId) =>
    set((state) => {
      const next = new Map(state.exchangesCache);
      if (userId) next.delete(userId);
      else next.clear();
      return { exchangesCache: next };
    }),

  // Load Reviews (reçus par un membre)
  loadReviews: async (userId: string, forceRefresh = false) => {
    const cached = get().reviewsCache.get(userId);
    if (!forceRefresh && isCacheValid(cached, CACHE_DURATIONS.reviews)) {
      return cached!.data;
    }

    try {
      const { data, error } = await supabase.from('reviews').select(REVIEW_SELECT).eq('reviewee_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      const reviews = (data || []) as unknown as Review[];
      set((state) => {
        const newCache = new Map(state.reviewsCache);
        newCache.set(userId, { data: reviews, timestamp: Date.now() });
        return { reviewsCache: newCache };
      });
      return reviews;
    } catch (error) {
      console.error('Error loading reviews:', error);
      if (cached) return cached.data;
      throw error;
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
    });
  },

  // Clear User Cache
  clearUserCache: (userId: string) => {
    set((state) => {
      const newUsersCache = new Map(state.usersCache);
      newUsersCache.delete(userId);

      const newProposalsCache = new Map(state.proposalsCache);
      Array.from(newProposalsCache.keys()).forEach((key) => {
        if (key.startsWith(`${userId}:`)) newProposalsCache.delete(key);
      });

      const newExchangesCache = new Map(state.exchangesCache);
      newExchangesCache.delete(userId);

      const newReviewsCache = new Map(state.reviewsCache);
      newReviewsCache.delete(userId);

      return {
        usersCache: newUsersCache,
        proposalsCache: newProposalsCache,
        exchangesCache: newExchangesCache,
        reviewsCache: newReviewsCache,
      };
    });
  },
}));
