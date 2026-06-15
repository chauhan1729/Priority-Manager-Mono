"use client";

import { useState } from "react";

import { FotwTipsModal } from "./FotwTipsModal";

interface Props {
  /** Rail mode (collapsed desktop sidebar): show icon only, centered. */
  iconOnly?: boolean;
}

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

/** On-demand "Tips" launcher for the sidebar footer. Holds its own modal state. */
export function FotwTipsButton({ iconOnly = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={[
          "flex items-center rounded-lg text-sm font-medium text-ink-light transition hover:bg-blue-50 hover:text-blue-700",
          iconOnly ? "justify-center p-2" : "w-full gap-3 px-2 py-2",
        ].join(" ")}
        title="Tips — get the most from your Priority Manager"
        aria-label="Open tips"
      >
        <IconLightbulb />
        {!iconOnly && <span>Tips</span>}
      </button>

      {open && <FotwTipsModal onClose={() => setOpen(false)} />}
    </>
  );
}
