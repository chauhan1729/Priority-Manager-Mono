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
 * Spec §10.6: focus_minutes must be ≤ activity's remaining_minutes.
 * Returns an error string or null if valid.
 */
export function validateFocusMinutes(
  focusMinutes: number,
  activityRemainingMinutes: number,
): string | null {
  if (focusMinutes <= 0) {
    return "Focus duration must be greater than 0 minutes";
  }
  if (focusMinutes > activityRemainingMinutes) {
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
