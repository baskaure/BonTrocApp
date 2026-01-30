import { Listing, Category, User, Proposal, Exchange, Review, Notification } from '@/lib/supabase';

// Types pour le cache avec timestamps
export interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresIn?: number; // Durée de validité en ms (optionnel)
}

// Types pour les filtres de listings
export interface ListingFilters {
  type?: 'all' | 'service' | 'product';
  mode?: 'all' | 'remote' | 'on_site' | 'both';
  category?: string | null;
  searchQuery?: string;
}

// Clé de cache pour les listings (basée sur les filtres)
export type ListingCacheKey = string;

// Durées de cache par défaut (en millisecondes)
export const CACHE_DURATIONS = {
  listings: 2 * 60 * 1000, // 2 minutes
  categories: 10 * 60 * 1000, // 10 minutes (rarement changent)
  users: 5 * 60 * 1000, // 5 minutes
  proposals: 1 * 60 * 1000, // 1 minute
  exchanges: 1 * 60 * 1000, // 1 minute
  reviews: 5 * 60 * 1000, // 5 minutes
  notifications: 30 * 1000, // 30 secondes
} as const;
