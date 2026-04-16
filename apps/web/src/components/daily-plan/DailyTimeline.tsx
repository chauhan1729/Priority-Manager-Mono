"use client";

import type { Activity, CalendarEvent, Meeting, ScheduleInstance } from "@pm/types";
import { ScheduleBlock } from "./ScheduleBlock";

/**
 * Timeline configuration — spec §10.6.
 * Range: 0am–24 (full 24 hours).
 * Pixels per hour: 64px.
 */
const TIMELINE_START_HOUR = 0; // midnight
const TIMELINE_END_HOUR = 24; // midnight next day
const TOTAL_HOURS = 24;
const PX_PER_HOUR = 64;
const PX_PER_MIN = PX_PER_HOUR / 60;
const TIMELINE_START_MIN = 0;
const TOTAL_HEIGHT = TOTAL_HOURS * PX_PER_HOUR; // 1536px

const HOUR_LABELS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
  if (i === 0 || i === 24) return "12am";
  if (i === 12) return "12pm";
  return i < 12 ? `${i}am` : `${i - 12}pm`;
});

/** Converts a UTC ISO datetime string to local-time minutes from midnight. */
function toLocalMinutes(isoDatetime: string): number {
  const d = new Date(isoDatetime);
  return d.getHours() * 60 + d.getMinutes();
}

/** Returns pixel offset from the top of the timeline for a given local minute value. */
function minutesToPx(localMinutes: number): number {
  return (localMinutes - TIMELINE_START_MIN) * PX_PER_MIN;
}

