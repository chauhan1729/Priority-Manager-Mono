"use client";

import { useState } from "react";

import { groupActivitiesBySection, todayISO } from "@pm/domain";
import type { Activity, ActivitySection } from "@pm/types";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const SECTION_LABELS: Record<ActivitySection, string> = {
  work: "Work",
  outside: "Outside",
  unplanned: "Unplanned",
  delegated: "Delegated",
};

const SECTION_ORDER: ActivitySection[] = ["work", "outside", "unplanned", "delegated"];

interface ActivityRowProps {
  activity: Activity;
  projectMap: Map<string, string>;
  canSchedule: boolean;
  aPriorityBlocked: boolean;
  isPending: boolean;
  onSchedule: (activity: Activity) => void;
  onMoveToDate: (activityId: string, toDate: string, linkedProjectId: string | null) => void;
}

function ActivityRow({
  activity,
  projectMap,
  canSchedule,
  aPriorityBlocked,
  isPending,
  onSchedule,
  onMoveToDate,
}: ActivityRowProps) {
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [moveDate, setMoveDate] = useState("");

  const projectName = activity.linked_project_id
    ? (projectMap.get(activity.linked_project_id) ?? null)
    : null;

  function handleMove() {
    if (!moveDate) return;
    onMoveToDate(activity.id, moveDate, activity.linked_project_id ?? null);
    setShowMoveInput(false);
    setMoveDate("");
  }

  return (
    <div className="rounded-lg border border-blue-50 bg-paper p-2.5 space-y-2">
      {/* Main row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {activity.priority && (
              <span
                className={`flex-shrink-0 rounded px-1 py-0.5 text-[10px] font-bold ${
                  activity.priority === "A"
                    ? "bg-red-100 text-red-600"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {activity.priority}
              </span>
            )}
            <span className="text-xs font-medium text-ink truncate">{activity.title}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-light">
            {projectName && <span className="text-blue-600 truncate">{projectName}</span>}
            <span>{formatMinutes(activity.remaining_minutes)} remaining</span>
            {activity.moved_from_date && <span className="text-amber-600">↷ moved</span>}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-1.5">
          {canSchedule && (
            <button
              onClick={() => onSchedule(activity)}
              disabled={isPending || aPriorityBlocked}
              title={aPriorityBlocked ? "Schedule your A-priority activity first" : undefined}
              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Schedule
            </button>
          )}
          <button
            onClick={() => setShowMoveInput((s) => !s)}
            disabled={isPending}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-ink-light hover:bg-gray-50 disabled:opacity-50 transition"
          >
            Move
          </button>
        </div>
      </div>

      {/* Move-to-date input */}
      {showMoveInput && (
        <div className="flex items-center gap-2 pt-0.5">
          <input
            type="date"
            value={moveDate}
            min={todayISO()}
            onChange={(e) => setMoveDate(e.target.value)}
            className="flex-1 rounded-lg border border-blue-100 px-2 py-1 text-xs text-ink focus:border-blue-400 focus:outline-none"
          />
          <button
            onClick={handleMove}
            disabled={!moveDate || isPending}
            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Move
          </button>
          <button
            onClick={() => setShowMoveInput(false)}
            className="text-xs text-ink-light hover:text-ink px-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  activities: Activity[];
  projectMap: Map<string, string>;
  selectedDate: string;
  isPending: boolean;
  onSchedule: (activity: Activity) => void;
  onMoveToDate: (activityId: string, toDate: string, linkedProjectId: string | null) => void;
}

export function UnscheduledList({
  activities,
  projectMap,
  selectedDate,
  isPending,
  onSchedule,
  onMoveToDate,
}: Props) {
  const today = todayISO();
  const canSchedule = selectedDate >= today;

  // A-priority gate: if any A-priority activity exists in the unscheduled list,
  // only A-priority activities may be scheduled first (spec §10.6).
  const hasUnscheduledAPriority = activities.some((a) => a.priority === "A");

  const grouped = groupActivitiesBySection(activities);

  return (
    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-blue-50">
        <h3 className="text-xs font-semibold text-ink-light uppercase tracking-wide">
          Unscheduled
        </h3>
        <p className="text-xs text-ink-light mt-0.5">
          {activities.length} {activities.length === 1 ? "activity" : "activities"} with remaining time
        </p>
      </div>

      <div className="p-3 space-y-3">
        {/* A-priority gate banner */}
        {canSchedule && hasUnscheduledAPriority && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Schedule your <strong>A-priority</strong> activities first before scheduling others.
          </div>
        )}

        {activities.length === 0 ? (
          <p className="text-xs text-ink-light text-center py-6">
            All activities scheduled or complete.
          </p>
        ) : (
          SECTION_ORDER.map((section) => {
            const items = grouped[section];
            if (items.length === 0) return null;

            return (
              <div key={section}>
                <p className="text-[10px] font-semibold text-ink-light uppercase tracking-wide mb-1.5">
                  {SECTION_LABELS[section]}
                </p>
                <div className="space-y-1.5">
                  {items.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      projectMap={projectMap}
                      canSchedule={canSchedule}
                      aPriorityBlocked={hasUnscheduledAPriority && activity.priority !== "A"}
                      isPending={isPending}
                      onSchedule={onSchedule}
                      onMoveToDate={onMoveToDate}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}

        {!canSchedule && activities.length > 0 && (
          <p className="text-[10px] text-ink-light text-center pt-1">
            Past date — view only
          </p>
        )}
      </div>
    </div>
  );
}
