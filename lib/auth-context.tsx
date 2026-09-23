import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, User, WEB_URL, SUPPORT_EMAIL, errorMessage } from './supabase';
import { sendTransactionalEmail } from './notifications';

export type AuthNotice = { kind: 'banned' | 'deleted' | 'profile-missing' | 'info'; message: string };

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Message à afficher (compte suspendu, supprimé, profil introuvable…). */
  authNotice: AuthNotice | null;
  clearAuthNotice: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  /** Renvoie `needsEmailConfirmation: true` quand Supabase attend la confirmation de l'adresse. */
  signUp: (email: string, password: string, displayName: string, username: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** Le lien reçu ouvre la page de réinitialisation du site web. */
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Suppression RGPD via l'Edge Function `delete-account` (anonymisation + fermeture du compte). */
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isRefreshTokenError = (message?: string) =>
  !!message && /refresh token|session missing|refresh_token_not_found/i.test(message);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const loadingUserIdRef = useRef<string | null>(null);

  const loadUserProfile = useCallback(async (sessionUser: Session['user']) => {
    try {
      let { data, error } = await supabase.from('users').select('*').eq('id', sessionUser.id).maybeSingle();
      if (error) throw error;

      if (!data) {
        // Le trigger de création de profil a pu échouer : on tente une création minimale.
        const meta = (sessionUser.user_metadata ?? {}) as Record<string, string | undefined>;
        const fallbackName = meta.display_name || meta.full_name || meta.name || sessionUser.email?.split('@')[0] || 'Membre';
        const fallbackUsername =
          (meta.username || sessionUser.email?.split('@')[0] || 'membre').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'membre';
        const { error: insertError } = await supabase.from('users').insert({
          id: sessionUser.id,
          email: sessionUser.email,
          display_name: fallbackName.slice(0, 60),
          username: `${fallbackUsername}_${sessionUser.id.replace(/-/g, '').slice(0, 4)}`,
          avatar_url: meta.avatar_url || meta.picture || null,
        });
        if (!insertError) {
          ({ data, error } = await supabase.from('users').select('*').eq('id', sessionUser.id).maybeSingle());
          if (error) throw error;
        }
      }

      if (!data) {
        await supabase.auth.signOut();
        setUser(null);
        setAuthNotice({ kind: 'profile-missing', message: `Votre profil est introuvable. Contactez ${SUPPORT_EMAIL} pour rétablir votre compte.` });
        return;
      }

      if (data.role === 'banned') {
        await supabase.auth.signOut();
        setUser(null);
        setAuthNotice({ kind: 'banned', message: `Votre compte a été suspendu. Contactez ${SUPPORT_EMAIL} pour toute question.` });
        return;
      }

      if (data.status === 'deleted') {
        await supabase.auth.signOut();
        setUser(null);
        setAuthNotice({ kind: 'deleted', message: 'Ce compte a été supprimé.' });
        return;
      }

      loadedUserIdRef.current = data.id;
      loadingUserIdRef.current = null;
      setUser(data as User);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isRefreshTokenError(message)) {
        // Jeton invalide sur l'appareil : on repart d'une session vide sans bruit.
        try {
          await supabase.auth.signOut();
        } catch {
          /* la session est déjà invalide */
        }
        setSession(null);
        setUser(null);
      } else {
        console.error('Chargement du profil impossible :', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // `onAuthStateChange` émet INITIAL_SESSION dès l'abonnement : c'est la seule source utilisée.
    // Un appel parallèle à getSession() chargeait le profil deux fois.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);

      if (!next?.user) {
        loadedUserIdRef.current = null;
        loadingUserIdRef.current = null;
        setUser(null);
        setLoading(false);
        return;
      }

      // Rafraîchissements de jeton et retours au premier plan : le profil est déjà chargé.
      const alreadyLoaded = loadedUserIdRef.current === next.user.id;
      if (alreadyLoaded && event !== 'USER_UPDATED') {
        setLoading(false);
        return;
      }
      if (loadingUserIdRef.current === next.user.id && event !== 'USER_UPDATED') return;

      loadingUserIdRef.current = next.user.id;
      setLoading(true);
      void loadUserProfile(next.user);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(errorMessage(error));
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string, username: string) => {
    setAuthNotice(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim(), username: username.trim() },
        // Le lien de confirmation ouvre le site : la page /connexion y accueille le nouveau membre.
        emailRedirectTo: `${WEB_URL}/connexion`,
      },
    });
    if (error) throw new Error(errorMessage(error));

    if (data.user) {
      void sendTransactionalEmail('welcome', data.user.id, { display_name: displayName.trim(), username: username.trim() });
    }

    return { needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (currentSession) {
        const { error } = await supabase.auth.signOut();
        if (error && !isRefreshTokenError(error.message)) console.warn('Erreur lors de la déconnexion :', error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (!isRefreshTokenError(message)) console.warn('Exception lors de la déconnexion :', err);
    } finally {
      loadedUserIdRef.current = null;
      setSession(null);
      setUser(null);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${WEB_URL}/reinitialiser-mot-de-passe`,
    });
    if (error) throw new Error(errorMessage(error));
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(errorMessage(error));
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      if (!user) return;
      const { data, error } = await supabase.from('users').update(updates).eq('id', user.id).select('*').maybeSingle();
      if (error) throw new Error(errorMessage(error));
      if (!data) throw new Error('Mise à jour refusée.');
      setUser(data as User);
    },
    [user],
  );

  const refreshUser = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    if (data) setUser(data as User);
  }, [user]);

  const deleteAccount = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) throw new Error(`La suppression a échoué. Réessayez ou contactez ${SUPPORT_EMAIL}.`);
    if (data && data.error) throw new Error(String(data.error));
    await signOut();
    setAuthNotice({ kind: 'info', message: 'Votre compte a été supprimé. Merci d’avoir utilisé BonTroc.' });
  }, [signOut]);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      loading,
      authNotice,
      clearAuthNotice: () => setAuthNotice(null),
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      refreshUser,
      deleteAccount,
    }),
    [session, user, loading, authNotice, signIn, signUp, signOut, requestPasswordReset, updatePassword, updateProfile, refreshUser, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
