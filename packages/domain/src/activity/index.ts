import { type Activity, type ActivityRecurrenceRule, type ActivitySection } from "@pm/types";

/** Spec §10.5: Hard block — no more than 3 A-priority activities per day. */
export const MAX_A_PRIORITY_PER_DAY = 3;

export function countAPriorities(activities: Activity[]): number {
  return activities.filter((a) => a.priority === "A").length;
}

export function canAddAPriority(existingActivities: Activity[]): boolean {
  return countAPriorities(existingActivities) < MAX_A_PRIORITY_PER_DAY;
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
