import { useEffect, useState } from 'react';
import { useStore } from './index';
import { Listing, Category, PublicProfile, Proposal, Exchange, Review } from '@/lib/supabase';
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

// Hook pour charger le profil public d'un membre avec cache
export function useUser(userId: string | null | undefined, options?: { autoLoad?: boolean; forceRefresh?: boolean }) {
  const { loadUser } = useStore();
  const [user, setUser] = useState<PublicProfile | null>(null);
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

// Hook pour charger les avis reçus avec cache
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
