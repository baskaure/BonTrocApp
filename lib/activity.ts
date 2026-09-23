/**
 * Activité et badges, dérivés des vraies tables.
 *
 * L'application utilisait une table `notifications` alimentée par le client mobile seulement :
 * elle n'est pas dans les migrations du site (source de vérité de la base) et le site ne l'alimente
 * pas, donc une proposition faite depuis le web n'apparaissait jamais ici. On calcule désormais
 * l'activité à partir des propositions, échanges et messages, avec un marqueur « vu » local.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { supabase, Exchange, Proposal, MiniProfile } from './supabase';
import { EXCHANGE_SELECT, MINI_PROFILE_COLS, PROPOSAL_SELECT } from './queries';

export type ActivityRoute =
  | { pathname: '/proposal/[id]'; params: { id: string } }
  | { pathname: '/exchange/[id]'; params: { id: string } }
  | { pathname: '/contract/[id]'; params: { id: string } }
  | { pathname: '/review/[exchangeId]'; params: { exchangeId: string } };

export type ActivityKind = 'proposal_received' | 'proposal_update' | 'message' | 'exchange_action' | 'exchange_update';

export type ActivityItem = {
  /** Clé « vu » : encode l'état, pour qu'un changement de statut redevienne non lu. */
  key: string;
  kind: ActivityKind;
  title: string;
  message: string;
  at: string;
  route: ActivityRoute;
  unread: boolean;
  /** Vrai quand une action de l'utilisateur est attendue. */
  actionable: boolean;
};

export type ActivityBadges = {
  /** Propositions reçues en attente de réponse. */
  proposals: number;
  /** Échanges où une action est attendue (contrat à signer, réception à confirmer…). */
  exchanges: number;
  /** Messages non lus, toutes conversations confondues. */
  messages: number;
  /** Éléments non lus, pour la cloche. */
  unread: number;
};

const EMPTY_BADGES: ActivityBadges = { proposals: 0, exchanges: 0, messages: 0, unread: 0 };
const WINDOW_DAYS = 30;

type SeenMap = Record<string, string>;
const seenKey = (userId: string) => `bontroc:seen:${userId}`;

