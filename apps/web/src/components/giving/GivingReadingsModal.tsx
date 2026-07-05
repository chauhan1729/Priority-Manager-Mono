"use client";

import { useEffect, useMemo, useState } from "react";

import givingPractice from "@/content/giving/giving-practice.md";
import { Markdown } from "@/components/six-time/Markdown";

interface Section {
  id: string;
  title: string;
  body: string;
}

/** Split a markdown doc into collapsible sections at each `## ` heading. */
function splitSections(md: string): Section[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const raw: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } = { title: "Start here", lines: [] };
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      if (current.lines.some((l) => l.trim() !== "")) raw.push(current);
      current = { title: m[1]!.trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((l) => l.trim() !== "")) raw.push(current);
  return raw.map((s, i) => ({ id: `s${i}`, title: s.title, body: s.lines.join("\n") }));
}

/**
 * The giving reading modal — opened from the Giving screen. Sections are a
 * single-open accordion (only one uncollapsed at a time), just like the
 * Six-Time Book reading. Content renders straight from the markdown file.
 */
export function GivingReadingsModal({ onClose }: { onClose: () => void }) {
  const sections = useMemo(() => splitSections(givingPractice), []);
  const [openId, setOpenId] = useState<string>("s0");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Giving reading"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl animate-[fadeInUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-blue-50 px-6 py-4">
          <div>
            <h2 className="font-handwriting text-2xl text-ink">Giving — daily reading</h2>
            <p className="mt-0.5 text-sm text-ink-light">The secret of living is giving.</p>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 shrink-0 rounded-md p-1.5 text-ink-light hover:bg-blue-50"
            aria-label="Close reading"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
              <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Accordion of sections — one open at a time */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="space-y-3">
            {sections.map((s) => {
              const isOpen = openId === s.id;
              return (
                <li key={s.id} className="rounded-xl border border-blue-100 bg-blue-50/30">
                  <button
                    onClick={() => setOpenId((prev) => (prev === s.id ? "" : s.id))}
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left hover:bg-blue-50"
                    aria-expanded={isOpen}
                  >
                    <span className="flex-1 text-sm font-semibold text-ink">{s.title}</span>
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
                    <div className="border-t border-blue-100 px-4 pb-4 pt-1">
                      <Markdown text={s.body} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-blue-50 px-6 py-3">
          <p className="text-xs text-ink-light">Read a little each day.</p>
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
