import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Expo charge automatiquement les variables EXPO_PUBLIC_* depuis le .env
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;

// Debug pour voir ce qui est chargé
console.log('Supabase Config Check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0,
  urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
});

if (!supabaseUrl || !supabaseAnonKey) {
  const error = `Missing Supabase environment variables. 
  Please check your .env file contains:
  EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here
  
  Current values:
  URL: ${supabaseUrl ? 'Found' : 'MISSING'}
  KEY: ${supabaseAnonKey ? 'Found' : 'MISSING'}`;
  console.error(error);
  throw new Error(error);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type User = {
  id: string;
  email: string;
  display_name: string;
  username: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  phone?: string;
  city?: string;
  country?: string;
  geo_lat?: number;
  geo_lng?: number;
  languages?: string[];
  skills?: string[];
  search_radius_km?: number;
  rating_avg: number;
  rating_count: number;
  is_verified: boolean;
  role: 'user' | 'moderator' | 'admin' | 'banned';
  verification_status?: 'none' | 'pending' | 'verified' | 'rejected';
  verification_document_url?: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  sort_order: number;
};

export type Listing = {
  id: string;
  user_id: string;
  type: 'service' | 'product';
  title: string;
  description_offer: string;
  desired_exchange_desc: string;
  desired_categories?: string[];
  desired_tags?: string[];
  mode: 'remote' | 'on_site' | 'both';
  location_lat?: number;
  location_lng?: number;
  estimation_min?: number;
  estimation_max?: number;
  status: 'draft' | 'published' | 'archived' | 'suspended';
  view_count: number;
  created_at: string;
  updated_at: string;
  user?: User;
  media?: ListingMedia[];
};

export type ListingMedia = {
  id: string;
  listing_id: string;
  url: string;
  type: 'image' | 'video' | 'document';
  sort_order: number;
};

export type Proposal = {
  id: string;
  listing_id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  offer_payload: any;
  estimation_min?: number;
  estimation_max?: number;
  status: 'pending' | 'countered' | 'accepted' | 'refused' | 'cancelled';
  parent_proposal_id?: string;
  created_at: string;
  updated_at: string;
  from_user?: User;
  to_user?: User;
  listing?: Listing;
};

export type Exchange = {
  id: string;
  contract_id: string;
  status: 'not_started' | 'in_progress' | 'delivered' | 'confirmed' | 'cancelled';
  due_date?: string;
  delivered_at?: string;
  delivered_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
};

export type Review = {
  id: string;
  exchange_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  tags?: string[];
  created_at: string;
};

export type Contract = {
  id: string;
  proposal_id: string;
  html_content: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  accepted_by_from_at?: string;
  accepted_by_to_at?: string;
  created_at: string;
  updated_at: string;
};

export type Dispute = {
  id: string;
  exchange_id: string;
  opened_by: string;
  reason: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  resolution?: string;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: {
    display_name: string;
    avatar_url?: string;
  };
};

export type EsignRequest = {
  id: string;
  contract_id: string;
  provider?: string;
  status: 'pending' | 'sent' | 'completed' | 'failed';
  envelope_id?: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: 'proposal_received' | 'proposal_accepted' | 'proposal_refused' | 'message_received' | 'exchange_update' | 'review_received';
  message: string;
  related_id?: string;
  read_at?: string;
  created_at: string;
};

