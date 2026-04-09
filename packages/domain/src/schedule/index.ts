import { type ScheduleInstance } from "@pm/types";

/**
 * Spec §10.6: Overlap prevention.
 *
 * Two schedule blocks overlap if one starts before the other ends.
 * Uses half-open interval: [start, end) so back-to-back blocks don't conflict.
 */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface OverlapCheckResult {
  overlaps: boolean;
  conflictingInstances: ScheduleInstance[];
}

/**
 * Checks whether a proposed [proposedStart, proposedEnd) block overlaps
 * with any existing schedule instances on the same day for the same user.
 *
 * @param existing  — all existing schedule_instances for the user on that date
 * @param proposedStart — ISO datetime string
 * @param proposedEnd   — ISO datetime string
 * @param excludeId     — optional: exclude this instance (for reschedule checks)
 */
export function checkScheduleOverlap(
  existing: ScheduleInstance[],
  proposedStart: string,
  proposedEnd: string,
  excludeId?: string,
): OverlapCheckResult {
  const pStart = new Date(proposedStart);
  const pEnd = new Date(proposedEnd);

  const conflictingInstances = existing.filter((inst) => {
    if (excludeId && inst.id === excludeId) return false;
    return intervalsOverlap(pStart, pEnd, new Date(inst.start_at), new Date(inst.end_at));
  });

  return {
    overlaps: conflictingInstances.length > 0,
    conflictingInstances,
  };
}

/**
 * Spec §10.6: focus_minutes must be > 0.
 * When remaining_minutes is 0 (all estimated time worked), still allow scheduling
 * extra blocks — this logs additional hours_worked without changing estimated_minutes.
 * Returns an error string or null if valid.
 */
export function validateFocusMinutes(
  focusMinutes: number,
  activityRemainingMinutes: number,
): string | null {
  if (focusMinutes <= 0) {
    return "Focus duration must be greater than 0 minutes";
  }
  // Only cap focus_minutes when there is remaining time to consume.
  // If remaining is 0, the user is scheduling extra overwork time — allowed.
  if (activityRemainingMinutes > 0 && focusMinutes > activityRemainingMinutes) {
    return `Focus duration (${focusMinutes}m) exceeds remaining activity time (${activityRemainingMinutes}m)`;
  }
  return null;
}

/**
 * Spec §10.6: locked_minutes must match the wall-clock duration.
 * Returns an error string or null if valid.
 */
export function validateLockedMinutes(
  lockedMinutes: number,
  startAt: string,
  endAt: string,
): string | null {
  const wallClockMinutes =
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000;
  if (Math.abs(wallClockMinutes - lockedMinutes) > 1) {
    return `locked_minutes (${lockedMinutes}) does not match wall-clock duration (${Math.round(wallClockMinutes)}m)`;
  }
  return null;
}
