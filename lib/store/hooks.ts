import { useEffect, useState } from 'react';
import { useStore } from './index';
import { Listing, Category, User, Proposal, Exchange, Review, Notification } from '@/lib/supabase';
import { ListingFilters } from './types';

// Hook pour charger les listings avec cache
export function useListings(filters: ListingFilters, options?: { autoLoad?: boolean; forceRefresh?: boolean }) {
  const { loadListings } = useStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(options?.autoLoad !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchListings = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await loadListings(filters, forceRefresh);
      setListings(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.autoLoad !== false) {
      fetchListings(options?.forceRefresh);
    }
  }, [JSON.stringify(filters), options?.forceRefresh]);

  return {
    listings,
    loading,
    error,
    refresh: () => fetchListings(true),
    reload: () => fetchListings(false),
  };
}

// Hook pour charger les catégories avec cache
export function useCategories(options?: { autoLoad?: boolean; forceRefresh?: boolean }) {
  const { loadCategories } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(options?.autoLoad !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategories = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await loadCategories(forceRefresh);
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.autoLoad !== false) {
      fetchCategories(options?.forceRefresh);
    }
  }, [options?.forceRefresh]);

  return {
    categories,
    loading,
    error,
    refresh: () => fetchCategories(true),
    reload: () => fetchCategories(false),
  };
}

// Hook pour charger un utilisateur avec cache
export function useUser(userId: string | null | undefined, options?: { autoLoad?: boolean; forceRefresh?: boolean }) {
  const { loadUser } = useStore();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(options?.autoLoad !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async (forceRefresh = false) => {
    if (!userId) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await loadUser(userId, forceRefresh);
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.autoLoad !== false && userId) {
      fetchUser(options?.forceRefresh);
    }
  }, [userId, options?.forceRefresh]);

  return {
    user,
    loading,
    error,
    refresh: () => fetchUser(true),
    reload: () => fetchUser(false),
  };
}

// Hook pour charger les propositions avec cache
export function useProposals(
  userId: string | null | undefined,
  filter: 'all' | 'sent' | 'received' = 'all',
  options?: { autoLoad?: boolean; forceRefresh?: boolean }
) {
  const { loadProposals } = useStore();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(options?.autoLoad !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProposals = async (forceRefresh = false) => {
    if (!userId) {
      setProposals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await loadProposals(userId, filter, forceRefresh);
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.autoLoad !== false && userId) {
      fetchProposals(options?.forceRefresh);
    }
  }, [userId, filter, options?.forceRefresh]);

  return {
    proposals,
    loading,
    error,
    refresh: () => fetchProposals(true),
    reload: () => fetchProposals(false),
  };
}

// Hook pour charger les échanges avec cache
export function useExchanges(userId: string | null | undefined, options?: { autoLoad?: boolean; forceRefresh?: boolean }) {
  const { loadExchanges } = useStore();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(options?.autoLoad !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchExchanges = async (forceRefresh = false) => {
    if (!userId) {
      setExchanges([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await loadExchanges(userId, forceRefresh);
      setExchanges(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.autoLoad !== false && userId) {
      fetchExchanges(options?.forceRefresh);
    }
  }, [userId, options?.forceRefresh]);

  return {
    exchanges,
    loading,
    error,
    refresh: () => fetchExchanges(true),
    reload: () => fetchExchanges(false),
  };
}

// Hook pour charger les avis avec cache
export function useReviews(userId: string | null | undefined, options?: { autoLoad?: boolean; forceRefresh?: boolean }) {
  const { loadReviews } = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(options?.autoLoad !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchReviews = async (forceRefresh = false) => {
    if (!userId) {
      setReviews([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await loadReviews(userId, forceRefresh);
      setReviews(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.autoLoad !== false && userId) {
      fetchReviews(options?.forceRefresh);
    }
  }, [userId, options?.forceRefresh]);

  return {
    reviews,
    loading,
    error,
    refresh: () => fetchReviews(true),
    reload: () => fetchReviews(false),
  };
}

// Hook pour charger les notifications avec cache
export function useNotifications(userId: string | null | undefined, options?: { autoLoad?: boolean; forceRefresh?: boolean }) {
  const { loadNotifications } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(options?.autoLoad !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotifications = async (forceRefresh = false) => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await loadNotifications(userId, forceRefresh);
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.autoLoad !== false && userId) {
      fetchNotifications(options?.forceRefresh);
    }
  }, [userId, options?.forceRefresh]);

  return {
    notifications,
    loading,
    error,
    refresh: () => fetchNotifications(true),
    reload: () => fetchNotifications(false),
  };
}

// Hook pour charger le nombre de notifications non lues avec cache
export function useUnreadCount(userId: string | null | undefined, options?: { autoLoad?: boolean; forceRefresh?: boolean }) {
  const { loadUnreadCount } = useStore();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(options?.autoLoad !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCount = async (forceRefresh = false) => {
    if (!userId) {
      setCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await loadUnreadCount(userId, forceRefresh);
      setCount(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.autoLoad !== false && userId) {
      fetchCount(options?.forceRefresh);
    }
  }, [userId, options?.forceRefresh]);

  return {
    count,
    loading,
    error,
    refresh: () => fetchCount(true),
    reload: () => fetchCount(false),
  };
}
