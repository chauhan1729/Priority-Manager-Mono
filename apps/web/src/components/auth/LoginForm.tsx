"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { signInWithEmail, signInWithGoogle, signInWithApple } from "@/app/(auth)/login/actions";
import type { AuthActionState } from "@/app/(auth)/login/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ urlError }: { urlError?: string | undefined }) {
  const [state, action] = useActionState<AuthActionState, FormData>(signInWithEmail, null);

  const displayError = state?.error ?? urlError;

  return (
    <div className="w-full space-y-6">
      {/* OAuth buttons */}
      <div className="space-y-3">
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-ink shadow-sm transition hover:bg-gray-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        <form action={signInWithApple}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-ink shadow-sm transition hover:bg-gray-50"
          >
            <AppleIcon />
            Continue with Apple
          </button>
        </form>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-blue-100" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-ink-light">or continue with email</span>
        </div>
      </div>

      {/* Email + password form */}
      <form action={action} className="space-y-4">
        {displayError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{displayError}</p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-ink placeholder-ink-light outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-ink placeholder-ink-light outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="••••••••"
          />
        </div>

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-ink-light">
        No account?{" "}
        <Link href="/signup" className="font-medium text-blue-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.8 0 248.2 0 126.2c0-103.7 35.6-158.6 106.3-217C165.1 60.4 246.5 32 323.2 32c76 0 138.2 37 185.4 37 45.3 0 116.1-39.5 190.2-39.5 30.7 0 108.2 2.6 164.7 108.4zm-234.5-181.9c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}
