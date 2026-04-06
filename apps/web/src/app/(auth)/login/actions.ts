"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/env";

export type AuthActionState = {
  error?: string;
} | null;

/**
 * Email + password sign-in.
 * On success redirects to /daily-plan via middleware.
 * On failure returns { error } so the form can display it.
 */
export async function signInWithEmail(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/daily-plan");
}

/**
 * Initiates Google OAuth flow.
 * Supabase redirects the browser to Google, then back to /auth/callback.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google_oauth_failed");
  }

  redirect(data.url);
}

/**
 * Initiates Apple OAuth flow.
 * Supabase redirects the browser to Apple, then back to /auth/callback.
 */
export async function signInWithApple(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=apple_oauth_failed");
  }

  redirect(data.url);
}
