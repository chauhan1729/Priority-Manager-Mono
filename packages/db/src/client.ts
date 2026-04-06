import { createClient } from "@supabase/supabase-js";

/**
 * Creates a typed Supabase client.
 * Pass env vars explicitly so this works in both Next.js (server + client)
 * and Expo (via expo-constants).
 */
export function createSupabaseClient(supabaseUrl: string, supabaseAnonKey: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export type { SupabaseClient } from "@supabase/supabase-js";
