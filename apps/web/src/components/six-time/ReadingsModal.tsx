"use client";

import { useEffect, useMemo, useState } from "react";

import karmicGuide from "@/content/karmic/karmic-management-guide.md";
import dailyPractice from "@/content/karmic/daily-practice.md";
import karmicImprint from "@/content/karmic/karmic-imprint.md";
import { Markdown } from "./Markdown";

type Tab = "guide" | "daily" | "weekly";

const TAB_DOCS: Record<Tab, string> = {
  guide: karmicGuide,
  daily: dailyPractice,
  weekly: karmicImprint,
};

const TAB_FOOTERS: Record<Tab, string> = {
  guide: "The book in plain words — read a rule a day.",
  daily: "Read this each morning.",
  weekly: "Read this once a week.",
};

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
 * The karmic readings modal — opened from the Six-Time Book screen.
 * Two tabs (Daily / Weekly concepts); within each, sections are a single-open
 * accordion (only one uncollapsed at a time), just like the tips modal.
 * Content renders straight from the markdown files so it never drifts.
 */
export function ReadingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("guide");

  const sections = useMemo(() => splitSections(TAB_DOCS[tab]), [tab]);
  // First section starts open; opening another collapses the current one.
  const [openId, setOpenId] = useState<string>("s0");

  function switchTab(next: Tab) {
    setTab(next);
    setOpenId("s0");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => switchTab(id)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        tab === id ? "bg-blue-600 text-white" : "text-ink-light hover:bg-blue-50"
      }`}
      aria-pressed={tab === id}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Karmic readings"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl animate-[fadeInUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-blue-50 px-6 py-4">
          <div>
            <h2 className="font-handwriting text-2xl text-ink">Karmic readings</h2>
            <p className="mt-0.5 text-sm text-ink-light">
              Plant good seeds by how you treat others.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {tabBtn("guide", "The 8 Rules")}
              {tabBtn("daily", "Daily")}
              {tabBtn("weekly", "Weekly concepts")}
            </div>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 shrink-0 rounded-md p-1.5 text-ink-light hover:bg-blue-50"
            aria-label="Close readings"
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
          <p className="text-xs text-ink-light">
            {TAB_FOOTERS[tab]}
          </p>
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
