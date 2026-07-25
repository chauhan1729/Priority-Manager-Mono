import { describe, expect, it } from "vitest";

import type { AnnualGoal, AnnualGoalSection, AnnualGoalStatus } from "@pm/types";

import {
  ANNUAL_GOAL_SECTIONS,
  ANNUAL_GOAL_STATUSES,
  canAddGoal,
  canLinkProject,
  countActiveInSection,
  filterActive,
  filterArchived,
  groupGoalsBySection,
  isActiveGoal,
  isArchivedGoal,
  isValidProgress,
  isValidSection,
  isValidStatus,
  MAX_GOALS_PER_SECTION,
  SECTION_LABELS,
  STATUS_LABELS,
} from "../annual-goal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGoal(overrides: Partial<AnnualGoal> = {}): AnnualGoal {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    section: "business",
    title: "Grow revenue by 30%",
    description: "Focus on existing clients and two new verticals.",
    why_it_matters: "Reaches financial independence milestone.",
    target_date: "2026-12-31",
    progress_percent: 0,
    status: "not_started",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Section constraint
// ---------------------------------------------------------------------------

describe("section constraint", () => {
  it("allows exactly 3 sections", () => {
    expect(ANNUAL_GOAL_SECTIONS).toHaveLength(3);
    expect(ANNUAL_GOAL_SECTIONS).toContain("business");
    expect(ANNUAL_GOAL_SECTIONS).toContain("career");
    expect(ANNUAL_GOAL_SECTIONS).toContain("personal");
  });

  it("SECTION_LABELS covers all 3 sections", () => {
    expect(Object.keys(SECTION_LABELS)).toHaveLength(3);
    expect(SECTION_LABELS.business).toBe("Business");
    expect(SECTION_LABELS.career).toBe("Career");
    expect(SECTION_LABELS.personal).toBe("Personal");
  });

  it.each(["business", "career", "personal"] as AnnualGoalSection[])(
    "isValidSection returns true for %s",
    (section) => {
      expect(isValidSection(section)).toBe(true);
    },
  );

  it("isValidSection rejects invalid values", () => {
    expect(isValidSection("work")).toBe(false);
    expect(isValidSection("annual")).toBe(false);
    expect(isValidSection("")).toBe(false);
    expect(isValidSection("Business")).toBe(false); // case-sensitive
  });
});

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

describe("status helpers", () => {
  it("allows exactly 6 statuses", () => {
    expect(ANNUAL_GOAL_STATUSES).toHaveLength(6);
  });

  it.each([
    "not_started",
    "active",
    "on_track",
    "at_risk",
    "completed",
    "dropped",
  ] as AnnualGoalStatus[])(
    "isValidStatus returns true for %s",
    (status) => {
      expect(isValidStatus(status)).toBe(true);
    },
  );

  it("isValidStatus rejects invalid values", () => {
    expect(isValidStatus("done")).toBe(false);
    expect(isValidStatus("Active")).toBe(false);
    expect(isValidStatus("")).toBe(false);
  });

  it("STATUS_LABELS covers all statuses", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(6);
    expect(STATUS_LABELS.not_started).toBe("Not Started");
    expect(STATUS_LABELS.on_track).toBe("On Track");
    expect(STATUS_LABELS.at_risk).toBe("At Risk");
    expect(STATUS_LABELS.completed).toBe("Completed");
    expect(STATUS_LABELS.dropped).toBe("Dropped");
  });
});

// ---------------------------------------------------------------------------
// Archive behavior
// ---------------------------------------------------------------------------

describe("archive behavior", () => {
  it("isArchivedGoal is true only for completed and dropped", () => {
    expect(isArchivedGoal(makeGoal({ status: "completed" }))).toBe(true);
    expect(isArchivedGoal(makeGoal({ status: "dropped" }))).toBe(true);
  });

  it.each(["not_started", "active", "on_track", "at_risk"] as AnnualGoalStatus[])(
    "isArchivedGoal is false for %s",
    (status) => {
      expect(isArchivedGoal(makeGoal({ status }))).toBe(false);
    },
  );

  it("isActiveGoal is the inverse of isArchivedGoal", () => {
    const active = makeGoal({ status: "active" });
    const done = makeGoal({ status: "completed" });
    expect(isActiveGoal(active)).toBe(true);
    expect(isActiveGoal(done)).toBe(false);
  });

  it("filterActive excludes completed and dropped", () => {
    const goals = [
      makeGoal({ status: "active" }),
      makeGoal({ status: "completed" }),
      makeGoal({ status: "dropped" }),
      makeGoal({ status: "on_track" }),
    ];
    const active = filterActive(goals);
    expect(active).toHaveLength(2);
    expect(active.every((g) => g.status !== "completed" && g.status !== "dropped")).toBe(true);
  });

  it("filterArchived returns only completed and dropped", () => {
    const goals = [
      makeGoal({ status: "not_started" }),
      makeGoal({ status: "completed" }),
      makeGoal({ status: "dropped" }),
    ];
    const archived = filterArchived(goals);
    expect(archived).toHaveLength(2);
    expect(archived.every((g) => g.status === "completed" || g.status === "dropped")).toBe(true);
  });

  it("filterActive and filterArchived together cover all goals", () => {
    const goals = [
      makeGoal({ status: "not_started" }),
      makeGoal({ status: "active" }),
      makeGoal({ status: "on_track" }),
      makeGoal({ status: "at_risk" }),
      makeGoal({ status: "completed" }),
      makeGoal({ status: "dropped" }),
    ];
    expect(filterActive(goals).length + filterArchived(goals).length).toBe(goals.length);
  });
});

