import { describe, expect, it } from "vitest";

import { type Activity, type Project } from "@pm/types";

import { calcProjectProgress, getProjectMetrics, isProjectAtRisk } from "../project";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    section_type: "work",
    title: "Task",
    priority: null,
    activity_date: "2026-04-05",
    estimated_minutes: 60,
    remaining_minutes: 60,
    status: "not_started",
    linked_project_id: "proj-1",
    delegated_contact_id: null,
    note: null,
    origin_type: "project",
    moved_from_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    user_id: "user-1",
    name: "My Project",
    description: null,
    status: "in_progress",
    start_date: "2026-04-01",
    target_end_date: "2026-06-30",
    linked_annual_goal_id: null,
    linked_monthly_priority_id: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe("calcProjectProgress (spec §10.10: completed hours / total hours)", () => {
  it("returns 0 when no activities", () => {
    expect(calcProjectProgress([])).toBe(0);
  });

  it("returns 0 when no activities are completed", () => {
    const activities = [
      makeActivity({ status: "not_started", estimated_minutes: 120 }),
      makeActivity({ status: "working", estimated_minutes: 60 }),
    ];
    expect(calcProjectProgress(activities)).toBe(0);
  });

  it("returns 100 when all activities are completed", () => {
    const activities = [
      makeActivity({ status: "completed", estimated_minutes: 60 }),
      makeActivity({ status: "completed", estimated_minutes: 120 }),
    ];
    expect(calcProjectProgress(activities)).toBe(100);
  });

  it("returns 50 when half the hours are complete", () => {
    const activities = [
      makeActivity({ status: "completed", estimated_minutes: 60 }),
      makeActivity({ status: "not_started", estimated_minutes: 60 }),
    ];
    expect(calcProjectProgress(activities)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    const activities = [
      makeActivity({ status: "completed", estimated_minutes: 100 }),
      makeActivity({ status: "not_started", estimated_minutes: 200 }),
    ];
    // 100/300 = 33.33% → rounds to 33
    expect(calcProjectProgress(activities)).toBe(33);
  });
});

// ---------------------------------------------------------------------------
describe("getProjectMetrics", () => {
  it("returns correct totalTasks and completedTasks", () => {
    const activities = [
      makeActivity({ status: "completed" }),
      makeActivity({ status: "not_started" }),
      makeActivity({ status: "working" }),
    ];
    const metrics = getProjectMetrics(activities);
    expect(metrics.totalTasks).toBe(3);
    expect(metrics.completedTasks).toBe(1);
  });

  it("converts minutes to hours correctly", () => {
    const activities = [
      makeActivity({ status: "completed", estimated_minutes: 90 }),
      makeActivity({ status: "not_started", estimated_minutes: 30 }),
    ];
    const metrics = getProjectMetrics(activities);
    expect(metrics.totalEstimatedHours).toBe(2);
    expect(metrics.completedHours).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
describe("isProjectAtRisk", () => {
  it("flags overdue projects (past target date, not completed)", () => {
    const project = makeProject({ target_end_date: "2026-01-01", status: "in_progress" });
    const activities = [makeActivity({ status: "not_started" })];
    expect(isProjectAtRisk(project, activities)).toBe(true);
  });

  it("does not flag completed projects even if past target date", () => {
    const project = makeProject({ target_end_date: "2026-01-01", status: "completed" });
    expect(isProjectAtRisk(project, [])).toBe(false);
  });

  it("flags in-progress projects with 0% progress", () => {
    const project = makeProject({ status: "in_progress", target_end_date: "2026-12-31" });
    const activities = [makeActivity({ status: "not_started" })];
    expect(isProjectAtRisk(project, activities)).toBe(true);
  });

  it("does not flag a project with progress and future target date", () => {
    const project = makeProject({ status: "in_progress", target_end_date: "2026-12-31" });
    const activities = [
      makeActivity({ status: "completed", estimated_minutes: 60 }),
      makeActivity({ status: "not_started", estimated_minutes: 60 }),
    ];
    expect(isProjectAtRisk(project, activities)).toBe(false);
  });

  it("does not flag planned projects with no progress (not started yet)", () => {
    const project = makeProject({ status: "planned", target_end_date: "2026-12-31" });
    expect(isProjectAtRisk(project, [])).toBe(false);
  });
});
