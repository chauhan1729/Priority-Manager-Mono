"use client";

import { useFormStatus } from "react-dom";

import { signOut } from "@/app/(app)/actions";

function ButtonInner({ iconOnly }: { iconOnly?: boolean | undefined }) {
  const { pending } = useFormStatus();

  if (iconOnly) {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-label="Sign out"
        className="rounded-lg p-2 text-ink-light transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        {/* Sign-out arrow icon */}
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <polyline points="9,13 13,10 9,7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    );
  }

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

export function SignOutButton({ iconOnly }: { iconOnly?: boolean | undefined } = {}) {
  return (
    <form action={signOut}>
      <ButtonInner iconOnly={iconOnly} />
    </form>
  );
}
