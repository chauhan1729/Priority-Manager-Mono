"use client";

import { useState } from "react";

import { FotwTipsModal } from "./FotwTipsModal";

function IconLightbulb() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        d="M7 14a4.5 4.5 0 116 0c-.6.5-1 1.2-1 2v.5H8V16c0-.8-.4-1.5-1-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="8" y1="18" x2="12" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Global floating "Tips" launcher — fixed bottom-right on every screen.
 * Sits below the Toaster's stack (which is lifted to clear it). Holds its own
 * modal state. The label collapses to an icon on the smallest screens.
 */
export function FotwTipsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 shadow-lg transition hover:bg-blue-50 hover:shadow-xl"
        aria-label="Open tips"
        title="Tips — get the most from your Priority Manager"
      >
        <IconLightbulb />
        <span className="hidden sm:inline">Tips</span>
      </button>

      {open && <FotwTipsModal onClose={() => setOpen(false)} />}
    </>
  );
}