// ---------------------------------------------------------------------------
// Section capacity (max 3 active per section)
// ---------------------------------------------------------------------------

describe("section capacity: max 3 active per section", () => {
  it("MAX_GOALS_PER_SECTION is 3", () => {
    expect(MAX_GOALS_PER_SECTION).toBe(3);
  });

  it("countActiveInSection counts only active goals in the section", () => {
    const goals = [
      makeGoal({ section: "business", status: "active" }),
      makeGoal({ section: "business", status: "completed" }), // archived — not counted
      makeGoal({ section: "business", status: "on_track" }),
      makeGoal({ section: "career", status: "active" }), // other section
    ];
    expect(countActiveInSection(goals, "business")).toBe(2);
  });

  it("canAddGoal is true when the section has fewer than 3 active", () => {
    const goals = [
      makeGoal({ section: "personal", status: "active" }),
      makeGoal({ section: "personal", status: "on_track" }),
    ];
    expect(canAddGoal(goals, "personal")).toBe(true);
  });

  it("canAddGoal is false when the section has exactly 3 active", () => {
    const goals = Array.from({ length: 3 }, () =>
      makeGoal({ section: "personal", status: "active" }),
    );
    expect(canAddGoal(goals, "personal")).toBe(false);
  });

  it("archived goals do not count toward the cap", () => {
    const goals = [
      makeGoal({ section: "career", status: "active" }),
      makeGoal({ section: "career", status: "completed" }),
      makeGoal({ section: "career", status: "dropped" }),
      makeGoal({ section: "career", status: "on_track" }),
    ];
    // Only 2 active → can still add.
    expect(canAddGoal(goals, "career")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Project linkage
// ---------------------------------------------------------------------------

describe("project linkage", () => {
  it("canLinkProject returns true for active goals", () => {
    expect(canLinkProject(makeGoal({ status: "active" }))).toBe(true);
    expect(canLinkProject(makeGoal({ status: "not_started" }))).toBe(true);
    expect(canLinkProject(makeGoal({ status: "on_track" }))).toBe(true);
    expect(canLinkProject(makeGoal({ status: "at_risk" }))).toBe(true);
  });

  it("canLinkProject returns false for completed goals", () => {
    expect(canLinkProject(makeGoal({ status: "completed" }))).toBe(false);
  });

  it("canLinkProject returns false for dropped goals", () => {
    expect(canLinkProject(makeGoal({ status: "dropped" }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Manual progress behavior
// ---------------------------------------------------------------------------

describe("manual progress behavior", () => {
  it("isValidProgress accepts 0", () => {
    expect(isValidProgress(0)).toBe(true);
  });

  it("isValidProgress accepts 100", () => {
    expect(isValidProgress(100)).toBe(true);
  });

  it("isValidProgress accepts integers in range", () => {
    expect(isValidProgress(50)).toBe(true);
    expect(isValidProgress(1)).toBe(true);
    expect(isValidProgress(99)).toBe(true);
  });

  it("isValidProgress rejects values above 100", () => {
    expect(isValidProgress(101)).toBe(false);
    expect(isValidProgress(200)).toBe(false);
  });

  it("isValidProgress rejects negative values", () => {
    expect(isValidProgress(-1)).toBe(false);
  });

  it("isValidProgress rejects non-integers", () => {
    expect(isValidProgress(50.5)).toBe(false);
    expect(isValidProgress(0.1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Section grouping
// ---------------------------------------------------------------------------

describe("groupGoalsBySection", () => {
  it("produces exactly 3 section keys", () => {
    const result = groupGoalsBySection([]);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result.business).toEqual([]);
    expect(result.career).toEqual([]);
    expect(result.personal).toEqual([]);
  });

  it("routes goals to correct sections", () => {
    const g1 = makeGoal({ section: "business" });
    const g2 = makeGoal({ section: "career" });
    const g3 = makeGoal({ section: "personal" });
    const g4 = makeGoal({ section: "business" });

    const result = groupGoalsBySection([g1, g2, g3, g4]);
    expect(result.business).toEqual([g1, g4]);
    expect(result.career).toEqual([g2]);
    expect(result.personal).toEqual([g3]);
  });

  it("preserves insertion order within each section", () => {
    const goals = [
      makeGoal({ section: "personal", title: "First" }),
      makeGoal({ section: "personal", title: "Second" }),
      makeGoal({ section: "personal", title: "Third" }),
    ];
    const result = groupGoalsBySection(goals);
    expect(result.personal.map((g) => g.title)).toEqual(["First", "Second", "Third"]);
  });

  it("total items across sections equals input length", () => {
    const goals = Array.from({ length: 9 }, (_, i) =>
      makeGoal({
        section: (["business", "career", "personal"] as AnnualGoalSection[])[i % 3]!,
      }),
    );
    const result = groupGoalsBySection(goals);
    const total = result.business.length + result.career.length + result.personal.length;
    expect(total).toBe(goals.length);
  });
});

// ---------------------------------------------------------------------------
// No direct Activity ownership (architecture guard test)
// ---------------------------------------------------------------------------

describe("no direct activity ownership", () => {
  it("AnnualGoal type has no activities array field", () => {
    const goal = makeGoal();
    // AnnualGoal must not contain a direct activities list — activities live under Projects
    expect("activities" in goal).toBe(false);
    expect("activity_ids" in goal).toBe(false);
  });

  it("AnnualGoal type has no section_type field (that belongs to Activity)", () => {
    const goal = makeGoal();
    expect("section_type" in goal).toBe(false);
  });
});
