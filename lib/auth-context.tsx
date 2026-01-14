import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, User } from './supabase';
import type { Session } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Utiliser un try-catch pour mieux gérer les erreurs
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Si le refresh token est invalide, nettoyer la session et continuer silencieusement
          if (error.message?.includes('Refresh Token') || 
              error.message?.includes('session missing') ||
              error.message?.includes('Invalid Refresh Token') ||
              error.message?.includes('refresh_token_not_found')) {
            // Nettoyer silencieusement sans logger l'erreur
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              // Ignorer les erreurs de déconnexion si la session est déjà invalide
            }
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          // Logger uniquement les autres erreurs
          console.error('Erreur lors de la récupération de la session:', error);
        }
        
        setSession(session);
        if (session?.user) {
          loadUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        // Gérer les exceptions non capturées
        if (err?.message?.includes('Refresh Token') || 
            err?.message?.includes('Invalid Refresh Token') ||
            err?.message?.includes('refresh_token_not_found')) {
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        console.error('Exception lors de l\'initialisation de l\'auth:', err);
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Gérer tous les événements d'authentification
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.role === 'banned') {
        await supabase.auth.signOut();
        setUser(null);
        return;
      }
      
      setUser(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, displayName: string, username: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          username: username,
        }
      }
    });
    if (error) throw error;
  }

  async function signOut() {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        const { error } = await supabase.auth.signOut();
        if (error && !error.message?.includes('session missing')) {
          console.warn('Erreur lors de la déconnexion:', error);
        }
      }
    } catch (err: any) {
      if (!err?.message?.includes('session missing') && !err?.message?.includes('Auth session missing')) {
        console.warn('Exception lors de la déconnexion:', err);
      }
    } finally {
      setSession(null);
      setUser(null);
    }
  }

  async function updateProfile(updates: Partial<User>) {
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;
    await loadUserProfile(user.id);
  }

  async function refreshUser() {
    if (user) {
      await loadUserProfile(user.id);
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

