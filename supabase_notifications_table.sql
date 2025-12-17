-- Script SQL pour créer la table notifications dans Supabase
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('proposal_received', 'proposal_accepted', 'proposal_refused', 'message_received', 'exchange_update', 'review_received')),
  message TEXT NOT NULL,
  related_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_at ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_related_id ON public.notifications(related_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- RLS (Row Level Security) - Autoriser les utilisateurs à voir uniquement leurs notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir uniquement leurs propres notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent mettre à jour uniquement leurs propres notifications
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs authentifiés peuvent insérer des notifications pour n'importe quel utilisateur
-- Cela permet au système de créer des notifications pour d'autres utilisateurs (ex: quand quelqu'un envoie un message)
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger pour mettre à jour created_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

