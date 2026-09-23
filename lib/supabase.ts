import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Expo charge automatiquement les variables EXPO_PUBLIC_* depuis le .env.
// On nettoie (espaces, slash final) : le .env du site et celui de l'app ne sont pas toujours propres.
const rawUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '')
  .trim()
  .replace(/\/+$/, '');
const rawKey = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '').trim();

if (!rawUrl || !rawKey) {
  throw new Error('Configuration Supabase manquante. Vérifiez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

export const SUPABASE_URL = rawUrl;

/** Site web BonTroc : cible des liens de confirmation d'e-mail et de réinitialisation de mot de passe. */
export const WEB_URL = 'https://bontroc.fr';
export const SUPPORT_EMAIL = 'contact@bontroc.fr';

export const supabase = createClient(rawUrl, rawKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ---------------------------------------------------------------------------
// Types — miroir de src/lib/supabase.ts du site (TrocAPP). Toute évolution du
// schéma se fait dans les migrations du site, puis ici.
// ---------------------------------------------------------------------------

export type UserRole = 'user' | 'moderator' | 'admin' | 'banned';
export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export type NotificationSettings = {
  email_new_proposal: boolean;
  email_accepted_proposal: boolean;
  email_new_message: boolean;
  email_review_request: boolean;
  email_exchange_reminder: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_new_proposal: true,
  email_accepted_proposal: true,
  email_new_message: true,
  email_review_request: true,
  email_exchange_reminder: true,
};

/** Colonnes publiques d'un membre (vue `public_profiles`). C'est tout ce qu'un autre membre peut voir. */
export type PublicProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  languages?: string[] | null;
  skills?: string[] | null;
  rating_avg: number;
  rating_count: number;
  is_verified: boolean;
  profile_visibility: 'public' | 'private';
  status: 'active' | 'deleted';
  created_at: string;
};

/** Profil minimal embarqué dans les listes (messages, avis, échanges). */
export type MiniProfile = Pick<PublicProfile, 'id' | 'display_name' | 'avatar_url'>;

/** Ligne complète de `users` : uniquement pour son propre profil et pour le staff. */
export type User = {
  id: string;
  email: string;
  display_name: string;
  username: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
  languages?: string[] | null;
  skills?: string[] | null;
  search_radius_km?: number | null;
  rating_avg: number;
  rating_count: number;
  is_verified: boolean;
  role: UserRole;
  status?: 'active' | 'deleted';
  profile_visibility?: 'public' | 'private';
  verification_status?: VerificationStatus;
  verification_document_url?: string | null;
  verification_notes?: string | null;
  verification_submitted_at?: string | null;
  verification_reviewed_at?: string | null;
  notification_settings?: Partial<NotificationSettings> | null;
  created_at: string;
  updated_at?: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  sort_order: number;
};

export type ListingStatus = 'draft' | 'published' | 'archived' | 'suspended';
export type ListingMode = 'remote' | 'on_site' | 'both';
export type ListingType = 'service' | 'product';

export type ListingMedia = {
  id: string;
  listing_id: string;
  url: string;
  type: 'image' | 'video' | 'document';
  sort_order: number;
};

export type Listing = {
  id: string;
  user_id: string;
  type: ListingType;
  title: string;
  description_offer: string;
  desired_exchange_desc: string;
  category_id?: string | null;
  desired_categories?: string[] | null;
  mode: ListingMode;
  location_lat?: number | null;
  location_lng?: number | null;
  estimation_min?: number | null;
  estimation_max?: number | null;
  status: ListingStatus;
  view_count: number;
  created_at: string;
  updated_at: string;
  user?: PublicProfile | null;
  media?: ListingMedia[];
  category?: { name: string; slug?: string } | null;
};

export type ProposalStatus = 'pending' | 'countered' | 'accepted' | 'refused' | 'cancelled';

export type Proposal = {
  id: string;
  listing_id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  offer_payload: { description?: string } | null;
  estimation_min?: number | null;
  estimation_max?: number | null;
  status: ProposalStatus;
  parent_proposal_id?: string | null;
  created_at: string;
  updated_at: string;
  from_user?: PublicProfile | null;
  to_user?: PublicProfile | null;
  listing?: Listing | null;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  attachments?: string[] | null;
  read_at?: string | null;
  created_at: string;
  sender?: MiniProfile | null;
};

export type DisputeStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

export type Dispute = {
  id: string;
  exchange_id: string;
  opened_by: string;
  reason: string;
  status: DisputeStatus;
  resolution?: string | null;
  /** Notes internes : jamais renvoyées aux membres (sélection explicite côté admin uniquement). */
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at?: string;
};

export type ContractStatus = 'awaiting_signatures' | 'active' | 'completed' | 'cancelled';

export type Contract = {
  id: string;
  proposal_id: string;
  version: number;
  html_content?: string;
  pdf_url?: string | null;
  accepted_by_from_at?: string | null;
  accepted_by_to_at?: string | null;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
};

export type ExchangeStatus = 'not_started' | 'in_progress' | 'delivered' | 'confirmed' | 'cancelled';

/** Proposition telle qu'embarquée dans un échange (profils minimaux, annonce résumée). */
export type ExchangeProposal = Pick<Proposal, 'id' | 'listing_id' | 'from_user_id' | 'to_user_id' | 'status' | 'message' | 'offer_payload' | 'created_at'> & {
  from_user?: MiniProfile | null;
  to_user?: MiniProfile | null;
  listing?: Pick<Listing, 'id' | 'title' | 'type'> | null;
};

export type Exchange = {
  id: string;
  contract_id: string;
  status: ExchangeStatus;
  due_date?: string | null;
  delivered_at?: string | null;
  delivered_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  dispute?: Dispute | null;
  contract?: (Contract & { proposal?: ExchangeProposal | null }) | null;
};

export type Review = {
  id: string;
  exchange_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string | null;
  tags?: string[] | null;
  created_at: string;
  reviewer?: MiniProfile | null;
  reviewee?: MiniProfile | null;
};

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export type Report = {
  id: string;
  reporter_id: string;
  reported_user_id?: string | null;
  listing_id?: string | null;
  proposal_id?: string | null;
  chat_id?: string | null;
  reason: string;
  details?: string | null;
  status: ReportStatus;
  moderator_id?: string | null;
  resolved_at?: string | null;
  created_at: string;
};

/** Message d'erreur lisible à partir d'une erreur Supabase/PostgREST ou d'une exception. */
export function errorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    const msg = (err as { message: string }).message;
    if (msg.includes('duplicate key') && msg.includes('username')) return 'Ce nom d’utilisateur est déjà pris.';
    if (msg.includes('proposals_one_open_per_listing_user')) return 'Vous avez déjà une proposition en cours sur cette annonce.';
    if (msg.includes('reviews_one_per_exchange_reviewer')) return 'Vous avez déjà publié un avis sur cet échange.';
    if (msg.includes('disputes_one_open_per_exchange')) return 'Un litige est déjà ouvert sur cet échange.';
    if (msg.includes('reports_not_self')) return 'Vous ne pouvez pas vous signaler vous-même.';
    if (msg.includes('proposals_not_self')) return 'Vous ne pouvez pas vous proposer un échange à vous-même.';
    if (msg.includes('users_text_lengths')) return 'Un des champs dépasse la longueur autorisée.';
    if (msg.includes('listings_text_lengths')) return 'Le titre (3 à 120 caractères) ou les descriptions (3000 max) dépassent la longueur autorisée.';
    if (msg.includes('Failed to fetch') || msg.includes('Network request failed')) {
      return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
    }
    if (msg.toLowerCase().includes('invalid login')) return 'E-mail ou mot de passe incorrect.';
    if (msg.toLowerCase().includes('email not confirmed')) return 'Confirmez d’abord votre adresse e-mail (lien reçu à l’inscription).';
    if (msg.toLowerCase().includes('already registered')) return 'Un compte existe déjà avec cet e-mail.';
    return msg;
  }
  return fallback;
}
