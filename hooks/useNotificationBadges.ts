import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export function useNotificationBadges() {
  const { user } = useAuth();
  const [badges, setBadges] = useState({
    proposals: 0,
    exchanges: 0,
    notifications: 0,
  });

  useEffect(() => {
    if (!user) {
      setBadges({ proposals: 0, exchanges: 0, notifications: 0 });
      return;
    }

    loadBadges();
    const unsubscribe = subscribeToUpdates();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id]);

  async function loadBadges() {
    if (!user) return;

    try {
      // Compter les propositions reçues en attente (celles qu'on doit traiter)
      const { count: proposalsCount, error: proposalsError } = await supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      if (proposalsError) {
        console.error('Error counting proposals:', proposalsError);
      }

      // Compter les notifications non lues (avec gestion d'erreur si la table n'existe pas)
      let notificationsCount = 0;
      let exchangesCount = 0;
      
      try {
        const { data: notifications, error: notificationsError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .is('read_at', null);

        if (notificationsError) {
          // Si la table n'existe pas, on ignore silencieusement
          if (notificationsError.code === 'PGRST205') {
            console.warn('Table notifications does not exist. Please run the SQL script to create it.');
          } else {
            console.error('Error loading notifications:', notificationsError);
          }
        } else {
          notificationsCount = notifications?.length || 0;
          // Compter les notifications de type exchange_update (mises à jour d'échanges)
          exchangesCount = notifications?.filter(n => n.type === 'exchange_update').length || 0;
        }
      } catch (err) {
        // Si la table n'existe pas, on continue avec 0
        console.warn('Notifications table may not exist:', err);
      }

      const newBadges = {
        proposals: proposalsCount || 0,
        exchanges: exchangesCount || 0,
        notifications: notificationsCount || 0,
      };

      setBadges(newBadges);
    } catch (error) {
      console.error('Error loading notification badges:', error);
      // En cas d'erreur, on met les badges à 0 pour éviter les crashes
      setBadges({ proposals: 0, exchanges: 0, notifications: 0 });
    }
  }

  function subscribeToUpdates() {
    if (!user) return () => {};

    // S'abonner aux changements de propositions
    const proposalsSub = supabase
      .channel(`proposals-badge:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'proposals',
        filter: `to_user_id=eq.${user.id}`,
      }, () => {
        loadBadges();
      })
      .subscribe();

    // S'abonner aux changements de notifications (INSERT et UPDATE pour read_at)
    const notificationsSub = supabase
      .channel(`notifications-badge:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadBadges();
      })
      .subscribe();

    return () => {
      proposalsSub.unsubscribe();
      notificationsSub.unsubscribe();
    };
  }

  return badges;
}

