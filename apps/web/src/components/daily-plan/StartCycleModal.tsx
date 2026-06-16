"use client";

import { useState } from "react";

const QUICK = [25, 45, 60];

/** Default "later" time = now + 15 min, rounded to the next 5-minute mark, as "HH:MM". */
function defaultLaterTime(): string {
  const d = new Date(Date.now() + 15 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Phase 4 (revised cycles): pick a duration, choose to start Now or Later (with a
 * time), then a focus block is dropped on the timeline.
 *
 * @param onStart  startTime is null for "now", or "HH:MM" (local) for "later".
 */
export function StartCycleModal({
  activity,
  isPending,
  onStart,
  onClose,
}: {
  activity: { id: string; title: string; estimatedMinutes?: number };
  isPending: boolean;
  onStart: (minutes: number, note: string, startTime: string | null) => void;
  onClose: () => void;
}) {
  const initial =
    activity.estimatedMinutes && activity.estimatedMinutes > 0 ? activity.estimatedMinutes : 45;
  const [minutes, setMinutes] = useState<number>(initial);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [time, setTime] = useState<string>(defaultLaterTime);

  const isLater = when === "later";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-blue-100 bg-paper p-6 shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-light">Start a cycle</p>
        <h3 className="truncate text-sm font-medium text-ink">{activity.title}</h3>
        <p className="mt-1 text-xs text-ink-light">
          {isLater
            ? "Schedules a focus block on the timeline at the chosen time."
            : "Drops a focus block on the timeline starting now."}
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-ink-light">Duration</label>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setMinutes(q)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  minutes === q
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-blue-100 bg-white text-ink hover:bg-blue-50"
                }`}
              >
                {q}m
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={600}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, Math.min(600, Number(e.target.value) || 0)))}
                className="w-20 rounded-lg border border-blue-100 bg-white px-2 py-1.5 text-sm text-ink focus:border-blue-400 focus:outline-none"
                aria-label="Custom minutes"
              />
              <span className="text-xs text-ink-light">min</span>
            </div>
          </div>
        </div>

        {/* When to start: Now or Later */}
        <div className="mt-4">
          <label className="mb-1 block text-xs text-ink-light">When</label>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-blue-100 bg-white p-0.5">
              {(["now", "later"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setWhen(opt)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                    when === opt ? "bg-indigo-600 text-white" : "text-ink hover:bg-blue-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {isLater && (
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-lg border border-blue-100 bg-white px-2 py-1.5 text-sm text-ink focus:border-blue-400 focus:outline-none"
                aria-label="Start time"
              />
            )}
          </div>
        </div>

        {/* What this cycle is about */}
        <div className="mt-4">
          <label className="mb-1 block text-xs text-ink-light">What&apos;s this cycle about? (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="e.g. Clean up Dustin's planner"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-ink-light hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(minutes, note, isLater ? time : null)}
            disabled={isPending || minutes <= 0 || (isLater && !time)}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLater ? `◷ Schedule (${minutes}m)` : `◷ Start (${minutes}m)`}
          </button>
        </div>
      </div>
    </div>
  );
}
