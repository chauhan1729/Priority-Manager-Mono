import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// SecureStore adapter for Supabase auth token persistence
// ---------------------------------------------------------------------------

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ---------------------------------------------------------------------------
// Context / hook
// ---------------------------------------------------------------------------

const SupabaseContext = createContext<SupabaseClient | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(SupabaseContext.Provider, { value: supabase }, children);
}

export function useSupabase(): SupabaseClient {
  const client = useContext(SupabaseContext);
  if (!client) throw new Error('useSupabase must be used inside <SupabaseProvider>');
  return client;
}