/** Returns "H:MM am/pm" from local-time minutes. */
function formatLocalTime(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

interface Props {
  scheduleInstances: ScheduleInstance[];
  activityMap: Map<string, Activity>;
  projectMap: Map<string, string>;
  /**
   * Meeting records keyed by id — renders meeting blocks (violet) on the timeline.
   * Populated from meetings fetched for the selected date.
   */
  meetingMap?: Map<string, Meeting>;
  /**
   * CalendarEvent records keyed by id — renders appointment/other blocks (teal/gray).
   * Populated from calendar_events (appointment, other) for the selected date.
   */
  eventMap?: Map<string, CalendarEvent>;
  selectedDate: string;
  isPending: boolean;
  canSchedule: boolean;
  onBlockClick: (instance: ScheduleInstance) => void;
  /** Called with local "HH:MM" when user clicks an empty grid area. */
  onSlotClick: (startTime: string) => void;
}

export function DailyTimeline({
  scheduleInstances,
  activityMap,
  projectMap,
  meetingMap = new Map(),
  eventMap = new Map(),
  selectedDate,
  isPending,
  canSchedule,
  onBlockClick,
  onSlotClick,
}: Props) {
  /** Convert a click Y offset (px from top of grid) to a local "HH:MM" snapped to 15 min. */
  function yToStartTime(yPx: number): string {
    const rawMin = yPx / PX_PER_MIN + TIMELINE_START_MIN;
    const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(rawMin / 15) * 15));
    const h = Math.floor(snapped / 60);
    const m = snapped % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!canSchedule) return;
    // Ignore clicks that originated inside a schedule block button
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const yPx = e.clientY - rect.top;
    onSlotClick(yToStartTime(yPx));
  }

  // Current time indicator
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isToday = selectedDate === nowStr;
  const nowPx =
    nowMinutes >= TIMELINE_START_MIN && nowMinutes <= TIMELINE_END_HOUR * 60
      ? minutesToPx(nowMinutes)
      : null;

  return (
    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-blue-50">
        <h3 className="text-xs font-semibold text-ink-light uppercase tracking-wide">Timeline</h3>
      </div>

      {/* Scrollable timeline container */}
      <div className="overflow-y-auto max-h-[70vh]">
        <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>
          {/* Hour labels column */}
          <div className="relative flex-shrink-0 w-12 border-r border-blue-50">
            {HOUR_LABELS.map((label, i) => (
              <div
                key={label + String(i)}
                className="absolute right-2 text-[10px] text-ink-light leading-none"
                style={{ top: i * PX_PER_HOUR - 6 }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid + blocks area */}
          <div
            className={`relative flex-1 ${canSchedule ? "cursor-crosshair" : ""}`}
            onClick={handleGridClick}
          >
            {/* Hour grid lines */}
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-blue-50"
                style={{ top: i * PX_PER_HOUR }}
              />
            ))}

            {/* Half-hour grid lines (lighter) */}
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={`half-${i}`}
                className="absolute left-0 right-0 border-t border-blue-50/50"
                style={{ top: i * PX_PER_HOUR + PX_PER_HOUR / 2 }}
              />
            ))}

            {/* Current time indicator */}
            {isToday && nowPx !== null && (
              <div
                className="absolute left-0 right-0 z-10 flex items-center"
                style={{ top: nowPx }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                <div className="flex-1 border-t-2 border-red-400" />
              </div>
            )}

            {/* Scheduled blocks */}
            {scheduleInstances.map((instance) => {
              const startLocalMin = toLocalMinutes(instance.start_at);
              const top = minutesToPx(startLocalMin);
              const height = Math.max(instance.locked_minutes * PX_PER_MIN, 24);

              // Clip blocks outside timeline range
              if (startLocalMin < TIMELINE_START_MIN || startLocalMin >= TIMELINE_END_HOUR * 60) {
                return null;
              }

              // ── Meeting block (source_type = "meeting") ──────────────────
              // Architecture hook: rendered when Calendar creates meeting ScheduleInstances.
              // The meetingMap is populated from the Daily Plan page once Calendar is built.
              if (instance.source_type === "meeting" && instance.source_meeting_id) {
                const meeting = meetingMap.get(instance.source_meeting_id);
                if (!meeting) return null;
                return (
                  <div
                    key={instance.id}
                    className="absolute left-1 right-1"
                    style={{ top, height }}
                  >
                    <button
                      type="button"
                      onClick={() => onBlockClick(instance)}
                      disabled={isPending}
                      className="w-full h-full rounded-lg bg-violet-100 border border-violet-200 px-2 py-1 text-left overflow-hidden hover:bg-violet-200 transition-colors disabled:opacity-50"
                    >
                      <p className="text-[10px] font-semibold text-violet-800 truncate leading-tight">
                        {meeting.title}
                      </p>
                      <p className="text-[9px] text-violet-600 truncate leading-tight">
                        {formatLocalTime(instance.start_at)}
                      </p>
                    </button>
                  </div>
                );
              }

              // ── Appointment / other block (source_event_id) ─────────────
              if (
                (instance.source_type === "appointment" || instance.source_type === "other") &&
                instance.source_event_id
              ) {
                const calEvent = eventMap.get(instance.source_event_id);
                if (!calEvent) return null;
                const isOther = instance.source_type === "other";
                return (
                  <div
                    key={instance.id}
                    className="absolute left-1 right-1"
                    style={{ top, height }}
                  >
                    <button
                      type="button"
                      onClick={() => onBlockClick(instance)}
                      disabled={isPending}
                      className={[
                        "w-full h-full rounded-lg border px-2 py-1 text-left overflow-hidden transition-colors disabled:opacity-50",
                        isOther
                          ? "bg-gray-50 border-gray-200 hover:bg-gray-100"
                          : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
                      ].join(" ")}
                    >
                      <p className={`text-[10px] font-semibold truncate leading-tight ${isOther ? "text-gray-700" : "text-emerald-800"}`}>
                        {calEvent.title}
                      </p>
                      <p className={`text-[9px] truncate leading-tight ${isOther ? "text-gray-500" : "text-emerald-600"}`}>
                        {formatLocalTime(instance.start_at)}
                      </p>
                    </button>
                  </div>
                );
              }

              // ── Activity block (source_type = "activity") ────────────────
              if (instance.source_type !== "activity" || !instance.source_activity_id) return null;

              const activity = activityMap.get(instance.source_activity_id);
              return (
                <div
                  key={instance.id}
                  className="absolute left-1 right-1"
                  style={{ top, height }}
                >
                  <ScheduleBlock
                    instance={instance}
                    activity={activity ?? null}
                    projectName={
                      activity?.linked_project_id
                        ? (projectMap.get(activity.linked_project_id) ?? null)
                        : null
                    }
                    startLabel={formatLocalTime(instance.start_at)}
                    isPending={isPending}
                    onClick={() => onBlockClick(instance)}
                  />
                </div>
              );
            })}

            {/* Empty state */}
            {scheduleInstances.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-xs text-ink-light">
                  No scheduled blocks. Schedule from the list →
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
