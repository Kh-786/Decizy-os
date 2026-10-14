import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { DEMO_USERS } from '../data/demoData';
import {
  getSupabaseConfigStatus,
  getSupabaseClient,
  isSupabaseConfigured,
  SupabaseConfigStatus,
} from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

export type AuthMode = 'demo' | 'authenticated';

interface AuthContextType {
  currentUser: UserProfile;
  activeRole: UserRole;
  authMode: AuthMode;
  session: Session | null;
  supabaseUser: User | null;
  isLoadingAuth: boolean;
  authError: string | null;
  supabaseStatus: SupabaseConfigStatus;
  availableUsers: UserProfile[];
  isDemoPersona: boolean;
  securityNotice: string;
  // Auth methods
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    city?: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  switchRole: (role: UserRole) => void;
  setDemoMode: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_USERS[0]);
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('demo');
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConfigStatus>(getSupabaseConfigStatus());

  // Helper to fetch server-enforced user profile from public.profiles
  const fetchUserProfile = useCallback(async (userId: string, email: string): Promise<UserProfile> => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        id: userId,
        email,
        fullName: email.split('@')[0],
        role: 'customer',
        city: 'India',
        created_at: new Date().toISOString(),
      };
    }

    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // Fallback profile if profile trigger has not yet completed
        return {
          id: userId,
          email,
          fullName: email.split('@')[0],
          role: 'customer', // Always default to customer (zero privilege elevation)
          city: 'India',
          created_at: new Date().toISOString(),
        };
      }

      return {
        id: data.id,
        email: data.email,
        fullName: data.full_name || email.split('@')[0],
        role: data.role as UserRole,
        phone: data.phone || undefined,
        companyName: data.company_name || undefined,
        city: data.city || undefined,
        created_at: data.created_at,
      };
    } catch {
      return {
        id: userId,
        email,
        fullName: email.split('@')[0],
        role: 'customer',
        city: 'India',
        created_at: new Date().toISOString(),
      };
    }
  }, []);

  // Initialize session and subscribe to auth state changes
  useEffect(() => {
    const status = getSupabaseConfigStatus();
    setSupabaseStatus(status);

    if (!isSupabaseConfigured()) {
      setIsLoadingAuth(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setIsLoadingAuth(false);
      return;
    }

    // 1. Get initial session
    client.auth.getSession().then(({ data: { session: initSession } }) => {
      if (initSession?.user) {
        setSession(initSession);
        setSupabaseUser(initSession.user);
        setAuthMode('authenticated');
        fetchUserProfile(initSession.user.id, initSession.user.email || '').then((profile) => {
          setCurrentUser(profile);
          setIsLoadingAuth(false);
        });
      } else {
        setIsLoadingAuth(false);
      }
    });

    // 2. Subscribe to auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setSupabaseUser(newSession.user);
        setAuthMode('authenticated');
        const profile = await fetchUserProfile(newSession.user.id, newSession.user.email || '');
        setCurrentUser(profile);
      } else {
        setSupabaseUser(null);
        setAuthMode('demo');
        setCurrentUser(DEMO_USERS[0]);
      }
      setIsLoadingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    if (!isSupabaseConfigured()) {
      const msg = 'Supabase credentials are not configured. Use Demonstration Mode to evaluate Decizy.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client unavailable.' };
    }

    setIsLoadingAuth(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = error.message;
        setAuthError(msg);
        setIsLoadingAuth(false);
        return { success: false, error: msg };
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id, data.user.email || '');
        setCurrentUser(profile);
        setAuthMode('authenticated');
      }

      setIsLoadingAuth(false);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      setAuthError(msg);
      setIsLoadingAuth(false);
      return { success: false, error: msg };
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    city?: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    setAuthError(null);
    if (!isSupabaseConfigured()) {
      const msg = 'Supabase credentials are not configured. Use Demonstration Mode to evaluate Decizy.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client unavailable.' };
    }

    setIsLoadingAuth(true);
    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone?.trim() || null,
            city: city?.trim() || 'India',
            // NOTE: Even if client attempts to pass 'role: admin', the database trigger handle_new_user() forces 'customer'.
          },
        },
      });

      if (error) {
        const msg = error.message;
        setAuthError(msg);
        setIsLoadingAuth(false);
        return { success: false, error: msg };
      }

      setIsLoadingAuth(false);

      if (data.session && data.user) {
        const profile = await fetchUserProfile(data.user.id, data.user.email || '');
        setCurrentUser(profile);
        setAuthMode('authenticated');
        return { success: true, message: 'Account registered and authenticated successfully.' };
      }

      return {
        success: true,
        message: 'Account registered. If email confirmation is enabled, please verify your email before logging in.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setAuthError(msg);
      setIsLoadingAuth(false);
      return { success: false, error: msg };
    }
  };

  const signOut = async (): Promise<void> => {
    const client = getSupabaseClient();
    if (client && authMode === 'authenticated') {
      await client.auth.signOut();
    }
    setSession(null);
    setSupabaseUser(null);
    setAuthMode('demo');
    setCurrentUser(DEMO_USERS[0]);
  };

  const resetPassword = async (
    email: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    setAuthError(null);
    if (!isSupabaseConfigured()) {
      const msg = 'Supabase is not configured. Password recovery requires a live project.';
      return { success: false, error: msg };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase client unavailable.' };

    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim());
      if (error) {
        return { success: false, error: error.message };
      }
      return {
        success: true,
        message: 'Password reset link sent to your email address if an account exists.',
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Password reset failed.',
      };
    }
  };

  // Demo persona switcher (only operates in Demo mode)
  const switchRole = (role: UserRole) => {
    if (authMode === 'authenticated') {
      alert(
        `Role Switching Disabled: You are signed into an authenticated Supabase account as "${currentUser.email}". Your role (${currentUser.role}) is enforced by the database. Sign out to use demo personas.`
      );
      return;
    }

    const matchedUser = DEMO_USERS.find((u) => u.role === role) || {
      id: `usr-${role}-demo`,
      email: `${role}.demo@decizy.local`,
      fullName: `[DEMO] ${role.toUpperCase()} Persona`,
      role,
      city: 'Bengaluru',
      created_at: new Date().toISOString(),
    };
    setCurrentUser(matchedUser);
  };

  const setDemoMode = () => {
    setAuthMode('demo');
    setCurrentUser(DEMO_USERS[0]);
  };

  const clearAuthError = () => setAuthError(null);

  const isDemoPersona = authMode === 'demo';
  const securityNotice = isDemoPersona
    ? 'Demonstration Persona Active: Operating in local browser mode with simulated roles. Zero production privileges conferred.'
    : `Authenticated via Supabase as ${currentUser.email}. Role (${currentUser.role.toUpperCase()}) is server-enforced via PostgreSQL Row Level Security.`;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole: currentUser.role,
        authMode,
        session,
        supabaseUser,
        isLoadingAuth,
        authError,
        supabaseStatus,
        availableUsers: DEMO_USERS,
        isDemoPersona,
        securityNotice,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        resetPassword,
        switchRole,
        setDemoMode,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
