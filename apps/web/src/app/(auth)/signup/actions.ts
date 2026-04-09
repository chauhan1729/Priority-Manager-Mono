"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/env";

export type SignUpActionState = {
  error?: string;
  success?: string;
} | null;

/**
 * Email + password sign-up.
 * Supabase sends a confirmation email; the link hits /auth/callback which
 * sets the session and the DB trigger creates the profile row.
 */
export async function signUpWithEmail(
  _prev: SignUpActionState,
  formData: FormData,
): Promise<SignUpActionState> {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "All fields are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();
  // VERCEL_URL is auto-injected by Vercel per deployment (no protocol prefix).
  // Prefer it so preview and production deploys use the correct domain even
  // if NEXT_PUBLIC_SITE_URL is still set to localhost in project settings.
  const siteUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : env.NEXT_PUBLIC_SITE_URL;

  let signUpError: string | null = null;
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // full_name is stored in raw_user_meta_data and picked up by the
        // handle_new_user() trigger to populate profiles.name
        data: { full_name: name },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) signUpError = error.message;
  } catch (err) {
    signUpError =
      err instanceof Error && err.message.toLowerCase().includes("fetch")
        ? "Could not reach the authentication server. Check your internet connection and try again."
        : "An unexpected error occurred. Please try again.";
  }

  if (signUpError) {
    return { error: signUpError };
  }

  return {
    success: "Check your email for a confirmation link to finish signing up.",
  };
}
