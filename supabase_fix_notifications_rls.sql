-- Script SQL pour corriger les politiques RLS des notifications
-- À exécuter dans l'éditeur SQL de Supabase APRÈS avoir créé la table
-- 
-- Ce script supprime TOUTES les politiques existantes et les recrée correctement
-- pour permettre aux utilisateurs authentifiés d'insérer des notifications pour d'autres utilisateurs

-- Supprimer TOUTES les politiques existantes sur la table notifications
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'notifications' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.notifications';
    END LOOP;
END $$;

-- Créer la politique d'insertion qui permet aux utilisateurs authentifiés 
-- d'insérer des notifications pour n'importe quel utilisateur
-- C'est nécessaire car User A doit pouvoir créer une notification pour User B
-- (ex: quand User A envoie un message à User B, ou quand un échange change d'état)
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique de lecture : les utilisateurs peuvent voir uniquement leurs propres notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique de mise à jour : les utilisateurs peuvent mettre à jour uniquement leurs propres notifications
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

