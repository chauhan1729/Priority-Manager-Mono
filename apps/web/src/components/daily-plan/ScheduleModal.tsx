"use client";

import { useState } from "react";

import type { Activity } from "@pm/types";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Returns "HH:MM" for the current local time rounded up to nearest 15 min. */
function defaultStartTime(): string {
  const now = new Date();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(totalMin / 15) * 15;
  const h = Math.floor(rounded / 60) % 24;
  const m = rounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Snap to nearest 15-min increment (rounding down). */
function snapTo15(minutes: number): number {
  return Math.max(15, Math.floor(minutes / 15) * 15);
}

interface Props {
  activity: Activity;
  selectedDate: string;
  isPending: boolean;
  initialStartTime?: string;
  /** Called with UTC ISO strings for startAt/endAt and the chosen focus minutes. */
  onSchedule: (activityId: string, startAt: string, endAt: string, focusMinutes: number) => void;
  onClose: () => void;
}

/**
 * Modal to schedule an activity onto the Daily Plan timeline.
 * Supports partial scheduling — user picks start time and duration (≤ remaining).
 */
export function ScheduleModal({
  activity,
  selectedDate,
  isPending,
  initialStartTime,
  onSchedule,
  onClose,
}: Props) {
  const maxMinutes = activity.remaining_minutes;
  const defaultDuration = snapTo15(maxMinutes);

  const [startTime, setStartTime] = useState(initialStartTime ?? defaultStartTime());
  const [focusMinutes, setFocusMinutes] = useState(defaultDuration);
  const [error, setError] = useState<string | null>(null);

  /** Compute end time HH:MM from start time + focusMinutes. */
  function computedEndTime(): string {
    const [hStr, mStr] = startTime.split(":");
    const totalMin = Number(hStr) * 60 + Number(mStr) + focusMinutes;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function handleSubmit() {
    setError(null);

    if (focusMinutes <= 0) {
      setError("No remaining time to schedule.");
      return;
    }

    // Build UTC ISO datetimes from local date + local time
    const startRaw = new Date(`${selectedDate}T${startTime}`);
    const endRaw = new Date(startRaw.getTime() + focusMinutes * 60_000);

    if (isNaN(startRaw.getTime())) {
      setError("Invalid start time.");
      return;
    }

    onSchedule(activity.id, startRaw.toISOString(), endRaw.toISOString(), focusMinutes);
  }

  const isPartial = focusMinutes < maxMinutes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-handwriting text-xl text-ink mb-1">Schedule Activity</h2>
        <p className="text-xs text-ink-light mb-5 truncate">{activity.title}</p>

        <div className="space-y-4">
          {/* Start time */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">Start time</label>
            <input
              type="time"
              value={startTime}
              step={900} /* 15-min steps */
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Duration slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-ink-light">Duration</label>
              <span className="text-xs font-semibold text-ink">{formatMinutes(focusMinutes)}</span>
            </div>
            <input
              type="range"
              min={15}
              max={maxMinutes}
              step={15}
              value={focusMinutes}
              onChange={(e) => setFocusMinutes(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-ink-light mt-0.5">
              <span>15m</span>
              <span>{formatMinutes(maxMinutes)} remaining</span>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-blue-100 px-3 py-2 text-xs text-ink-light">
            <span className="font-medium text-ink">{startTime}</span>
            {" "}–{" "}
            <span className="font-medium text-ink">{computedEndTime()}</span>
            {" · "}
            {formatMinutes(focusMinutes)}
            {isPartial && (
              <span className="ml-1 text-amber-600">
                · {formatMinutes(maxMinutes - focusMinutes)} stays unscheduled
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-ink-light hover:bg-blue-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || focusMinutes <= 0}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
