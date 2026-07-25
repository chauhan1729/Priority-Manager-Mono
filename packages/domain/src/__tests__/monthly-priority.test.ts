import { describe, expect, it } from "vitest";

import type { MonthlyPriority, MonthlyPrioritySection } from "@pm/types";

import {
  canAddPriority,
  countBySection,
  formatMonthLabel,
  getEffectiveProgress,
  getCurrentMonthKey,
  getNextMonthKey,
  getPrevMonthKey,
  groupBySection,
  isActivePriority,
  isArchivedPriority,
  isEligibleForCarryForward,
  isStale,
  isValidManualProgress,
  isValidMonthKey,
  isValidSection,
  isValidStatus,
  MAX_PRIORITIES_PER_SECTION,
  MIN_PRIORITIES_PER_SECTION,
  MP_SECTIONS,
  MP_STATUSES,
  SECTION_LABELS,
  STATUS_LABELS,
} from "../monthly-priority";

// ---------------------------------------------------------------------------
// Test factory
// ---------------------------------------------------------------------------

function makePriority(overrides: Partial<MonthlyPriority> = {}): MonthlyPriority {
  return {
    id: "mp-1",
    user_id: "user-1",
    section: "business_career",
    title: "Ship v2 launch",
    category: null,
    started_date: null,
    assigned_date: null,
    target_date: null,
    linked_annual_goal_id: null,
    linked_project_id: null,
    progress_mode: "manual",
    manual_progress_percent: 0,
    status: "planned",
    note: null,
    pinned: false,
    month_key: "2026-04",
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Section constraint
// ---------------------------------------------------------------------------

describe("section constraint", () => {
  it("MP_SECTIONS has exactly 2 entries", () => {
    expect(MP_SECTIONS).toHaveLength(2);
  });

  it("sections are business_career and personal", () => {
    expect(MP_SECTIONS).toContain("business_career");
    expect(MP_SECTIONS).toContain("personal");
  });

  it("isValidSection accepts valid sections", () => {
    expect(isValidSection("business_career")).toBe(true);
    expect(isValidSection("personal")).toBe(true);
  });

  it("isValidSection rejects invalid sections", () => {
    expect(isValidSection("business")).toBe(false);
    expect(isValidSection("career")).toBe(false);
    expect(isValidSection("work")).toBe(false);
    expect(isValidSection("")).toBe(false);
  });

  it("SECTION_LABELS covers all sections", () => {
    for (const s of MP_SECTIONS) {
      expect(SECTION_LABELS[s]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

describe("status helpers", () => {
  it("MP_STATUSES has exactly 5 entries", () => {
    expect(MP_STATUSES).toHaveLength(5);
  });

  it("isValidStatus accepts all valid statuses", () => {
    for (const s of MP_STATUSES) {
      expect(isValidStatus(s)).toBe(true);
    }
  });

  it("isValidStatus rejects invalid statuses", () => {
    expect(isValidStatus("not_started")).toBe(false);
    expect(isValidStatus("active")).toBe(false);
    expect(isValidStatus("")).toBe(false);
  });

  it("STATUS_LABELS covers all statuses", () => {
    for (const s of MP_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 3 priority per section rule
// ---------------------------------------------------------------------------

describe("section limit: 3 per section per month", () => {
  it("MAX_PRIORITIES_PER_SECTION is 3", () => {
    expect(MAX_PRIORITIES_PER_SECTION).toBe(3);
  });

  it("MIN_PRIORITIES_PER_SECTION is 3", () => {
    expect(MIN_PRIORITIES_PER_SECTION).toBe(3);
  });

  it("canAddPriority returns true when section has fewer than 3", () => {
    const priorities = [
      makePriority({ section: "business_career", month_key: "2026-04" }),
      makePriority({ section: "business_career", month_key: "2026-04" }),
    ];
    expect(canAddPriority(priorities, "business_career", "2026-04")).toBe(true);
  });

  it("canAddPriority returns false when section has exactly 3", () => {
    const priorities = Array.from({ length: 3 }, () =>
      makePriority({ section: "business_career", month_key: "2026-04" }),
    );
    expect(canAddPriority(priorities, "business_career", "2026-04")).toBe(false);
  });

  it("canAddPriority counts only the matching section", () => {
    const priorities = [
      makePriority({ section: "personal", month_key: "2026-04" }),
      makePriority({ section: "personal", month_key: "2026-04" }),
      makePriority({ section: "personal", month_key: "2026-04" }),
      makePriority({ section: "personal", month_key: "2026-04" }),
      makePriority({ section: "personal", month_key: "2026-04" }),
    ];
    expect(canAddPriority(priorities, "business_career", "2026-04")).toBe(true);
  });

  it("canAddPriority counts only the matching month_key", () => {
    const priorities = [
      makePriority({ section: "business_career", month_key: "2026-03" }),
      makePriority({ section: "business_career", month_key: "2026-03" }),
      makePriority({ section: "business_career", month_key: "2026-03" }),
      makePriority({ section: "business_career", month_key: "2026-03" }),
      makePriority({ section: "business_career", month_key: "2026-03" }),
    ];
    expect(canAddPriority(priorities, "business_career", "2026-04")).toBe(true);
  });

  it("countBySection counts correctly", () => {
    const priorities: MonthlyPriority[] = [
      makePriority({ section: "business_career", month_key: "2026-04" }),
      makePriority({ section: "business_career", month_key: "2026-04" }),
      makePriority({ section: "personal", month_key: "2026-04" }),
    ];
    expect(countBySection(priorities, "business_career", "2026-04")).toBe(2);
    expect(countBySection(priorities, "personal", "2026-04")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Archive behavior
// ---------------------------------------------------------------------------

describe("archive behavior", () => {
  it("completed is archived", () => {
    expect(isArchivedPriority(makePriority({ status: "completed" }))).toBe(true);
  });

  it("dropped is archived", () => {
    expect(isArchivedPriority(makePriority({ status: "dropped" }))).toBe(true);
  });

  it("planned, in_progress, on_hold are not archived", () => {
    expect(isArchivedPriority(makePriority({ status: "planned" }))).toBe(false);
    expect(isArchivedPriority(makePriority({ status: "in_progress" }))).toBe(false);
    expect(isArchivedPriority(makePriority({ status: "on_hold" }))).toBe(false);
  });

  it("isActivePriority is the inverse of isArchivedPriority", () => {
    const p = makePriority({ status: "in_progress" });
    expect(isActivePriority(p)).toBe(!isArchivedPriority(p));
  });
});

// ---------------------------------------------------------------------------
// Annual goal linkage
// ---------------------------------------------------------------------------

describe("annual goal linkage", () => {
  it("MonthlyPriority has linked_annual_goal_id field", () => {
    const p = makePriority({ linked_annual_goal_id: "ag-1" });
    expect(p.linked_annual_goal_id).toBe("ag-1");
  });

  it("linked_annual_goal_id can be null", () => {
    const p = makePriority({ linked_annual_goal_id: null });
    expect(p.linked_annual_goal_id).toBeNull();
  });

  it("MonthlyPriority does not own an activities array", () => {
    const p = makePriority();
    expect("activities" in p).toBe(false);
    expect("activity_ids" in p).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Project linkage
// ---------------------------------------------------------------------------

describe("project linkage", () => {
  it("MonthlyPriority has linked_project_id field", () => {
    const p = makePriority({ linked_project_id: "proj-1" });
    expect(p.linked_project_id).toBe("proj-1");
  });

  it("linked_project_id can be null", () => {
    const p = makePriority({ linked_project_id: null });
    expect(p.linked_project_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Manual vs auto progress behavior
// ---------------------------------------------------------------------------

describe("manual vs auto progress", () => {
  it("getEffectiveProgress uses manual_progress_percent in manual mode", () => {
    const p = makePriority({ progress_mode: "manual", manual_progress_percent: 42 });
    expect(getEffectiveProgress(p, null)).toBe(42);
  });

  it("getEffectiveProgress defaults to 0 when manual_progress_percent is null", () => {
    const p = makePriority({ progress_mode: "manual", manual_progress_percent: null });
    expect(getEffectiveProgress(p, null)).toBe(0);
  });

  it("getEffectiveProgress uses projectProgressPercent in auto_project mode", () => {
    const p = makePriority({
      progress_mode: "auto_project",
      linked_project_id: "proj-1",
      manual_progress_percent: 10,
    });
    expect(getEffectiveProgress(p, 75)).toBe(75);
  });

  it("getEffectiveProgress falls back to manual when auto_project but projectProgressPercent is null", () => {
    const p = makePriority({
      progress_mode: "auto_project",
      linked_project_id: "proj-1",
      manual_progress_percent: 30,
    });
    expect(getEffectiveProgress(p, null)).toBe(30);
  });

  it("isValidManualProgress accepts 0–100 integers", () => {
    expect(isValidManualProgress(0)).toBe(true);
    expect(isValidManualProgress(50)).toBe(true);
    expect(isValidManualProgress(100)).toBe(true);
  });

  it("isValidManualProgress rejects out-of-range values", () => {
    expect(isValidManualProgress(-1)).toBe(false);
    expect(isValidManualProgress(101)).toBe(false);
  });

  it("isValidManualProgress rejects non-integers", () => {
    expect(isValidManualProgress(50.5)).toBe(false);
    expect(isValidManualProgress(NaN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Carry-forward rules
// ---------------------------------------------------------------------------

describe("carry-forward rules", () => {
  it("isEligibleForCarryForward returns true when not archived and has linked project", () => {
    const p = makePriority({ status: "in_progress", linked_project_id: "proj-1" });
    expect(isEligibleForCarryForward(p)).toBe(true);
  });

  it("isEligibleForCarryForward returns false when completed", () => {
    const p = makePriority({ status: "completed", linked_project_id: "proj-1" });
    expect(isEligibleForCarryForward(p)).toBe(false);
  });

  it("isEligibleForCarryForward returns false when dropped", () => {
    const p = makePriority({ status: "dropped", linked_project_id: "proj-1" });
    expect(isEligibleForCarryForward(p)).toBe(false);
  });

  it("isEligibleForCarryForward returns false when no linked project", () => {
    const p = makePriority({ status: "in_progress", linked_project_id: null });
    expect(isEligibleForCarryForward(p)).toBe(false);
  });

  it("carry-forward creates correct next month key", () => {
    expect(getNextMonthKey("2026-04")).toBe("2026-05");
    expect(getNextMonthKey("2026-12")).toBe("2027-01");
    expect(getNextMonthKey("2025-12")).toBe("2026-01");
  });

  it("carry-forward preserves linkage fields in new record", () => {
    const p = makePriority({
      status: "in_progress",
      linked_annual_goal_id: "ag-1",
      linked_project_id: "proj-1",
      month_key: "2026-04",
    });
    // Simulate what carryForwardPriority server action does
    const carried = {
      ...p,
      id: "new-id",
      month_key: getNextMonthKey(p.month_key),
      status: "planned" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(carried.month_key).toBe("2026-05");
    expect(carried.linked_annual_goal_id).toBe("ag-1");
    expect(carried.linked_project_id).toBe("proj-1");
    expect(carried.status).toBe("planned");
    // Historical record unchanged
    expect(p.month_key).toBe("2026-04");
    expect(p.status).toBe("in_progress");
  });
});

// ---------------------------------------------------------------------------
// Month key helpers
// ---------------------------------------------------------------------------

describe("month key helpers", () => {
  it("getCurrentMonthKey returns YYYY-MM format", () => {
    expect(isValidMonthKey(getCurrentMonthKey())).toBe(true);
  });

  it("getNextMonthKey increments month correctly", () => {
    expect(getNextMonthKey("2026-01")).toBe("2026-02");
    expect(getNextMonthKey("2026-11")).toBe("2026-12");
  });

  it("getNextMonthKey rolls over year at December", () => {
    expect(getNextMonthKey("2026-12")).toBe("2027-01");
  });

  it("getPrevMonthKey decrements month correctly", () => {
    expect(getPrevMonthKey("2026-05")).toBe("2026-04");
    expect(getPrevMonthKey("2026-02")).toBe("2026-01");
  });

  it("getPrevMonthKey rolls back year at January", () => {
    expect(getPrevMonthKey("2026-01")).toBe("2025-12");
  });

  it("isValidMonthKey accepts valid format", () => {
    expect(isValidMonthKey("2026-04")).toBe(true);
    expect(isValidMonthKey("2026-12")).toBe(true);
    expect(isValidMonthKey("2000-01")).toBe(true);
  });

  it("isValidMonthKey rejects invalid format", () => {
    expect(isValidMonthKey("2026-4")).toBe(false);
    expect(isValidMonthKey("26-04")).toBe(false);
    expect(isValidMonthKey("2026/04")).toBe(false);
    expect(isValidMonthKey("April 2026")).toBe(false);
    expect(isValidMonthKey("")).toBe(false);
  });

  it("formatMonthLabel returns human-readable string", () => {
    const label = formatMonthLabel("2026-04");
    expect(label).toContain("2026");
    expect(label.toLowerCase()).toContain("april");
  });
});

// ---------------------------------------------------------------------------
// Section grouping
// ---------------------------------------------------------------------------

describe("groupBySection", () => {
  it("groups priorities by section", () => {
    const priorities: MonthlyPriority[] = [
      makePriority({ section: "business_career" }),
      makePriority({ section: "business_career" }),
      makePriority({ section: "personal" }),
    ];
    const grouped = groupBySection(priorities);
    expect(grouped.business_career).toHaveLength(2);
    expect(grouped.personal).toHaveLength(1);
  });

  it("returns empty arrays for sections with no priorities", () => {
    const grouped = groupBySection([]);
    expect(grouped.business_career).toHaveLength(0);
    expect(grouped.personal).toHaveLength(0);
  });

  it("groupBySection covers all sections defined in MP_SECTIONS", () => {
    const grouped = groupBySection([]);
    for (const s of MP_SECTIONS) {
      expect(s in grouped).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Stale indicator
// ---------------------------------------------------------------------------

describe("stale indicator", () => {
  it("not stale when updated recently", () => {
    const p = makePriority({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    });
    expect(isStale(p)).toBe(false);
  });

  it("stale when in_progress and not updated for > 7 days", () => {
    const p = makePriority({
      status: "in_progress",
      updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isStale(p)).toBe(true);
  });

  it("not stale when planned (not yet started)", () => {
    const p = makePriority({
      status: "planned",
      updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isStale(p)).toBe(false);
  });

  it("not stale when completed", () => {
    const p = makePriority({
      status: "completed",
      updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isStale(p)).toBe(false);
  });

  it("not stale when dropped", () => {
    const p = makePriority({
      status: "dropped",
      updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isStale(p)).toBe(false);
  });

  it("respects custom threshold", () => {
    const p = makePriority({
      status: "in_progress",
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isStale(p, 7)).toBe(false);
    expect(isStale(p, 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Architecture guard: no direct activity ownership
// ---------------------------------------------------------------------------

describe("architecture guard", () => {
  it("MonthlyPriority has no activities field", () => {
    const p = makePriority();
    expect("activities" in p).toBe(false);
  });

  it("MonthlyPriority has no activity_ids field", () => {
    const p = makePriority();
    expect("activity_ids" in p).toBe(false);
  });

  it("section is fixed in type — only valid sections allowed", () => {
    const p = makePriority({ section: "personal" });
    expect(p.section).toBe("personal");
    const validSections: MonthlyPrioritySection[] = ["business_career", "personal"];
    expect(validSections).toContain(p.section);
  });
});
