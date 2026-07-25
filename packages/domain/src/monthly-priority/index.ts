import type {
  MonthlyPriority,
  MonthlyPrioritySection,
  MonthlyPriorityStatus,
} from "@pm/types";

// ---------------------------------------------------------------------------
// Limits — hard block of 3 per section per month
// ---------------------------------------------------------------------------

export const MAX_PRIORITIES_PER_SECTION = 3;
export const MIN_PRIORITIES_PER_SECTION = 3;

// ---------------------------------------------------------------------------
// Section constants
// ---------------------------------------------------------------------------

export const MP_SECTIONS: MonthlyPrioritySection[] = [
  "business_career",
  "personal",
];

export const SECTION_LABELS: Record<MonthlyPrioritySection, string> = {
  business_career: "Business / Career",
  personal: "Personal",
};

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

export const MP_STATUSES: MonthlyPriorityStatus[] = [
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "dropped",
];

export const STATUS_LABELS: Record<MonthlyPriorityStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  dropped: "Dropped",
};

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function isValidSection(value: string): value is MonthlyPrioritySection {
  return (MP_SECTIONS as string[]).includes(value);
}

export function isValidStatus(value: string): value is MonthlyPriorityStatus {
  return (MP_STATUSES as string[]).includes(value);
}

/** month_key must match YYYY-MM */
export function isValidMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

export function isValidManualProgress(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

// ---------------------------------------------------------------------------
// Month-key helpers
// ---------------------------------------------------------------------------

/** Returns the current month key in YYYY-MM format (UTC-safe for server rendering). */
export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10); // 1-indexed
  const next = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(next).padStart(2, "0")}`;
}

export function getPrevMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const prev = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prev).padStart(2, "0")}`;
}

/** Formats a month_key as "April 2026" for display. */
export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10);
  // Use a fixed day (1) and noon UTC to avoid TZ boundary issues
  const d = new Date(Date.UTC(year, month - 1, 1, 12));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Status / archive helpers
// ---------------------------------------------------------------------------

export function isArchivedPriority(p: MonthlyPriority): boolean {
  return p.status === "completed" || p.status === "dropped";
}

export function isActivePriority(p: MonthlyPriority): boolean {
  return !isArchivedPriority(p);
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Returns the effective progress percent for display.
 *
 * Spec §10.4: progress is auto from linked project when progress_mode='auto_project'.
 * The caller is responsible for computing projectProgressPercent (e.g. via calcProjectProgress).
 * If mode is manual, returns manual_progress_percent ?? 0.
 */
export function getEffectiveProgress(
  priority: MonthlyPriority,
  projectProgressPercent: number | null,
): number {
  if (
    priority.progress_mode === "auto_project" &&
    projectProgressPercent !== null
  ) {
    return projectProgressPercent;
  }
  return priority.manual_progress_percent ?? 0;
}

// ---------------------------------------------------------------------------
// Stale indicator
// ---------------------------------------------------------------------------

/**
 * Returns true when a priority has had no progress update for thresholdDays.
 * Archived and planned priorities are never stale.
 */
export function isStale(
  priority: MonthlyPriority,
  thresholdDays = 7,
): boolean {
  if (isArchivedPriority(priority)) return false;
  if (priority.status === "planned") return false;
  const ageMs = Date.now() - new Date(priority.updated_at).getTime();
  return ageMs > thresholdDays * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export function groupBySection(
  priorities: MonthlyPriority[],
): Record<MonthlyPrioritySection, MonthlyPriority[]> {
  return {
    business_career: priorities.filter((p) => p.section === "business_career"),
    personal: priorities.filter((p) => p.section === "personal"),
  };
}

// ---------------------------------------------------------------------------
// Section count / capacity
// ---------------------------------------------------------------------------

export function countBySection(
  priorities: MonthlyPriority[],
  section: MonthlyPrioritySection,
  monthKey: string,
): number {
  return priorities.filter(
    (p) => p.section === section && p.month_key === monthKey,
  ).length;
}

export function canAddPriority(
  priorities: MonthlyPriority[],
  section: MonthlyPrioritySection,
  monthKey: string,
): boolean {
  return countBySection(priorities, section, monthKey) < MAX_PRIORITIES_PER_SECTION;
}

// ---------------------------------------------------------------------------
// Carry-forward eligibility
// ---------------------------------------------------------------------------

/**
 * Spec §10.4: carry-forward only allowed if linked project is still in progress.
 * This checks the priority's own state. The caller must separately verify
 * the linked project's status === "in_progress".
 */
export function isEligibleForCarryForward(priority: MonthlyPriority): boolean {
  return (
    priority.status !== "completed" &&
    priority.status !== "dropped" &&
    priority.linked_project_id !== null
  );
}
