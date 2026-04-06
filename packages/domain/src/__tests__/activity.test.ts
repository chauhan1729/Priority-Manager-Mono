import { describe, expect, it } from "vitest";

import { type Activity } from "@pm/types";

import {
  MAX_A_PRIORITY_PER_DAY,
  DAILY_CAPACITY_MINUTES,
  canAddAPriority,
  countAPriorities,
  exceedsDailyCapacity,
  getCarryForwardEligible,
  groupActivitiesBySection,
  totalEstimatedMinutes,
} from "../activity";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    section_type: "work",
    title: "Test activity",
    priority: null,
    activity_date: "2026-04-05",
    estimated_minutes: 60,
    remaining_minutes: 60,
    status: "not_started",
    linked_project_id: "proj-1",
    delegated_contact_id: null,
    note: null,
    origin_type: "manual",
    moved_from_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe("A-priority cap (spec §10.5)", () => {
  it("allows adding when fewer than 3 A-priorities exist", () => {
    const activities = [
      makeActivity({ priority: "A" }),
      makeActivity({ priority: "A" }),
    ];
    expect(canAddAPriority(activities)).toBe(true);
  });

  it("blocks adding when exactly 3 A-priorities exist", () => {
    const activities = [
      makeActivity({ priority: "A" }),
      makeActivity({ priority: "A" }),
      makeActivity({ priority: "A" }),
    ];
    expect(canAddAPriority(activities)).toBe(false);
  });

  it("counts only A priorities, not B or null", () => {
    const activities = [
      makeActivity({ priority: "A" }),
      makeActivity({ priority: "B" }),
      makeActivity({ priority: null }),
    ];
    expect(countAPriorities(activities)).toBe(1);
  });

  it("MAX_A_PRIORITY_PER_DAY is 3", () => {
    expect(MAX_A_PRIORITY_PER_DAY).toBe(3);
  });
});

// ---------------------------------------------------------------------------
describe("daily capacity warning", () => {
  it("returns false when total is under 8 hours", () => {
    const activities = [
      makeActivity({ estimated_minutes: 120 }),
      makeActivity({ estimated_minutes: 120 }),
      makeActivity({ estimated_minutes: 120 }),
    ];
    expect(exceedsDailyCapacity(activities)).toBe(false);
  });

  it("returns true when total exceeds 8 hours", () => {
    const activities = [
      makeActivity({ estimated_minutes: 300 }),
      makeActivity({ estimated_minutes: 200 }),
    ];
    // 500 min > 480 (8h)
    expect(exceedsDailyCapacity(activities)).toBe(true);
  });

  it("returns false for exactly 8 hours", () => {
    const activities = [makeActivity({ estimated_minutes: DAILY_CAPACITY_MINUTES })];
    expect(exceedsDailyCapacity(activities)).toBe(false);
  });

  it("totalEstimatedMinutes sums correctly", () => {
    const activities = [
      makeActivity({ estimated_minutes: 30 }),
      makeActivity({ estimated_minutes: 90 }),
    ];
    expect(totalEstimatedMinutes(activities)).toBe(120);
  });
});

// ---------------------------------------------------------------------------
describe("carry-forward eligible", () => {
  it("includes not_started activities", () => {
    const a = makeActivity({ status: "not_started" });
    expect(getCarryForwardEligible([a])).toContain(a);
  });

  it("includes postponed activities", () => {
    const a = makeActivity({ status: "postponed" });
    expect(getCarryForwardEligible([a])).toContain(a);
  });

  it("excludes completed activities", () => {
    const a = makeActivity({ status: "completed" });
    expect(getCarryForwardEligible([a])).not.toContain(a);
  });

  it("excludes cancelled activities", () => {
    const a = makeActivity({ status: "cancelled" });
    expect(getCarryForwardEligible([a])).not.toContain(a);
  });

  it("excludes working activities", () => {
    const a = makeActivity({ status: "working" });
    expect(getCarryForwardEligible([a])).not.toContain(a);
  });
});

// ---------------------------------------------------------------------------
describe("groupActivitiesBySection", () => {
  it("groups activities into the correct sections", () => {
    const work = makeActivity({ section_type: "work", linked_project_id: "p1" });
    const outside = makeActivity({ section_type: "outside", linked_project_id: null });
    const unplanned = makeActivity({ section_type: "unplanned", linked_project_id: null });
    const result = groupActivitiesBySection([work, outside, unplanned]);
    expect(result.work).toContain(work);
    expect(result.outside).toContain(outside);
    expect(result.unplanned).toContain(unplanned);
    expect(result.delegated).toHaveLength(0);
  });

  it("returns empty arrays for sections with no activities", () => {
    const result = groupActivitiesBySection([]);
    expect(result.work).toHaveLength(0);
    expect(result.outside).toHaveLength(0);
    expect(result.delegated).toHaveLength(0);
    expect(result.unplanned).toHaveLength(0);
  });

  it("places multiple activities in the same section correctly", () => {
    const a1 = makeActivity({ section_type: "work", linked_project_id: "p1" });
    const a2 = makeActivity({ section_type: "work", linked_project_id: "p1" });
    const result = groupActivitiesBySection([a1, a2]);
    expect(result.work).toHaveLength(2);
  });

  it("handles mixed sections without cross-contamination", () => {
    const work = makeActivity({ section_type: "work", linked_project_id: "p1" });
    const outside = makeActivity({ section_type: "outside", linked_project_id: null });
    const result = groupActivitiesBySection([work, outside]);
    expect(result.work).not.toContain(outside);
    expect(result.outside).not.toContain(work);
  });
});
