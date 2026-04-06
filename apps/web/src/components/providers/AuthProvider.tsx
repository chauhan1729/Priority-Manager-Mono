"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface AuthContextValue {
  user: User | null;
  /** True while the initial session is being fetched. */
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

/**
 * Provides the current Supabase user to the client-side component tree.
 * Listens to auth state changes so sign-in / sign-out instantly propagates.
 *
 * Server Components should call createSupabaseServerClient().auth.getUser()
 * directly rather than consuming this context.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // createBrowserClient memoizes internally, but wrap in useMemo for clarity
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    // Hydrate from existing cookie session immediately
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });

    // Keep in sync with sign-in / sign-out / token refresh events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Use createElement to avoid JSX type conflicts from two @types/react versions in the monorepo
  return React.createElement(AuthContext.Provider, { value: { user, loading } }, children);
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
