"use client";

import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/env";

/** Use in Client Components. Creates one singleton per browser tab. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
