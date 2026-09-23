/**
 * Sélections PostgREST partagées.
 *
 * Depuis le durcissement de la base (migration 20260917100000 du site), la table `users`
 * n'est lisible que par son propriétaire et le staff : tout profil d'un autre membre passe
 * par la vue `public_profiles`. Un embed `users(*)` renverrait `null` sans erreur.
 */
export const PUBLIC_PROFILE_COLS =
  'id, display_name, username, avatar_url, city, country, is_verified, rating_avg, rating_count, status, profile_visibility';

export const MINI_PROFILE_COLS = 'id, display_name, avatar_url';

export const LISTING_SELECT = `
  id, user_id, type, title, description_offer, desired_exchange_desc, category_id, mode,
  location_lat, location_lng, estimation_min, estimation_max, status, view_count, created_at, updated_at,
  user:public_profiles(${PUBLIC_PROFILE_COLS}),
  media:listing_media(id, listing_id, url, type, sort_order),
  category:categories(name, slug)
`;

export const PROPOSAL_SELECT = `
  *,
  from_user:public_profiles!proposals_from_user_id_fkey(*),
  to_user:public_profiles!proposals_to_user_id_fkey(*),
  listing:listings(id, user_id, type, title, description_offer, desired_exchange_desc, mode, status, created_at, updated_at, view_count,
    media:listing_media(id, listing_id, url, type, sort_order), category:categories(name, slug))
`;

/** Litiges : `resolution_notes` est interne au staff, on ne le sélectionne jamais côté membre. */
const DISPUTE_COLS = 'id, exchange_id, opened_by, reason, status, resolution, resolved_at, created_at, updated_at';

/** Échange avec son contrat (sans le HTML, lourd) et la proposition d'origine. */
export const EXCHANGE_SELECT = `
  *,
  dispute:disputes(${DISPUTE_COLS}),
  contract:contracts(id, proposal_id, version, status, accepted_by_from_at, accepted_by_to_at, created_at, updated_at,
    proposal:proposals(id, listing_id, from_user_id, to_user_id, status, message, offer_payload, created_at,
      from_user:public_profiles!proposals_from_user_id_fkey(${MINI_PROFILE_COLS}),
      to_user:public_profiles!proposals_to_user_id_fkey(${MINI_PROFILE_COLS}),
      listing:listings(id, title, type)))
`;

export const CONTRACT_SELECT = `
  *,
  proposal:proposals(id, listing_id, from_user_id, to_user_id, status,
    from_user:public_profiles!proposals_from_user_id_fkey(${MINI_PROFILE_COLS}),
    to_user:public_profiles!proposals_to_user_id_fkey(${MINI_PROFILE_COLS}),
    listing:listings(id, title, type))
`;

export const MESSAGE_SELECT = `id, chat_id, sender_id, body, created_at, sender:public_profiles!chat_messages_sender_id_fkey(${MINI_PROFILE_COLS})`;

export const REVIEW_SELECT = `*, reviewer:public_profiles!reviews_reviewer_id_fkey(${MINI_PROFILE_COLS})`;
