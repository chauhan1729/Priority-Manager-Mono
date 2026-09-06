import { describe, expect, it } from "vitest";

import { type Activity } from "@pm/types";

import {
  MAX_A_PRIORITY_PER_DAY,
  DAILY_CAPACITY_MINUTES,
  HORIZON_DAYS,
  aPriorityWarningLevel,
  buildActivityMove,
  canAddAPriority,
  canPromoteForScheduling,
  canRedateTo,
  canScheduleActivity,
  countAPriorities,
  demoteToB,
  exceedsDailyCapacity,
  getCarryForwardEligible,
  getSomedayReviewDue,
  groupActivitiesByPriority,
  groupActivitiesBySection,
  isPendingActivity,
  isWithinHorizon,
  partitionByHorizon,
  promoteToA,
  suggestRedate,
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
    priority: "B",
    activity_date: "2026-04-05",
    estimated_minutes: 60,
    remaining_minutes: 60,
    status: "not_started",
    linked_project_id: "proj-1",
    delegated_contact_id: null,
    note: null,
    origin_type: "manual",
    moved_from_date: null,
    hours_worked: 0,
    archived: false,
    is_someday: false,
    is_weekly: false,
    recurrence_rule: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe("isPendingActivity (overdue backlog)", () => {
  const today = "2026-04-05";

  it("is true for an overdue, open activity", () => {
    expect(isPendingActivity(makeActivity({ activity_date: "2026-04-03", status: "not_started" }), today)).toBe(true);
    expect(isPendingActivity(makeActivity({ activity_date: "2026-04-04", status: "working" }), today)).toBe(true);
    expect(isPendingActivity(makeActivity({ activity_date: "2026-04-01", status: "postponed" }), today)).toBe(true);
  });

  it("is false for today or future activities", () => {
    expect(isPendingActivity(makeActivity({ activity_date: "2026-04-05", status: "not_started" }), today)).toBe(false);
    expect(isPendingActivity(makeActivity({ activity_date: "2026-04-06", status: "not_started" }), today)).toBe(false);
  });

  it.each(["completed", "cancelled"] as const)("is false for a %s activity even if overdue", (status) => {
    expect(isPendingActivity(makeActivity({ activity_date: "2026-04-01", status }), today)).toBe(false);
  });

  it("is false for someday or archived items", () => {
    expect(isPendingActivity(makeActivity({ activity_date: "2026-04-01", is_someday: true }), today)).toBe(false);
    expect(isPendingActivity(makeActivity({ activity_date: "2026-04-01", archived: true }), today)).toBe(false);
  });
});

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

  it("counts only A priorities, not B", () => {
    const activities = [
      makeActivity({ priority: "A" }),
      makeActivity({ priority: "B" }),
      makeActivity({ priority: "B" }),
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

// ---------------------------------------------------------------------------
// Phase 0A — priority-first restructure
// ---------------------------------------------------------------------------
describe("groupActivitiesByPriority (Phase 0A)", () => {
  it("splits activities into the A and B screens", () => {
    const a = makeActivity({ priority: "A" });
    const b = makeActivity({ priority: "B" });
    const result = groupActivitiesByPriority([a, b]);
    expect(result.a).toEqual([a]);
    expect(result.b).toEqual([b]);
  });

  it("defensively treats a runtime-only legacy null as B so every activity has a home", () => {
    // The type now forbids null; this cast simulates a pre-migration row reaching the UI.
    const legacy = makeActivity({ priority: null as unknown as "A" | "B" });
    const result = groupActivitiesByPriority([legacy]);
    expect(result.b).toContain(legacy);
    expect(result.a).toHaveLength(0);
  });
});

describe("aPriorityWarningLevel (Phase 0A soft cap)", () => {
  it("is 'none' for 0 or 1 A's", () => {
    expect(aPriorityWarningLevel(0)).toBe("none");
    expect(aPriorityWarningLevel(1)).toBe("none");
  });

  it("is 'hint' for 2 or 3 A's", () => {
    expect(aPriorityWarningLevel(2)).toBe("hint");
    expect(aPriorityWarningLevel(3)).toBe("hint");
  });

  it("is 'warn' for 4+ A's (override territory)", () => {
    expect(aPriorityWarningLevel(4)).toBe("warn");
    expect(aPriorityWarningLevel(10)).toBe("warn");
  });
});

describe("promoteToA / demoteToB (Phase 0A)", () => {
  it("promoteToA sets priority to A", () => {
    expect(promoteToA(makeActivity({ priority: "B" })).priority).toBe("A");
  });

  it("demoteToB sets priority to B", () => {
    expect(demoteToB(makeActivity({ priority: "A" })).priority).toBe("B");
  });

  it("does not mutate the input", () => {
    const original = makeActivity({ priority: "B" });
    promoteToA(original);
    expect(original.priority).toBe("B");
  });
});

describe("canScheduleActivity (Phase 0A — A only)", () => {
  it("allows A-priority activities", () => {
    expect(canScheduleActivity({ priority: "A" })).toBe(true);
  });

  it("blocks B-priority activities", () => {
    expect(canScheduleActivity({ priority: "B" })).toBe(false);
  });
});

describe("30-day horizon + Someday (Phase 1B)", () => {
  const today = "2026-06-15";

  it("HORIZON_DAYS is 30", () => {
    expect(HORIZON_DAYS).toBe(30);
  });

  it("isWithinHorizon: today and +30 are in; +31 is out; someday is out", () => {
    expect(isWithinHorizon({ activity_date: today, is_someday: false, is_weekly: false }, today)).toBe(true);
    expect(isWithinHorizon({ activity_date: "2026-07-15", is_someday: false, is_weekly: false }, today)).toBe(true); // +30
    expect(isWithinHorizon({ activity_date: "2026-07-16", is_someday: false, is_weekly: false }, today)).toBe(false); // +31
    expect(isWithinHorizon({ activity_date: today, is_someday: true, is_weekly: false }, today)).toBe(false);
  });

  it("isWithinHorizon: overdue (past) items still count as near-term", () => {
    expect(isWithinHorizon({ activity_date: "2026-06-01", is_someday: false, is_weekly: false }, today)).toBe(true);
  });

  it("partitionByHorizon splits into the three buckets", () => {
    const within = makeActivity({ activity_date: "2026-06-20" });
    const beyond = makeActivity({ activity_date: "2026-09-01" });
    const someday = makeActivity({ is_someday: true, activity_date: "2026-06-20" });
    const result = partitionByHorizon([within, beyond, someday], today);
    expect(result.withinHorizon).toEqual([within]);
    expect(result.beyondHorizon).toEqual([beyond]);
    expect(result.someday).toEqual([someday]);
  });

  it("getSomedayReviewDue: due when never reviewed or ≥7 days", () => {
    expect(getSomedayReviewDue(null, today)).toBe(true);
    expect(getSomedayReviewDue("2026-06-08", today)).toBe(true); // 7 days
    expect(getSomedayReviewDue("2026-06-10", today)).toBe(false); // 5 days
  });
});

describe("intentional B re-dating (Phase 2A)", () => {
  const today = "2026-06-15";

  it("suggestRedate: B → +7 days, A → +1 day", () => {
    expect(suggestRedate({ priority: "B" }, today)).toBe("2026-06-22");
    expect(suggestRedate({ priority: "A" }, today)).toBe("2026-06-16");
  });

  it("canRedateTo rejects past dates", () => {
    expect(canRedateTo("2030-01-01")).toBe(true);
    expect(canRedateTo("2000-01-01")).toBe(false);
  });

  it("buildActivityMove records from→to with trimmed reason", () => {
    const a = makeActivity({ id: "a1", user_id: "u1", activity_date: "2026-06-15" });
    const move = buildActivityMove({
      activity: a,
      toDateISO: "2026-06-22",
      nowISO: "2026-06-15T10:00:00.000Z",
      reason: "  see it done  ",
    });
    expect(move.from_date).toBe("2026-06-15");
    expect(move.to_date).toBe("2026-06-22");
    expect(move.reason).toBe("see it done");
    expect(move.activity_id).toBe("a1");
    expect(move.user_id).toBe("u1");
  });

  it("buildActivityMove nulls an empty reason", () => {
    const move = buildActivityMove({
      activity: makeActivity(),
      toDateISO: "2026-06-22",
      nowISO: "2026-06-15T10:00:00.000Z",
      reason: "   ",
    });
    expect(move.reason).toBeNull();
  });
});

describe("canPromoteForScheduling (Phase 0A gate)", () => {
  it("is open (vacuously) when there are no A's", () => {
    expect(canPromoteForScheduling([makeActivity({ priority: "B" })])).toBe(true);
  });

  it("is closed while an A is still open (not_started)", () => {
    const openA = makeActivity({ priority: "A", status: "not_started" });
    expect(canPromoteForScheduling([openA])).toBe(false);
  });

  it("is closed while an A is in progress (working)", () => {
    const workingA = makeActivity({ priority: "A", status: "working" });
    expect(canPromoteForScheduling([workingA])).toBe(false);
  });

  it("opens once every A is completed", () => {
    const doneA = makeActivity({ priority: "A", status: "completed" });
    const doneA2 = makeActivity({ priority: "A", status: "completed" });
    expect(canPromoteForScheduling([doneA, doneA2])).toBe(true);
  });

  it("treats cancelled / delegated / postponed A's as resolved", () => {
    expect(
      canPromoteForScheduling([
        makeActivity({ priority: "A", status: "cancelled" }),
        makeActivity({ priority: "A", status: "delegated" }),
        makeActivity({ priority: "A", status: "postponed" }),
      ]),
    ).toBe(true);
  });
});