async function loadSeen(userId: string): Promise<SeenMap> {
  try {
    const raw = await AsyncStorage.getItem(seenKey(userId));
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

async function saveSeen(userId: string, seen: SeenMap) {
  try {
    await AsyncStorage.setItem(seenKey(userId), JSON.stringify(seen));
  } catch {
    /* stockage indisponible : les marqueurs ne survivront pas au redémarrage */
  }
}

export const chatSeenKey = (proposalId: string) => `chat:${proposalId}`;
export const proposalSeenKey = (p: Pick<Proposal, 'id' | 'status'>) => `proposal:${p.id}:${p.status}`;
export const exchangeSeenKey = (e: Pick<Exchange, 'id' | 'status' | 'delivered_by'> & { contract?: { status?: string } | null }) =>
  `exchange:${e.id}:${e.status}:${e.contract?.status ?? ''}:${e.delivered_by ?? ''}`;

type State = {
  userId: string | null;
  items: ActivityItem[];
  badges: ActivityBadges;
  /** Nombre de messages non lus par proposition (pastilles des conversations). */
  unreadByProposal: Record<string, number>;
  loading: boolean;
  seen: SeenMap;
  refresh: (userId: string) => Promise<void>;
  markSeen: (userId: string, key: string, at?: string) => Promise<void>;
  markAllSeen: (userId: string) => Promise<void>;
  reset: () => void;
};

let inflight: Promise<void> | null = null;

export const useActivityStore = create<State>((set, get) => ({
  userId: null,
  items: [],
  badges: EMPTY_BADGES,
  unreadByProposal: {},
  loading: false,
  seen: {},

  refresh: async (userId) => {
    if (inflight) return inflight;
    inflight = (async () => {
      set({ loading: true, userId });
      try {
        const seen = get().userId === userId && Object.keys(get().seen).length ? get().seen : await loadSeen(userId);
        const computed = await computeActivity(userId, seen);
        set({ ...computed, seen, loading: false, userId });
      } catch (err) {
        console.warn('Activité indisponible :', err);
        set({ loading: false });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  markSeen: async (userId, key, at) => {
    const seen = { ...get().seen, [key]: at ?? new Date().toISOString() };
    set({ seen, ...applySeen(get().items, seen, get().unreadByProposal, key) });
    await saveSeen(userId, seen);
  },

  markAllSeen: async (userId) => {
    const now = new Date().toISOString();
    const seen = { ...get().seen };
    for (const item of get().items) seen[item.key] = now;
    set({ seen, ...applySeen(get().items, seen, get().unreadByProposal) });
    await saveSeen(userId, seen);
  },

  reset: () => set({ userId: null, items: [], badges: EMPTY_BADGES, unreadByProposal: {}, seen: {}, loading: false }),
}));

/** Recalcule `unread` et les badges après un marquage, sans refaire de requête. */
function applySeen(items: ActivityItem[], seen: SeenMap, unreadByProposal: Record<string, number>, changedKey?: string) {
  const nextUnreadByProposal = { ...unreadByProposal };
  if (changedKey?.startsWith('chat:')) nextUnreadByProposal[changedKey.slice(5)] = 0;
  const nextItems = items
    .map((item) => ({ ...item, unread: !seen[item.key] || seen[item.key] < item.at }))
    .filter((item) => !(item.kind === 'message' && nextUnreadByProposal[item.route.params && 'id' in item.route.params ? item.route.params.id : ''] === 0));
  return { items: nextItems, unreadByProposal: nextUnreadByProposal, badges: computeBadges(nextItems, nextUnreadByProposal) };
}

function computeBadges(items: ActivityItem[], unreadByProposal: Record<string, number>): ActivityBadges {
  const messages = Object.values(unreadByProposal).reduce((a, b) => a + b, 0);
  return {
    proposals: items.filter((i) => i.kind === 'proposal_received' && i.actionable).length,
    exchanges: items.filter((i) => i.kind === 'exchange_action').length,
    messages,
    unread: items.filter((i) => i.unread).length,
  };
}

function laterOf(a: string, b?: string | null) {
  return b && b > a ? b : a;
}

async function computeActivity(userId: string, seen: SeenMap) {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const items: ActivityItem[] = [];
  const unreadByProposal: Record<string, number> = {};

  const [proposalsRes, exchangesRes, reviewsRes] = await Promise.all([
    supabase
      .from('proposals')
      .select(PROPOSAL_SELECT)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('exchanges').select(EXCHANGE_SELECT).order('updated_at', { ascending: false }).limit(100),
    supabase.from('reviews').select('exchange_id').eq('reviewer_id', userId),
  ]);

  const proposals = ((proposalsRes.data ?? []) as unknown as Proposal[]).filter((p) => p.listing);
  const reviewedExchanges = new Set((reviewsRes.data ?? []).map((r) => r.exchange_id as string));

  // 1. Propositions
  for (const p of proposals) {
    const isReceiver = p.to_user_id === userId;
    const other = isReceiver ? p.from_user : p.to_user;
    const name = other?.display_name ?? 'Un membre';
    const title = p.listing?.title ?? 'votre annonce';
    const at = laterOf(p.created_at, p.updated_at);
    const key = proposalSeenKey(p);
    const route: ActivityRoute = { pathname: '/proposal/[id]', params: { id: p.id } };

    if (isReceiver && p.status === 'pending') {
      items.push({ key, kind: 'proposal_received', title: 'Nouvelle proposition', message: `${name} vous propose un échange pour « ${title} ».`, at, route, unread: isUnread(seen, key, at), actionable: true });
    } else if (!isReceiver && at >= since && (p.status === 'accepted' || p.status === 'refused' || p.status === 'countered')) {
      const label =
        p.status === 'accepted'
          ? `${name} a accepté votre proposition pour « ${title} ». Le contrat est prêt à être signé.`
          : p.status === 'refused'
            ? `${name} a refusé votre proposition pour « ${title} ».`
            : `${name} vous a fait une contre-proposition pour « ${title} ».`;
      items.push({ key, kind: 'proposal_update', title: p.status === 'accepted' ? 'Proposition acceptée' : p.status === 'refused' ? 'Proposition refusée' : 'Contre-proposition', message: label, at, route, unread: isUnread(seen, key, at), actionable: false });
    }
  }

  // 2. Échanges (la RLS ne renvoie que ceux de l'utilisateur ; on filtre quand même)
  const exchanges = ((exchangesRes.data ?? []) as unknown as (Exchange & { dispute?: unknown })[])
    .map((e) => ({ ...e, dispute: Array.isArray(e.dispute) ? (e.dispute[0] ?? null) : e.dispute }))
    .filter((e) => e.contract?.proposal && (e.contract.proposal.from_user_id === userId || e.contract.proposal.to_user_id === userId));

  for (const e of exchanges) {
    const proposal = e.contract!.proposal!;
    const isFrom = proposal.from_user_id === userId;
    const other = isFrom ? proposal.to_user : proposal.from_user;
    const name = other?.display_name ?? 'Votre partenaire';
    const title = proposal.listing?.title ?? 'votre échange';
    const at = laterOf(e.created_at, e.updated_at);
    const key = exchangeSeenKey(e);
    const route: ActivityRoute = { pathname: '/exchange/[id]', params: { id: e.id } };
    const contract = e.contract!;
    const mySignature = isFrom ? contract.accepted_by_from_at : contract.accepted_by_to_at;

    if (e.status === 'not_started' && contract.status === 'awaiting_signatures' && !mySignature) {
      items.push({ key, kind: 'exchange_action', title: 'Contrat à signer', message: `Signez le contrat d’échange avec ${name} pour « ${title} ».`, at, route: { pathname: '/contract/[id]', params: { id: contract.id } }, unread: isUnread(seen, key, at), actionable: true });
    } else if (e.status === 'not_started' && contract.status === 'active') {
      items.push({ key, kind: 'exchange_action', title: 'Prêt à démarrer', message: `Le contrat avec ${name} est signé : démarrez l’échange « ${title} ».`, at, route, unread: isUnread(seen, key, at), actionable: true });
    } else if (e.status === 'delivered' && e.delivered_by && e.delivered_by !== userId) {
      items.push({ key, kind: 'exchange_action', title: 'Réception à confirmer', message: `${name} indique avoir livré « ${title} ». Confirmez la réception.`, at: laterOf(at, e.delivered_at), route, unread: isUnread(seen, key, at), actionable: true });
    } else if (e.status === 'confirmed' && !reviewedExchanges.has(e.id) && at >= since) {
      items.push({ key, kind: 'exchange_action', title: 'Laissez un avis', message: `L’échange « ${title} » avec ${name} est terminé. Notez votre partenaire.`, at: laterOf(at, e.confirmed_at), route: { pathname: '/review/[exchangeId]', params: { exchangeId: e.id } }, unread: isUnread(seen, key, at), actionable: true });
    } else if (e.status === 'cancelled' && at >= since) {
      items.push({ key, kind: 'exchange_update', title: 'Échange annulé', message: `L’échange « ${title} » avec ${name} a été annulé.`, at, route, unread: isUnread(seen, key, at), actionable: false });
    } else if (e.status === 'in_progress' && at >= since) {
      items.push({ key, kind: 'exchange_update', title: 'Échange en cours', message: `L’échange « ${title} » avec ${name} a démarré.`, at, route, unread: isUnread(seen, key, at), actionable: false });
    }
  }

  // 3. Messages non lus (conversations des propositions ouvertes ou récentes)
  const proposalIds = proposals.map((p) => p.id);
  if (proposalIds.length) {
    const { data: chats } = await supabase.from('chats').select('id, proposal_id').in('proposal_id', proposalIds);
    const chatToProposal = new Map<string, string>((chats ?? []).map((c) => [c.id as string, c.proposal_id as string]));
    if (chatToProposal.size) {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select(`id, chat_id, sender_id, body, created_at, sender:public_profiles!chat_messages_sender_id_fkey(${MINI_PROFILE_COLS})`)
        .in('chat_id', [...chatToProposal.keys()])
        .neq('sender_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300);

      const latestByProposal = new Map<string, { at: string; sender: MiniProfile | null; body: string }>();
      for (const m of (messages ?? []) as unknown as { chat_id: string; created_at: string; body: string; sender: MiniProfile | null }[]) {
        const proposalId = chatToProposal.get(m.chat_id);
        if (!proposalId) continue;
        const seenAt = seen[chatSeenKey(proposalId)];
        if (seenAt && seenAt >= m.created_at) continue;
        unreadByProposal[proposalId] = (unreadByProposal[proposalId] ?? 0) + 1;
        if (!latestByProposal.has(proposalId)) latestByProposal.set(proposalId, { at: m.created_at, sender: m.sender, body: m.body });
      }
      for (const [proposalId, last] of latestByProposal) {
        const count = unreadByProposal[proposalId];
        const proposal = proposals.find((p) => p.id === proposalId);
        items.push({
          key: chatSeenKey(proposalId),
          kind: 'message',
          title: count > 1 ? `${count} nouveaux messages` : 'Nouveau message',
          message: `${last.sender?.display_name ?? 'Un membre'} · ${proposal?.listing?.title ?? 'Conversation'} : ${last.body.slice(0, 80)}`,
          at: last.at,
          route: { pathname: '/proposal/[id]', params: { id: proposalId } },
          unread: true,
          actionable: false,
        });
      }
    }
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { items, unreadByProposal, badges: computeBadges(items, unreadByProposal) };
}

function isUnread(seen: SeenMap, key: string, at: string) {
  const s = seen[key];
  return !s || s < at;
}
