import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ data: any; error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Inner provider that has access to QueryClient
const AuthProviderInner = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Set up auth state listener - handles all auth state changes including initial session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('[Auth] State change:', event, currentSession?.user?.id);
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        
        // CRITICAL: On sign in (including OAuth), invalidate all user-specific queries
        // This forces refetch with the new user context
        if (event === 'SIGNED_IN' && currentSession?.user) {
          // Use setTimeout to defer cache operations (Supabase recommendation)
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['restaurants'] });
            queryClient.invalidateQueries({ queryKey: ['subscription'] });
          }, 0);
        }
        
        // On sign out, clear all cached data
        if (event === 'SIGNED_OUT') {
          setTimeout(() => {
            queryClient.clear();
          }, 0);
        }
      }
    );

    // Explicitly get session - critical for OAuth redirects where tokens are in URL hash
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log('[Auth] Initial session:', initialSession?.user?.id ?? 'none');
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const { data: { session: refreshedSession } } = await supabase.auth.getSession();
    setSession(refreshedSession);
    setUser(refreshedSession?.user ?? null);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({ user, session, signIn, signUp, signOut, refreshSession, loading }),
    [user, session, loading, signIn, signUp, signOut, refreshSession]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Wrapper that doesn't need QueryClient (for use at app root)
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return <AuthProviderInner>{children}</AuthProviderInner>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
