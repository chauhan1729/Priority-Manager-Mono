"use client";

import { isDateTimeInPast } from "@pm/domain";
import type { Activity, ScheduleInstance, ScheduleInstanceStatus } from "@pm/types";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const STATUS_COLORS: Record<ScheduleInstanceStatus, string> = {
  upcoming: "bg-blue-50 border-blue-200",
  working: "bg-amber-50 border-amber-200",
  completed: "bg-green-50 border-green-200",
  postponed: "bg-orange-50 border-orange-200",
  missed: "bg-gray-50 border-gray-200",
};

interface Props {
  instance: ScheduleInstance;
  activity: Activity | null;
  projectName: string | null;
  startLabel: string;
  isPending: boolean;
  /** Called when user clicks the block — parent opens ScheduleBlockModal */
  onClick: () => void;
}

export function ScheduleBlock({
  instance,
  activity,
  projectName,
  startLabel,
  isPending,
  onClick,
}: Props) {
  const status = instance.status_snapshot ?? "upcoming";
  const isPast = isDateTimeInPast(instance.start_at);
  const colorClass = STATUS_COLORS[status];

  const title = activity?.title ?? "Unknown activity";
  const priority = activity?.priority ?? null;
  const focusDuration = instance.focus_minutes ?? instance.locked_minutes;
  const isCompact = instance.locked_minutes < 30;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={`
        h-full w-full rounded-md border px-2 py-1 overflow-hidden text-left
        transition hover:brightness-95 active:brightness-90 ${colorClass}
        ${isPending ? "opacity-50 pointer-events-none" : ""}
        ${isPast && status === "upcoming" ? "ring-1 ring-amber-300" : ""}
      `}
      title="Click to manage this block"
    >
      {/* Header row — "Cycle name | Activity title" when the cycle has a name */}
      <div className="flex items-start justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          {priority && (
            <span
              className={`flex-shrink-0 rounded px-1 text-[10px] font-bold ${
                priority === "A" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"
              }`}
            >
              {priority}
            </span>
          )}
          <span
            className={`text-xs truncate ${
              status === "completed" ? "text-ink-light line-through" : "text-ink"
            }`}
          >
            {instance.note ? (
              <>
                <span className="font-medium">{instance.note}</span>
                <span className="mx-1 text-ink-light/50">|</span>
                <span className="font-normal text-ink-light">{title}</span>
              </>
            ) : (
              <span className="font-medium">{title}</span>
            )}
          </span>
        </div>
        <span className="flex-shrink-0 text-[10px] text-ink-light">{startLabel}</span>
      </div>

      {/* Detail row — only if block tall enough */}
      {!isCompact && (
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-ink-light">
          {projectName && <span className="text-blue-600 truncate">{projectName}</span>}
          <span>{formatMinutes(focusDuration)}</span>
          {isPast && status === "upcoming" && (
            <span className="text-amber-600 font-medium">needs update</span>
          )}
        </div>
      )}
    </button>
  );
}
