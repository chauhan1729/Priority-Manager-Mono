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

  let signInError: string | null = null;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) signInError = error.message;
  } catch (err) {
    signInError =
      err instanceof Error && err.message.toLowerCase().includes("fetch")
        ? "Could not reach the authentication server. Check your internet connection and try again."
        : "An unexpected error occurred. Please try again.";
  }

  if (signInError) return { error: signInError };

  redirect("/daily-plan");
}

/**
 * Initiates Google OAuth flow.
 * Supabase redirects the browser to Google, then back to /auth/callback.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // VERCEL_URL is auto-injected by Vercel per deployment (no protocol prefix).
  // Prefer it so preview and production deploys use the correct domain even
  // if NEXT_PUBLIC_SITE_URL is still set to localhost in project settings.
  const siteUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : env.NEXT_PUBLIC_SITE_URL;

  let googleUrl: string | null = null;
  try {
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
    if (!error && data.url) googleUrl = data.url;
  } catch {
    // network error
  }

  if (!googleUrl) {
    redirect("/login?error=google_oauth_failed");
  }

  redirect(googleUrl);
}

/**
 * Initiates Apple OAuth flow.
 * Supabase redirects the browser to Apple, then back to /auth/callback.
 */
export async function signInWithApple(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : env.NEXT_PUBLIC_SITE_URL;

  let appleUrl: string | null = null;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (!error && data.url) appleUrl = data.url;
  } catch {
    // network error
  }

  if (!appleUrl) {
    redirect("/login?error=apple_oauth_failed");
  }

  redirect(appleUrl);
}
