"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { signUpWithEmail } from "@/app/(auth)/signup/actions";
import type { SignUpActionState } from "@/app/(auth)/signup/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState<SignUpActionState, FormData>(signUpWithEmail, null);

  if (state?.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-8 text-center">
        <div className="mb-2 text-2xl">✉️</div>
        <p className="font-medium text-green-800">Check your email</p>
        <p className="mt-1 text-sm text-green-700">{state.success}</p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium text-ink">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-ink placeholder-ink-light outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          placeholder="Your name"
        />
      </div>

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
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-ink placeholder-ink-light outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          placeholder="At least 8 characters"
        />
      </div>

      <SubmitButton />

      <p className="text-center text-sm text-ink-light">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
