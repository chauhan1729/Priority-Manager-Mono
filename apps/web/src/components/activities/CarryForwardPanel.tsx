"use client";

import type { Activity } from "@pm/types";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDate(iso: string): string {
  const p = iso.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface Props {
  activities: Activity[];
  projectMap: Map<string, string>;
  fromDate: string;
  toDate: string;
  isPending: boolean;
  onCarryForward: (activityId: string, linkedProjectId: string | null) => void;
}

export function CarryForwardPanel({
  activities,
  projectMap,
  fromDate,
  toDate,
  isPending,
  onCarryForward,
}: Props) {
  if (activities.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
            Carry Forward from {formatDate(fromDate)}
          </h3>
          <p className="text-xs text-amber-700 mt-0.5">
            {activities.length} unfinished {activities.length === 1 ? "activity" : "activities"}
          </p>
        </div>
        <button
          onClick={() => {
            activities.forEach((a) => onCarryForward(a.id, a.linked_project_id));
          }}
          disabled={isPending}
          className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition"
        >
          Move All to Today
        </button>
      </div>

      {/* Activity list */}
      <div className="space-y-2">
        {activities.map((activity) => {
          const projectName = activity.linked_project_id
            ? (projectMap.get(activity.linked_project_id) ?? null)
            : null;

          return (
            <div
              key={activity.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {activity.priority && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                        activity.priority === "A"
                          ? "bg-red-100 text-red-600"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {activity.priority}
                    </span>
                  )}
                  <span className="text-sm font-medium text-ink truncate">
                    {activity.title}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-light">
                  {projectName && (
                    <span className="text-blue-600 truncate">{projectName}</span>
                  )}
                  <span>{formatMinutes(activity.estimated_minutes)}</span>
                </div>
              </div>
              <button
                onClick={() => onCarryForward(activity.id, activity.linked_project_id)}
                disabled={isPending}
                className="flex-shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition"
              >
                Move →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
