"use client";

import { useEffect, useState } from "react";

import { FOTW_TIPS } from "@/lib/fotw-tips";

interface Props {
  onClose: () => void;
}

/**
 * On-demand tips modal — grouped scroll list of Fly On The Wall practices,
 * each tied to a feature in the app. Opened from the 💡 button in the sidebar.
 *
 * UI rules: light mode, notebook language, handwritten heading. Single-open
 * accordion — all sections start collapsed; opening one closes the others.
 */
export function FotwTipsModal({ onClose }: Props) {
  // All themes start collapsed; only one can be expanded at a time.
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Get the most from your Priority Manager"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl animate-[fadeInUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-blue-50 px-6 py-4">
          <div>
            <h2 className="font-handwriting text-2xl text-ink">
              Get the most from your Priority Manager
            </h2>
            <p className="mt-0.5 text-sm text-ink-light">
              Practices from the Fly On The Wall training.
            </p>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 shrink-0 rounded-md p-1.5 text-ink-light hover:bg-blue-50"
            aria-label="Close tips"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
              <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable themed list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="space-y-4">
            {FOTW_TIPS.map((theme) => {
              const isOpen = openId === theme.id;
              return (
                <li
                  key={theme.id}
                  className="rounded-xl border border-blue-100 bg-blue-50/30"
                >
                  <button
                    onClick={() => toggle(theme.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left hover:bg-blue-50"
                    aria-expanded={isOpen}
                  >
                    <span className="text-lg leading-none" aria-hidden="true">
                      {theme.icon}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-ink">
                      {theme.title}
                    </span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className={`h-4 w-4 text-ink-light transition-transform ${isOpen ? "rotate-90" : ""}`}
                      aria-hidden="true"
                    >
                      <polyline points="7,5 13,10 7,15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4">
                      <ul className="space-y-2">
                        {theme.tips.map((tip, i) => (
                          <li key={i} className="flex gap-2 text-sm leading-snug text-ink-light">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-blue-50 px-6 py-3">
          <p className="text-xs text-ink-light">Inspired by the Fly On The Wall training.</p>
          <button
            onClick={onClose}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
