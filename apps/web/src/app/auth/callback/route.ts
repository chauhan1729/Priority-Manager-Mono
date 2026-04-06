import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";

type CookieItem = { name: string; value: string; options: CookieOptions };

/**
 * Supabase Auth callback handler.
 *
 * Handles two cases:
 * 1. OAuth redirect (Google / Apple) — Supabase sends ?code=xxx after consent
 * 2. Email confirmation link — Supabase sends ?code=xxx in the magic link
 *
 * After exchanging the code for a session the DB trigger
 * `trg_on_auth_user_created` auto-creates the profile row, so no manual
 * upsert is needed here.
 *
 * Spec §6, §8: after successful auth route to /daily-plan (default home).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // OAuth provider returned an error (e.g. user denied consent)
  if (error) {
    const params = new URLSearchParams({ error: errorDescription ?? error });
    return NextResponse.redirect(`${origin}/login?${params}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieItem[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const params = new URLSearchParams({ error: exchangeError.message });
    return NextResponse.redirect(`${origin}/login?${params}`);
  }

  // Spec §8: Daily Plan is the default home screen
  return NextResponse.redirect(`${origin}/daily-plan`);
}
