"use client";

import { useState } from "react";
import { useIsDesktop } from "@/hooks/useMediaQuery";

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

const SECTION_ORDER: ActivitySection[] = [
  "work",
  "outside",
  "unplanned",
  "delegated",
];

type CycleSummary = { count: number; done: number; focusMin: number };

interface ActivityRowProps {
  activity: Activity;
  projectMap: Map<string, string>;
  canSchedule: boolean;
  aPriorityBlocked: boolean;
  /** Phase 0A: a B may be promoted-to-schedule (all A's done). */
  canPromote: boolean;
  isPending: boolean;
  cycle?: CycleSummary | undefined;
  onSchedule: (activity: Activity) => void;
  onPromote: (activity: Activity) => void;
  onComplete: (activity: Activity) => void;
  onMoveToDate: (
    activityId: string,
    toDate: string,
    linkedProjectId: string | null,
  ) => void;
}

function ActivityRow({
  activity,
  projectMap,
  canSchedule,
  aPriorityBlocked,
  canPromote,
  isPending,
  cycle,
  onSchedule,
  onPromote,
  onComplete,
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
            <span className="text-xs font-medium text-ink truncate">
              {activity.title}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-light">
            {projectName && (
              <span className="text-blue-600 truncate">{projectName}</span>
            )}
            {/* Bug §10: show remaining as estimated - hours_worked, capped at 0 */}
            {(() => {
              const computed = Math.max(
                0,
                activity.estimated_minutes - (activity.hours_worked ?? 0),
              );
              return computed === 0 ? (
                <span className="text-amber-600 font-medium">
                  Extra time (overwork)
                </span>
              ) : (
                <span>{formatMinutes(computed)} remaining</span>
              );
            })()}
            {activity.moved_from_date && (
              <span className="text-amber-600">↷ moved</span>
            )}
            {cycle && (
              <span title="Cycles for this activity today">
                ◷ {cycle.count} {cycle.count === 1 ? "cycle" : "cycles"}
                {cycle.done > 0 ? ` · ${cycle.done} done` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-1.5">
          <button
            onClick={() => onComplete(activity)}
            disabled={isPending}
            aria-label="Mark complete"
            title="Mark activity complete"
            className="rounded p-1 text-ink-light hover:bg-green-50 hover:text-green-600 disabled:opacity-50 transition"
          >
            ✓
          </button>
          {/* A: schedulable. B: promote-to-schedule once A's are done, else blocked. */}
          {canSchedule && activity.priority === "A" && (
            <button
              onClick={() => onSchedule(activity)}
              disabled={isPending}
              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Schedule
            </button>
          )}
          {canSchedule && activity.priority !== "A" && canPromote && (
            <button
              onClick={() => onPromote(activity)}
              disabled={isPending}
              title="Promote this B to A so it can be scheduled"
              className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
            >
              Promote to A
            </button>
          )}
          {canSchedule && activity.priority !== "A" && !canPromote && (
            <button
              disabled
              title="Finish your A-priority activities first, then promote this B to schedule it"
              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
            className="min-w-0 flex-1 rounded-lg border border-blue-100 px-2 py-1 text-xs text-ink focus:border-blue-400 focus:outline-none"
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
  onMoveToDate: (
    activityId: string,
    toDate: string,
    linkedProjectId: string | null,
  ) => void;
  /** Phase 4: per-activity cycle summary (its schedule blocks today). */
  cycleSummary?: Map<string, CycleSummary>;
  onComplete: (activity: Activity) => void;
  /** Phase 0A: whether B's may be promoted-to-schedule (all of the day's A's are completed). */
  canPromoteB?: boolean;
  onPromote?: (activity: Activity) => void;
  /** On smaller screens, render with a collapse toggle (collapsed by default). */
  collapsibleOnMobile?: boolean;
}

export function UnscheduledList({
  activities,
  projectMap,
  selectedDate,
  isPending,
  onSchedule,
  onMoveToDate,
  cycleSummary,
  onComplete,
  canPromoteB = false,
  onPromote,
  collapsibleOnMobile = false,
}: Props) {
  const isDesktop = useIsDesktop();
  // Collapsed by default on mobile when collapsibleOnMobile is true
  const [expanded, setExpanded] = useState(false);
  // Once desktop is detected, always show expanded
  const isCollapsible = collapsibleOnMobile && !isDesktop;

  const today = todayISO();
  const canSchedule = selectedDate >= today;

  // Phase 0A: only A-priority activities are schedulable onto the timeline. A B reaches the
  // timeline only after being promoted to A (on the B Activities screen). So every non-A row is
  // blocked from scheduling here, and we surface a banner whenever any B is present.
  const hasUnscheduledAPriority = activities.some((a) => a.priority === "A");
  const hasUnschedulableB = activities.some((a) => a.priority !== "A");

  const grouped = groupActivitiesBySection(activities);

  return (
    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden">
      {/* Header — tappable to collapse on mobile */}
      <button
        type="button"
        onClick={() => isCollapsible && setExpanded((v) => !v)}
        className={[
          "w-full px-4 py-3 border-b border-blue-50 text-left",
          isCollapsible
            ? "cursor-pointer hover:bg-blue-50/40 transition"
            : "cursor-default",
        ].join(" ")}
        aria-expanded={isCollapsible ? expanded : undefined}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-ink-light uppercase tracking-wide">
            Unscheduled
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-light">
              {activities.length}{" "}
              {activities.length === 1 ? "activity" : "activities"}
            </span>
            {isCollapsible && (
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className={`h-4 w-4 text-ink-light transition-transform ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <polyline
                  points="5,7 10,13 15,7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
        {!isCollapsible && (
          <p className="text-xs text-ink-light mt-0.5">with remaining time</p>
        )}
      </button>

      {/* Body — hidden when collapsible and collapsed */}
      {(!isCollapsible || expanded) && (
        <div className="p-3 space-y-3">
          {/* A-priority gate banner */}
          {canSchedule && hasUnscheduledAPriority && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              Schedule your <strong>A-priority</strong> activities first before
              scheduling others.
            </div>
          )}
          {/* Phase 0A: B's aren't schedulable directly — promote to A first. */}
          {canSchedule && !hasUnscheduledAPriority && hasUnschedulableB && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Only <strong>A-priority</strong> activities can be scheduled.
              Promote a B to A (on the B&nbsp;Activities screen) to put it on
              the timeline.
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
                        aPriorityBlocked={activity.priority !== "A"}
                        canPromote={canPromoteB}
                        isPending={isPending}
                        cycle={cycleSummary?.get(activity.id)}
                        onSchedule={onSchedule}
                        onPromote={(a) => onPromote?.(a)}
                        onComplete={onComplete}
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
      )}
    </div>
  );
}
