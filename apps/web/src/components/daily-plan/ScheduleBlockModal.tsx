"use client";

import { useState } from "react";

import { isDateTimeInPast, todayISO } from "@pm/domain";
import type { Activity, CalendarEvent, Meeting, ScheduleInstance, ScheduleInstanceStatus } from "@pm/types";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatLocalTime(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

const STATUS_LABELS: Record<ScheduleInstanceStatus, string> = {
  upcoming: "Upcoming",
  working: "Working",
  completed: "Completed",
  postponed: "Postponed",
  missed: "Missed",
};

interface Props {
  instance: ScheduleInstance;
  activity: Activity | null;
  meeting: Meeting | null;
  event?: CalendarEvent | null;
  projectName: string | null;
  isPending: boolean;
  onClose: () => void;
  onUnschedule: (instanceId: string, activityId: string) => void;
  onUnscheduleRunning: (instanceId: string, activityId: string, mode: "full" | "split") => void;
  onStatusUpdate: (instanceId: string, status: ScheduleInstanceStatus) => void;
  onPostpone: (activityId: string, toDate: string, linkedProjectId: string | null) => void;
  /**
   * Early-start: move this later-scheduled cycle to start now. Provided only when
   * the block is an eligible upcoming activity cycle (today). When `startNowBlocked`
   * is true there's no room, so the option is shown disabled with a reason.
   */
  onStartNow?: ((instance: ScheduleInstance) => void) | undefined;
  startNowBlocked?: boolean;
}

export function ScheduleBlockModal({
  instance,
  activity,
  meeting,
  event,
  projectName,
  isPending,
  onClose,
  onUnschedule,
  onUnscheduleRunning,
  onStatusUpdate,
  onPostpone,
  onStartNow,
  startNowBlocked = false,
}: Props) {
  const [postponeDate, setPostponeDate] = useState("");
  const [showPostponeInput, setShowPostponeInput] = useState(false);
  const [showRunningChoice, setShowRunningChoice] = useState(false);

  const isPast = isDateTimeInPast(instance.start_at);
  const isEnded = isDateTimeInPast(instance.end_at);
  const isRunning = isPast && !isEnded; // started but not yet ended
  const isMeetingBlock = instance.source_type === "meeting";
  const isEventBlock = instance.source_type === "appointment" || instance.source_type === "other";
  const eventLabel = instance.source_type === "appointment" ? "Appointment" : "Event";
  const title = isMeetingBlock
    ? (meeting?.title ?? "Meeting")
    : isEventBlock
      ? (event?.title ?? eventLabel)
      : (activity?.title ?? "Unknown activity");
  const focus = instance.focus_minutes ?? instance.locked_minutes;

  // Estimate elapsed / remaining for display in running-block choice
  const elapsedMin = isRunning
    ? Math.max(1, Math.floor((Date.now() - new Date(instance.start_at).getTime()) / 60_000))
    : 0;
  const remainingMin = Math.max(0, focus - elapsedMin);

  function handlePostpone() {
    if (!postponeDate || !activity) return;
    onPostpone(activity.id, postponeDate, activity.linked_project_id ?? null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-handwriting text-xl text-ink">{title}</h2>
            {isMeetingBlock && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 uppercase tracking-wide">
                Meeting
              </span>
            )}
            {isEventBlock && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
                {eventLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-light mt-0.5">
            {formatLocalTime(instance.start_at)} – {formatLocalTime(instance.end_at)}
            {" · "}{formatMinutes(focus)}
            {projectName && <span className="text-blue-600"> · {projectName}</span>}
          </p>
          {instance.note && (
            <p className="mt-1 text-xs italic text-ink-light">“{instance.note}”</p>
          )}
          {isMeetingBlock && meeting && (
            <div className="mt-2 space-y-0.5">
              {meeting.agenda && (
                <p className="text-xs text-ink-light whitespace-pre-wrap leading-relaxed">
                  <span className="font-medium text-ink-light/60 uppercase tracking-wide text-[10px]">Agenda · </span>
                  {meeting.agenda}
                </p>
              )}
              {meeting.status && meeting.status !== "upcoming" && (
                <p className="text-[10px] font-medium capitalize text-ink-light/60">{meeting.status}</p>
              )}
            </div>
          )}
          {isRunning && (
            <p className="text-[10px] font-medium text-amber-600 mt-1">Currently running</p>
          )}
        </div>

        <div className="space-y-2">
          {/* Early-start a later-scheduled cycle now (only when there's room) */}
          {onStartNow && (
            startNowBlocked ? (
              <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-left">
                <p className="text-sm font-medium text-ink-light">▶ Start now</p>
                <p className="text-[11px] text-ink-light/80">No room — another block overlaps the next {formatMinutes(focus)}.</p>
              </div>
            ) : (
              <button
                onClick={() => { onStartNow(instance); onClose(); }}
                disabled={isPending}
                className="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 text-left"
              >
                ▶ Start now <span className="font-normal text-indigo-500">· move this cycle to now</span>
              </button>
            )
          )}

          {/* Completed block — locked, read-only */}
          {instance.status_snapshot === "completed" && (
            <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
              This block is completed and cannot be modified.
            </div>
          )}

          {/* Status updates — past/running activity blocks, or any meeting/appointment block. */}
          {(isPast || isMeetingBlock || isEventBlock) && instance.status_snapshot !== "completed" && (
            <div>
              <p className="text-[10px] font-semibold text-ink-light uppercase tracking-wide mb-1.5">
                Update Status
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(["completed", "working", "postponed", "missed"] as ScheduleInstanceStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { onStatusUpdate(instance.id, s); onClose(); }}
                    disabled={isPending || instance.status_snapshot === s}
                    className="rounded-lg border border-blue-100 px-3 py-2 text-xs font-medium text-ink hover:bg-blue-50 disabled:opacity-40 disabled:cursor-default"
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Move to unscheduled */}
          {!isEnded && instance.status_snapshot !== "completed" && instance.source_activity_id && (
            <>
              {/* Future block — simple unschedule */}
              {!isRunning && (
                <button
                  onClick={() => { onUnschedule(instance.id, instance.source_activity_id!); onClose(); }}
                  disabled={isPending}
                  className="w-full rounded-lg border border-blue-100 px-4 py-2.5 text-sm text-ink-light hover:bg-blue-50 hover:text-ink disabled:opacity-50 text-left"
                >
                  ↩ Move back to unscheduled
                </button>
              )}

              {/* Running block — two-choice prompt */}
              {isRunning && !showRunningChoice && (
                <button
                  onClick={() => setShowRunningChoice(true)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50 text-left"
                >
                  ↩ Move back to unscheduled…
                </button>
              )}

              {isRunning && showRunningChoice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-800">
                    This block is currently running (~{formatMinutes(elapsedMin)} elapsed).
                    How would you like to handle it?
                  </p>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        onUnscheduleRunning(instance.id, instance.source_activity_id!, "split");
                        onClose();
                      }}
                      disabled={isPending}
                      className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-ink hover:bg-amber-50 disabled:opacity-50 text-left"
                    >
                      Mark elapsed ({formatMinutes(elapsedMin)}) as completed,
                      return {formatMinutes(remainingMin)} to unscheduled
                    </button>
                    <button
                      onClick={() => {
                        onUnscheduleRunning(instance.id, instance.source_activity_id!, "full");
                        onClose();
                      }}
                      disabled={isPending}
                      className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-ink hover:bg-amber-50 disabled:opacity-50 text-left"
                    >
                      Move entire block ({formatMinutes(focus)}) to unscheduled
                    </button>
                  </div>
                  <button
                    onClick={() => setShowRunningChoice(false)}
                    className="text-[10px] text-amber-600 hover:text-amber-800 px-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}

          {/* Postpone to another date */}
          {activity && instance.status_snapshot !== "completed" && (
            <>
              {!showPostponeInput ? (
                <button
                  onClick={() => setShowPostponeInput(true)}
                  className="w-full rounded-lg border border-blue-100 px-4 py-2.5 text-sm text-ink-light hover:bg-blue-50 hover:text-ink text-left"
                >
                  → Postpone to another date
                </button>
              ) : (
                <div className="rounded-lg border border-blue-100 p-3 space-y-2">
                  <label className="block text-xs font-medium text-ink-light">Move to date</label>
                  <input
                    type="date"
                    value={postponeDate}
                    min={todayISO()}
                    onChange={(e) => setPostponeDate(e.target.value)}
                    className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowPostponeInput(false)}
                      className="text-xs text-ink-light hover:text-ink px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePostpone}
                      disabled={!postponeDate || isPending}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Move
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="pt-1 border-t border-blue-50">
          <button
            onClick={onClose}
            className="w-full rounded-lg px-4 py-2 text-sm text-ink-light hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
