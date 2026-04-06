import type { AnnualGoal, AnnualGoalSection, AnnualGoalStatus } from "@pm/types";

// ---------------------------------------------------------------------------
// Section helpers
// ---------------------------------------------------------------------------

export const ANNUAL_GOAL_SECTIONS: AnnualGoalSection[] = ["business", "career", "personal"];

export const SECTION_LABELS: Record<AnnualGoalSection, string> = {
  business: "Business",
  career: "Career",
  personal: "Personal",
};

/** Returns true only if the section value is one of the three allowed sections. */
export function isValidSection(value: string): value is AnnualGoalSection {
  return (ANNUAL_GOAL_SECTIONS as string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export const ANNUAL_GOAL_STATUSES: AnnualGoalStatus[] = [
  "not_started",
  "active",
  "on_track",
  "at_risk",
  "completed",
  "dropped",
];

export const STATUS_LABELS: Record<AnnualGoalStatus, string> = {
  not_started: "Not Started",
  active: "Active",
  on_track: "On Track",
  at_risk: "At Risk",
  completed: "Completed",
  dropped: "Dropped",
};

export function isValidStatus(value: string): value is AnnualGoalStatus {
  return (ANNUAL_GOAL_STATUSES as string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Archive logic
// ---------------------------------------------------------------------------

/**
 * Spec §10.3: completed and dropped goals are archivable from the default active view.
 * These two statuses are the only ones considered "archived".
 */
export function isArchivedGoal(goal: AnnualGoal): boolean {
  return goal.status === "completed" || goal.status === "dropped";
}

/** Inverse: goal is visible in the default active view. */
export function isActiveGoal(goal: AnnualGoal): boolean {
  return !isArchivedGoal(goal);
}

// ---------------------------------------------------------------------------
// Project linkage
// ---------------------------------------------------------------------------

/**
 * Spec §10.3: Activities should remain under projects, not Annual Strategies.
 * Linking a project to a goal is allowed as long as the goal is not archived.
 * An archived goal should not receive new project links.
 */
export function canLinkProject(goal: AnnualGoal): boolean {
  return !isArchivedGoal(goal);
}

// ---------------------------------------------------------------------------
// Progress validation
// ---------------------------------------------------------------------------

/**
 * Spec §10.3: Progress is manual. Validates the provided value is 0–100.
 * Does NOT derive from projects or activities.
 */
export function isValidProgress(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

// ---------------------------------------------------------------------------
// Section grouping
// ---------------------------------------------------------------------------

/** Groups an array of AnnualGoals by section, preserving insertion order within each group. */
export function groupGoalsBySection(
  goals: AnnualGoal[],
): Record<AnnualGoalSection, AnnualGoal[]> {
  const result: Record<AnnualGoalSection, AnnualGoal[]> = {
    business: [],
    career: [],
    personal: [],
  };
  for (const goal of goals) {
    result[goal.section].push(goal);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

export function filterActive(goals: AnnualGoal[]): AnnualGoal[] {
  return goals.filter(isActiveGoal);
}

export function filterArchived(goals: AnnualGoal[]): AnnualGoal[] {
  return goals.filter(isArchivedGoal);
}
