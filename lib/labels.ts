import type { DisputeStatus, ExchangeStatus, ListingMode, ListingStatus, ProposalStatus, ReportStatus } from './supabase';

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: 'En attente',
  countered: 'Contre-proposition',
  accepted: 'Acceptée',
  refused: 'Refusée',
  cancelled: 'Annulée',
};

export const EXCHANGE_STATUS_LABEL: Record<ExchangeStatus, string> = {
  not_started: 'Non démarré',
  in_progress: 'En cours',
  delivered: 'À confirmer',
  confirmed: 'Terminé',
  cancelled: 'Annulé',
};

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  open: 'Litige ouvert',
  in_review: 'Litige en cours d’examen',
  resolved: 'Litige résolu',
  dismissed: 'Litige classé sans suite',
};

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  archived: 'Archivée',
  suspended: 'Suspendue',
};

export const MODE_LABEL: Record<ListingMode, string> = {
  remote: 'À distance',
  on_site: 'Présentiel',
  both: 'Présentiel & à distance',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: 'À traiter',
  resolved: 'Résolu',
  dismissed: 'Rejeté',
};

export const REPORT_REASON_LABEL: Record<string, string> = {
  spam: 'Spam ou publicité',
  inappropriate: 'Contenu inapproprié',
  fraud: 'Arnaque ou fraude',
  harassment: 'Harcèlement',
  fake: 'Faux profil ou annonce',
  other: 'Autre',
};

export function formatDateFr(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', opts);
}

export function formatDateTimeFr(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Même règle que le site et que la contrainte `users_text_lengths` (3 à 30 caractères). */
export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function normalizeUsername(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}
