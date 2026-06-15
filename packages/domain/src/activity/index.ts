import {
  type Activity,
  type ActivityMove,
  type ActivityRecurrenceRule,
  type ActivitySection,
} from "@pm/types";

import { isDateInPast } from "../time-rules";

/**
 * Phase 0A: the per-day A cap is a *recommended* threshold, not a hard block.
 * The methodology says "no more than three… typically 1 or 2." Adding a 4th A is allowed with an
 * explicit override warning (see `aPriorityWarningLevel`). `MAX_A_PRIORITY_PER_DAY` is the recommended max.
 */
export const MAX_A_PRIORITY_PER_DAY = 3;

export function countAPriorities(activities: Activity[]): number {
  return activities.filter((a) => a.priority === "A").length;
}

/** True while the day is still at/below the recommended A cap. Advisory only — callers may override. */
export function canAddAPriority(existingActivities: Activity[]): boolean {
  return countAPriorities(existingActivities) < MAX_A_PRIORITY_PER_DAY;
}

/**
 * Phase 0A: escalating soft-cap nudge for A priorities, keyed on the resulting A-count for a day.
 *   none  — 0–1 A's (the ideal: "typically 1–2")
 *   hint  — 2–3 A's (gentle "most things are B")
 *   warn  — 4+ A's  (stronger "most days have 1–2 — add anyway?", requires explicit override)
 */
export type APriorityWarningLevel = "none" | "hint" | "warn";

export function aPriorityWarningLevel(resultingACount: number): APriorityWarningLevel {
  if (resultingACount >= MAX_A_PRIORITY_PER_DAY + 1) return "warn";
  if (resultingACount >= 2) return "hint";
  return "none";
}

/**
 * Phase 0A: split a day's activities by priority. Legacy null (should not occur post-migration) is
 * treated as B so every activity lands on exactly one of the two screens.
 */
export function groupActivitiesByPriority(
  activities: Activity[],
): { a: Activity[]; b: Activity[] } {
  return {
    a: activities.filter((act) => act.priority === "A"),
    b: activities.filter((act) => act.priority !== "A"),
  };
}

/** Phase 0A: pure priority transitions (caller handles the soft-cap warning before promoting). */
export function promoteToA(activity: Activity): Activity {
  return { ...activity, priority: "A", updated_at: new Date().toISOString() };
}

export function demoteToB(activity: Activity): Activity {
  return { ...activity, priority: "B", updated_at: new Date().toISOString() };
}

/**
 * Phase 0A: Daily Plan scheduling eligibility for an activity. Only A-priority activities are
 * schedulable onto the timeline; a B reaches the timeline only after being promoted to A.
 */
export function canScheduleActivity(activity: Pick<Activity, "priority">): boolean {
  return activity.priority === "A";
}

/** An A priority still demanding action (not yet completed/cancelled/delegated/postponed). */
function isOpenAPriority(activity: Activity): boolean {
  return (
    activity.priority === "A" &&
    (activity.status === "not_started" || activity.status === "working")
  );
}

/**
 * Phase 0A: the "promote a B to schedule more" path unlocks only once the day's A's are all
 * completed/resolved — i.e. no A is still open. A day with zero A's satisfies this vacuously.
 */
export function canPromoteForScheduling(todaysActivities: Activity[]): boolean {
  return !todaysActivities.some(isOpenAPriority);
}

/** Spec §10.5: Total daily capacity warning threshold in minutes. */
export const DAILY_CAPACITY_MINUTES = 8 * 60; // 8 hours

export function totalEstimatedMinutes(activities: Activity[]): number {
  return activities.reduce((sum, a) => sum + a.estimated_minutes, 0);
}

export function exceedsDailyCapacity(activities: Activity[]): boolean {
  return totalEstimatedMinutes(activities) > DAILY_CAPACITY_MINUTES;
}

/** Spec §10.5: Carry-forward — returns activities eligible to move to a future date. */
export function getCarryForwardEligible(activities: Activity[]): Activity[] {
  return activities.filter(
    (a) => a.status === "not_started" || a.status === "postponed",
  );
}

// ---------------------------------------------------------------------------
// Phase 1B — 30-day horizon + Someday list
// ---------------------------------------------------------------------------

/** Spec FOTW: keep only the next ~30 days in active view ("he only keeps the next 30 days"). */
export const HORIZON_DAYS = 30;

/** Days since the weekly Someday review should trigger again. */
export const SOMEDAY_REVIEW_INTERVAL_DAYS = 7;

