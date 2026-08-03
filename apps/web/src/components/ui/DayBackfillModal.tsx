"use client";

import { useEffect } from "react";

/** Add/subtract whole days from an ISO date (YYYY-MM-DD), TZ-safe via UTC. */
export function isoAddDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * A focused popup for backfilling a *past* day: pick the day at the top, then use
 * the same editor as the Today view (passed as children, keyed on the date). Keeps
 * the Today view clean and history read-only, so backfilling is a deliberate act.
 * Shared by Karmic Management and Giving.
 */
export function DayBackfillModal({
  title,
  subtitle,
  date,
  onDateChange,
  minDate,
  maxDate,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  date: string;
  onDateChange: (d: string) => void;
  minDate?: string;
  maxDate: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-indigo-100 bg-indigo-50/40 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-handwriting text-xl text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-light">{subtitle}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor="backfill-date" className="text-xs font-medium text-ink-light">
                Day
              </label>
              <input
                id="backfill-date"
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                onChange={(e) => e.target.value && onDateChange(e.target.value)}
                className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-indigo-400 focus:outline-none"
              />
              <span className="text-xs text-ink-light">· {prettyDate(date)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-ink-light transition hover:bg-indigo-100 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
