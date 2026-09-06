import { type Activity } from "@pm/types";

import { addDaysISO, daysBetweenISO } from "../time-rules";

/**
 * The weekly pool is the middle tier of the planning horizon: Someday (parked) →
 * Weekly (committed to a week, no day yet) → Daily (committed to a day). While an activity
 * sits in the pool its `activity_date` is a soft week anchor rather than a due date.
 */

/** Sunday. Exposed as a parameter so a Monday-start caller can opt in without a second helper. */
export const WEEK_START_DAY = 0;

export const DAYS_PER_WEEK = 7;

/** The ISO date of the week containing `isoDate`, using `startDay` (0 = Sunday). */
export function weekStartISO(
  isoDate: string,
  startDay: number = WEEK_START_DAY,
): string {
  const dayOfWeek = new Date(`${isoDate}T12:00:00`).getDay();
  const offset = (dayOfWeek - startDay + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDaysISO(isoDate, -offset);
}

/** The ISO date of the last day of the week containing `isoDate` (inclusive). */
export function weekEndISO(
  isoDate: string,
  startDay: number = WEEK_START_DAY,
): string {
  return addDaysISO(weekStartISO(isoDate, startDay), DAYS_PER_WEEK - 1);
}

/** Add `n` weeks to an ISO date. Negative `n` goes backwards. */
export function addWeeksISO(isoDate: string, n: number): string {
  return addDaysISO(isoDate, n * DAYS_PER_WEEK);
}

/** The seven ISO dates of the week starting at `weekStart`, in order. */
export function weekDayISOs(weekStart: string): string[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) =>
    addDaysISO(weekStart, i),
  );
}

/** True when `isoDate` falls inside the week starting at `weekStart`. */
export function isDateInWeek(isoDate: string, weekStart: string): boolean {
  const offset = daysBetweenISO(weekStart, isoDate);
  return offset >= 0 && offset < DAYS_PER_WEEK;
}

/** True when the activity is staged in the pool for the week starting at `weekStart`. */
export function isInWeeklyPool(
  activity: Pick<
    Activity,
    "activity_date" | "is_someday" | "is_weekly" | "archived"
  >,
  weekStart: string,
): boolean {
  if (!activity.is_weekly || activity.is_someday || activity.archived)
    return false;
  return isDateInWeek(activity.activity_date, weekStart);
}

/**
 * Pool items anchored to a week that has already passed. Nothing else surfaces these —
 * they fall outside every week view — so without this they would silently disappear.
 */
export function strandedWeeklyItems(
  activities: Activity[],
  currentWeekStart: string,
): Activity[] {
  return activities.filter(
    (a) => a.is_weekly && !a.archived && a.activity_date < currentWeekStart,
  );
}
