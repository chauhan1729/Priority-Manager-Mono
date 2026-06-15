import type { Activity, Cycle } from "@pm/types";

import { isDateInPast } from "../time-rules";

/**
 * Phase 1A — Work Cycles. Completion-driven, COUNT-UP focus sessions (no countdown, no fixed length).
 * `soft_target_minutes` (from the activity estimate) is informational only.
 *
 * Live elapsed time is derived from anchors (started/segment), never an in-memory counter:
 *   elapsedFocusMinutes = elapsed_focus_minutes (banked segments)
 *                       + (phase === "focus" ? now - segment_started_at : 0)
 */

/** The ~20-minute "change your energy" cadence validated across the FOTW testimonials. */
export const ENERGY_CHANGE_INTERVAL_MIN = 20;

/** Whole minutes between two ISO datetimes (rounded, never negative). */
export function minutesBetween(fromISO: string, toISO: string): number {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/** The insertable shape of a new cycle (server adds id/user_id/timestamps). */
export type CycleStart = Omit<Cycle, "id" | "user_id" | "created_at" | "updated_at">;

/**
 * A cycle can only be started for a present/future, non-finished activity
 * (no working in the past — consistent with the app's time rules).
 */
export function canStartCycle(
  activity: Pick<Activity, "activity_date" | "status">,
): boolean {
  if (isDateInPast(activity.activity_date)) return false;
  return activity.status !== "completed" && activity.status !== "cancelled";
}

/** Build a fresh focus cycle for an activity. Soft target comes from the estimate (or null). */
export function buildCycleStart(params: {
  activity: Pick<Activity, "id" | "estimated_minutes">;
  scheduleInstanceId?: string | null;
  nowISO: string;
}): CycleStart {
  const { activity, scheduleInstanceId = null, nowISO } = params;
  const target =
    activity.estimated_minutes && activity.estimated_minutes > 0
      ? activity.estimated_minutes
      : null;
  return {
    activity_id: activity.id,
    schedule_instance_id: scheduleInstanceId,
    soft_target_minutes: target,
    elapsed_focus_minutes: 0,
    segment_started_at: nowISO,
    break_count: 0,
    phase: "focus",
    started_at: nowISO,
    completed_at: null,
    note: null,
  };
}

/** Banked focus minutes including the active (un-banked) focus segment up to `nowISO`. */
function bankedWithActiveSegment(cycle: Cycle, nowISO: string): number {
  if (cycle.phase === "focus" && cycle.segment_started_at) {
    return cycle.elapsed_focus_minutes + minutesBetween(cycle.segment_started_at, nowISO);
  }
  return cycle.elapsed_focus_minutes;
}

/** Live total focus minutes for display. */
export function elapsedFocusMinutes(cycle: Cycle, nowISO: string): number {
  return bankedWithActiveSegment(cycle, nowISO);
}

/**
 * True once the active focus segment has run ≥ intervalMin — drives the gentle
 * "change your energy" nudge. Informational only; never pauses or completes the cycle.
 */
export function shouldPromptEnergyChange(
  cycle: Cycle,
  nowISO: string,
  intervalMin: number = ENERGY_CHANGE_INTERVAL_MIN,
): boolean {
  if (cycle.phase !== "focus" || !cycle.segment_started_at) return false;
  return minutesBetween(cycle.segment_started_at, nowISO) >= intervalMin;
}

/** Take a (deliberately short) mini-break: bank the active segment, pause the count-up. */
export function takeMiniBreak(cycle: Cycle, nowISO: string): Cycle {
  if (cycle.phase !== "focus") return cycle;
  return {
    ...cycle,
    elapsed_focus_minutes: bankedWithActiveSegment(cycle, nowISO),
    segment_started_at: null,
    break_count: cycle.break_count + 1,
    phase: "break",
    updated_at: nowISO,
  };
}

/** Resume focus after a break — re-anchor the count-up to `nowISO`. */
export function resumeCycle(cycle: Cycle, nowISO: string): Cycle {
  if (cycle.phase !== "break") return cycle;
  return {
    ...cycle,
    segment_started_at: nowISO,
    phase: "focus",
    updated_at: nowISO,
  };
}

/** Complete the cycle (user-driven — never auto-completed by elapsing a timer). */
export function completeCycle(cycle: Cycle, nowISO: string, note?: string): Cycle {
  if (cycle.phase === "completed" || cycle.phase === "abandoned") return cycle;
  return {
    ...cycle,
    elapsed_focus_minutes: bankedWithActiveSegment(cycle, nowISO),
    segment_started_at: null,
    phase: "completed",
    completed_at: nowISO,
    note: note?.trim() ? note.trim() : cycle.note,
    updated_at: nowISO,
  };
}

/** Abandon the cycle (e.g. the user discards it without completing). */
export function abandonCycle(cycle: Cycle, nowISO: string): Cycle {
  if (cycle.phase === "completed") return cycle;
  return {
    ...cycle,
    elapsed_focus_minutes: bankedWithActiveSegment(cycle, nowISO),
    segment_started_at: null,
    phase: "abandoned",
    updated_at: nowISO,
  };
}

/** Count of cycles completed (drives the "ahead of schedule" acknowledgment). */
export function cyclesCompletedToday(cycles: Pick<Cycle, "phase">[]): number {
  return cycles.filter((c) => c.phase === "completed").length;
}

/** Verbal-style "cycle completed / ahead of schedule" line for the UI (data only, no I/O). */
export function acknowledgmentMessage(completedCount: number): string {
  if (completedCount <= 0) return "Start a cycle — finish one thing fully.";
  if (completedCount === 1) return "Cycle completed. One down — you're moving.";
  return `${completedCount} cycles completed — you're ahead of schedule.`;
}
