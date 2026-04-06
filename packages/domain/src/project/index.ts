import { type Activity, type Project } from "@pm/types";

/** Spec §10.10: Progress = completed hours / total estimated hours. */
export function calcProjectProgress(activities: Activity[]): number {
  const totalMinutes = activities.reduce((s, a) => s + a.estimated_minutes, 0);
  if (totalMinutes === 0) return 0;

  const completedMinutes = activities
    .filter((a) => a.status === "completed")
    .reduce((s, a) => s + a.estimated_minutes, 0);

  return Math.round((completedMinutes / totalMinutes) * 100);
}

/** Returns project metrics summary for display in project cards. */
export function getProjectMetrics(activities: Activity[]): {
  totalTasks: number;
  completedTasks: number;
  totalEstimatedHours: number;
  completedHours: number;
  progressPercent: number;
} {
  const totalTasks = activities.length;
  const completedTasks = activities.filter((a) => a.status === "completed").length;
  const totalEstimatedHours = activities.reduce((s, a) => s + a.estimated_minutes, 0) / 60;
  const completedHours =
    activities
      .filter((a) => a.status === "completed")
      .reduce((s, a) => s + a.estimated_minutes, 0) / 60;

  return {
    totalTasks,
    completedTasks,
    totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
    completedHours: Math.round(completedHours * 10) / 10,
    progressPercent: calcProjectProgress(activities),
  };
}

/** Spec §10.10: Risk flags — overdue or no progress. */
export function isProjectAtRisk(project: Project, activities: Activity[]): boolean {
  const overdue =
    project.target_end_date != null &&
    new Date(project.target_end_date) < new Date() &&
    project.status !== "completed";

  // Only flag "no progress" if the project actually has tasks — a brand-new
  // in_progress project with no linked activities should not be considered at risk.
  const noProgress =
    project.status === "in_progress" &&
    activities.length > 0 &&
    calcProjectProgress(activities) === 0;

  return overdue || noProgress;
}