/** Add `days` to an ISO date (YYYY-MM-DD), noon-anchored to avoid timezone drift. */
function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two ISO dates (b - a). */
function daysBetweenISO(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T12:00:00`).getTime();
  const b = new Date(`${bISO}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Within the rolling horizon = not someday AND dated on/before today+HORIZON_DAYS.
 * Past/overdue items count as within-horizon (still near-term); far-future items don't.
 */
export function isWithinHorizon(
  activity: Pick<Activity, "activity_date" | "is_someday">,
  todayISO: string,
): boolean {
  if (activity.is_someday) return false;
  return activity.activity_date <= addDaysISO(todayISO, HORIZON_DAYS);
}

/** Split activities into the within-horizon / beyond-horizon / someday buckets. */
export function partitionByHorizon(
  activities: Activity[],
  todayISO: string,
): { withinHorizon: Activity[]; beyondHorizon: Activity[]; someday: Activity[] } {
  const horizonEnd = addDaysISO(todayISO, HORIZON_DAYS);
  const withinHorizon: Activity[] = [];
  const beyondHorizon: Activity[] = [];
  const someday: Activity[] = [];
  for (const a of activities) {
    if (a.is_someday) someday.push(a);
    else if (a.activity_date <= horizonEnd) withinHorizon.push(a);
    else beyondHorizon.push(a);
  }
  return { withinHorizon, beyondHorizon, someday };
}

/** True when the weekly Someday review is due (never reviewed, or ≥7 days since). */
export function getSomedayReviewDue(lastReviewedISO: string | null, todayISO: string): boolean {
  if (!lastReviewedISO) return true;
  return daysBetweenISO(lastReviewedISO, todayISO) >= SOMEDAY_REVIEW_INTERVAL_DAYS;
}

// ---------------------------------------------------------------------------
// Phase 2A — intentional B re-dating
// ---------------------------------------------------------------------------

/**
 * Suggests a thoughtful re-date instead of a blind "tomorrow":
 *   - non-A (B) items → today + 7 (the methodology's "at least a week out" for non-A's)
 *   - A items → today + 1
 * The UI pre-fills this but never forces it.
 */
export function suggestRedate(
  activity: Pick<Activity, "priority">,
  todayISO: string,
): string {
  return addDaysISO(todayISO, activity.priority === "A" ? 1 : 7);
}

/** Build the move-history record for an activity re-date (server adds the id). */
export function buildActivityMove(params: {
  activity: Pick<Activity, "id" | "user_id" | "activity_date">;
  toDateISO: string;
  nowISO: string;
  reason?: string | null;
}): Omit<ActivityMove, "id"> {
  const { activity, toDateISO, nowISO, reason = null } = params;
  return {
    user_id: activity.user_id,
    activity_id: activity.id,
    from_date: activity.activity_date,
    to_date: toDateISO,
    reason: reason && reason.trim() ? reason.trim() : null,
    moved_at: nowISO,
  };
}

/** Whether a re-date target is allowed (not in the past). */
export function canRedateTo(toDateISO: string): boolean {
  return !isDateInPast(toDateISO);
}

/** Groups activities by section for rendering. Used by Activities tab and Daily Plan. */
export function groupActivitiesBySection(
  activities: Activity[],
): Record<ActivitySection, Activity[]> {
  return {
    work: activities.filter((a) => a.section_type === "work"),
    outside: activities.filter((a) => a.section_type === "outside"),
    delegated: activities.filter((a) => a.section_type === "delegated"),
    unplanned: activities.filter((a) => a.section_type === "unplanned"),
  };
}

/**
 * Given a start date (ISO YYYY-MM-DD), a recurrence rule, and a count,
 * returns the next `count` occurrence dates as ISO strings.
 * Mirrors the helper in apps/web/src/app/(app)/activities/actions.ts.
 */
export function buildRecurringDates(
  startISO: string,
  rule: ActivityRecurrenceRule,
  count: number,
): string[] {
  const dates: string[] = [];
  const [y = 0, m = 0, d = 0] = startISO.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  for (let i = 1; i <= count; i++) {
    const next = new Date(base);
    if (rule === "daily") next.setDate(next.getDate() + i);
    else if (rule === "weekly") next.setDate(next.getDate() + i * 7);
    else if (rule === "monthly") next.setMonth(next.getMonth() + i);
    dates.push(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`,
    );
  }
  return dates;
}
