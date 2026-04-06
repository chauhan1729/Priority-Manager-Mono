import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-handwriting text-4xl text-ink">Priority Manager</h1>
          <p className="mt-2 text-sm text-ink-light">Create your planner account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
          <SignUpForm />
        </div>
      </div>
    </main>
  );
}
