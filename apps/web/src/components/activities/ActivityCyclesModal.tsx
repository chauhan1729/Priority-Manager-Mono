"use client";

import { useEffect, useState } from "react";

import type { Activity } from "@pm/types";
import { getActivityCycles, type ActivityCycle } from "@/app/(app)/activities/actions";
import { showToast } from "@/components/ui/Toaster";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "Jun 16 · 3:15pm" from a schedule_date + start_at ISO. */
function formatCycleWhen(scheduleDate: string, startAt: string): string {
  const [y, mo, d] = scheduleDate.split("-").map(Number);
  const day = new Date(y!, mo! - 1, d!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const t = new Date(startAt);
  const h = t.getHours();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${day} · ${h12}:${String(t.getMinutes()).padStart(2, "0")}${ampm}`;
}

const CYCLE_STATUS: Record<string, { label: string; cls: string }> = {
  completed: { label: "✓ Completed", cls: "bg-green-100 text-green-700" },
  working: { label: "Working", cls: "bg-blue-100 text-blue-700" },
  upcoming: { label: "Upcoming", cls: "bg-gray-100 text-gray-600" },
  postponed: { label: "Postponed", cls: "bg-amber-100 text-amber-700" },
  missed: { label: "Missed", cls: "bg-red-100 text-red-600" },
};

interface Props {
  activity: Pick<Activity, "id" | "title">;
  onClose: () => void;
}

/**
 * Read-only popup listing every cycle (focus block) worked on an activity,
 * earliest first. Opened from the ↻ button on an ActivityCard — does not disturb
 * the card row.
 */
export function ActivityCyclesModal({ activity, onClose }: Props) {
  const [cycles, setCycles] = useState<ActivityCycle[] | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    getActivityCycles(activity.id).then((res) => {
      if (!active) return;
      if ("error" in res) {
        showToast(res.error, "error");
        setCycles([]);
      } else {
        setCycles(res.cycles);
      }
    });
    return () => {
      active = false;
    };
  }, [activity.id]);

  const completedCount = cycles?.filter((c) => c.status_snapshot === "completed").length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Cycles"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-blue-100 bg-paper shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-blue-50 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-light">Cycles</p>
            <h3 className="truncate text-sm font-medium text-ink">{activity.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="-mr-1.5 shrink-0 rounded-md p-1.5 text-ink-light hover:bg-blue-50"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
              <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cycles === null ? (
            <p className="py-2 text-sm text-ink-light">Loading…</p>
          ) : cycles.length === 0 ? (
            <p className="py-2 text-sm text-ink-light">No cycles yet. Start one from the Daily Plan.</p>
          ) : (
            <ul className="space-y-2">
              {cycles.map((c) => {
                const status = CYCLE_STATUS[c.status_snapshot ?? "upcoming"] ?? CYCLE_STATUS.upcoming!;
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-blue-50 bg-white px-3 py-2 text-xs"
                  >
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.cls}`}>
                      {status.label}
                    </span>
                    <span className="shrink-0 font-medium text-ink">{formatCycleWhen(c.schedule_date, c.start_at)}</span>
                    <span className="shrink-0 text-ink-light">· {formatMinutes(c.locked_minutes)}</span>
                    {c.note && <span className="w-full truncate italic text-ink-light">“{c.note}”</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-blue-50 px-5 py-3">
          <span className="text-xs text-ink-light">
            {cycles && cycles.length > 0 ? `${completedCount} completed · ${cycles.length} total` : " "}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
