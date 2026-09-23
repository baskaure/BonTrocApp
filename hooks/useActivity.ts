import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useActivityStore } from '@/lib/activity';

/**
 * À monter une seule fois (layout racine) : charge l'activité à la connexion, la rafraîchit au
 * retour au premier plan et sur les changements temps réel des propositions, échanges et messages.
 * Les changements temps réel respectent la RLS : on ne reçoit que ce qui nous concerne.
 */
export function useActivitySync() {
  const { user } = useAuth();
  const refresh = useActivityStore((s) => s.refresh);
  const reset = useActivityStore((s) => s.reset);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }
    const userId = user.id;
    void refresh(userId);

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(userId), 400);
    };

    const channel = supabase
      .channel(`activity:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `to_user_id=eq.${userId}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `from_user_id=eq.${userId}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exchanges' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, schedule)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, schedule)
      .subscribe();

    const appState = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') schedule();
    });

    return () => {
      if (timer) clearTimeout(timer);
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
}

/** Badges (propositions à traiter, échanges en attente d'action, messages non lus, non-lus). */
export function useActivityBadges() {
  return useActivityStore((s) => s.badges);
}
