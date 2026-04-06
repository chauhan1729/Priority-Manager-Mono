"use client";

import { useFormStatus } from "react-dom";

import { signOut } from "@/app/(app)/actions";

function ButtonInner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-light transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <ButtonInner />
    </form>
  );
}
