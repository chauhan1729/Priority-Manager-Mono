"use client";

import { useState } from "react";

import type { Activity } from "@pm/types";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Snap to nearest 15-min increment (rounding down). */
function snapTo15(minutes: number): number {
  return Math.max(15, Math.floor(minutes / 15) * 15);
}

interface Props {
  activities: Activity[];
  projectMap: Map<string, string>;
  selectedDate: string;
  defaultStartTime: string;
  isPending: boolean;
  onSchedule: (activityId: string, startAt: string, endAt: string, focusMinutes: number) => void;
  onClose: () => void;
}

/**
 * Modal opened by clicking an empty slot in the timeline.
 * User picks an unscheduled activity, optionally adjusts start time + duration, then schedules.
 */
export function SlotScheduleModal({
  activities,
  projectMap,
  selectedDate,
  defaultStartTime,
  isPending,
  onSchedule,
  onClose,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    activities.length === 1 ? (activities[0]?.id ?? null) : null,
  );
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [error, setError] = useState<string | null>(null);

  const selectedActivity = activities.find((a) => a.id === selectedId) ?? null;
  const maxMinutes = selectedActivity?.remaining_minutes ?? 0;
  const [focusMinutes, setFocusMinutes] = useState<number>(() =>
    snapTo15(selectedActivity?.remaining_minutes ?? 60),
  );

  function handleActivitySelect(id: string) {
    setSelectedId(id);
    const act = activities.find((a) => a.id === id);
    if (act) setFocusMinutes(snapTo15(act.remaining_minutes));
    setError(null);
  }

  function computedEndTime(): string {
    const [hStr, mStr] = startTime.split(":");
    const totalMin = Number(hStr) * 60 + Number(mStr) + focusMinutes;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function handleSubmit() {
    setError(null);
    if (!selectedActivity) { setError("Select an activity."); return; }
    if (focusMinutes <= 0) { setError("Duration must be at least 15 minutes."); return; }

    const startRaw = new Date(`${selectedDate}T${startTime}`);
    const endRaw = new Date(startRaw.getTime() + focusMinutes * 60_000);
    if (isNaN(startRaw.getTime())) { setError("Invalid start time."); return; }

    onSchedule(selectedActivity.id, startRaw.toISOString(), endRaw.toISOString(), focusMinutes);
  }

  const isPartial = selectedActivity !== null && focusMinutes < maxMinutes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 className="font-handwriting text-xl text-ink">Schedule a block</h2>
          <p className="text-xs text-ink-light mt-0.5">Pick an activity to place at this time</p>
        </div>

        {/* Activity picker */}
        {activities.length === 0 ? (
          <p className="text-xs text-ink-light text-center py-4">No unscheduled activities.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-blue-100 p-2">
            {activities.map((a) => {
              const projectName = a.linked_project_id
                ? (projectMap.get(a.linked_project_id) ?? null)
                : null;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleActivitySelect(a.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition ${
                    selectedId === a.id
                      ? "bg-blue-600 text-white"
                      : "hover:bg-blue-50 text-ink"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {a.priority && (
                      <span
                        className={`flex-shrink-0 rounded px-1 py-0.5 text-[10px] font-bold ${
                          selectedId === a.id
                            ? "bg-white/20 text-white"
                            : a.priority === "A"
                              ? "bg-red-100 text-red-600"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {a.priority}
                      </span>
                    )}
                    <span className="font-medium truncate">{a.title}</span>
                  </div>
                  <div
                    className={`mt-0.5 text-[10px] ${selectedId === a.id ? "text-blue-100" : "text-ink-light"}`}
                  >
                    {projectName && <span className="mr-1.5">{projectName}</span>}
                    {formatMinutes(a.remaining_minutes)} remaining
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Time + duration — only when activity selected */}
        {selectedActivity && (
          <>
            {/* Start time */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Start time</label>
              <input
                type="time"
                value={startTime}
                step={900}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Duration */}
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
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-1 border-t border-blue-50">
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
            disabled={isPending || !selectedActivity || focusMinutes <= 0}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
