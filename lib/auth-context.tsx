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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

