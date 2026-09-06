import { describe, expect, it } from "vitest";

import type { Activity } from "@pm/types";

import {
  addWeeksISO,
  DAYS_PER_WEEK,
  isDateInWeek,
  isInWeeklyPool,
  strandedWeeklyItems,
  weekDayISOs,
  weekEndISO,
  weekStartISO,
} from "../week";
import { isPendingActivity, isWithinHorizon, partitionByHorizon } from "../activity";
import { canCreateActivityOnDate } from "../time-rules";

// 2026-09-06 is a Sunday; 2026-09-12 is the Saturday that closes that week.
const WEEK_START = "2026-09-06";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    user_id: "u1",
    section_type: "outside",
    title: "Test activity",
    priority: "B",
    activity_date: WEEK_START,
    estimated_minutes: 30,
    remaining_minutes: 30,
    status: "not_started",
    linked_project_id: null,
    delegated_contact_id: null,
    note: null,
    origin_type: "manual",
    moved_from_date: null,
    hours_worked: 0,
    archived: false,
    is_someday: false,
    is_weekly: false,
    recurrence_rule: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("weekStartISO", () => {
  it("returns the containing Sunday", () => {
    expect(weekStartISO("2026-09-09")).toBe(WEEK_START); // Wednesday
    expect(weekStartISO("2026-09-12")).toBe(WEEK_START); // Saturday
  });

  it("returns the date itself when it is already the week start", () => {
    expect(weekStartISO(WEEK_START)).toBe(WEEK_START);
  });

  it("rolls back across a month boundary", () => {
    // 2026-10-01 is a Thursday; its week starts in September.
    expect(weekStartISO("2026-10-01")).toBe("2026-09-27");
  });

  it("rolls back across a year boundary", () => {
    // 2027-01-01 is a Friday; its week starts in 2026.
    expect(weekStartISO("2027-01-01")).toBe("2026-12-27");
  });

  it("honours a Monday start when asked", () => {
    expect(weekStartISO("2026-09-09", 1)).toBe("2026-09-07");
    // A Sunday belongs to the *previous* Monday-start week.
    expect(weekStartISO(WEEK_START, 1)).toBe("2026-08-31");
  });
});

describe("weekEndISO", () => {
  it("returns the inclusive last day", () => {
    expect(weekEndISO("2026-09-09")).toBe("2026-09-12");
    expect(weekEndISO(WEEK_START)).toBe("2026-09-12");
  });

  it("rolls forward across a month boundary", () => {
    expect(weekEndISO("2026-09-27")).toBe("2026-10-03");
  });
});

describe("addWeeksISO", () => {
  it("moves forward and backward", () => {
    expect(addWeeksISO(WEEK_START, 1)).toBe("2026-09-13");
    expect(addWeeksISO(WEEK_START, -1)).toBe("2026-08-30");
  });

  it("crosses a year boundary", () => {
    expect(addWeeksISO("2026-12-27", 1)).toBe("2027-01-03");
    expect(addWeeksISO("2027-01-03", -1)).toBe("2026-12-27");
  });
});

describe("weekDayISOs", () => {
  it("returns seven consecutive dates starting at the week start", () => {
    const days = weekDayISOs(WEEK_START);
    expect(days).toHaveLength(DAYS_PER_WEEK);
    expect(days[0]).toBe(WEEK_START);
    expect(days[6]).toBe("2026-09-12");
  });
});

describe("isDateInWeek", () => {
  it("includes both boundary days", () => {
    expect(isDateInWeek(WEEK_START, WEEK_START)).toBe(true);
    expect(isDateInWeek("2026-09-12", WEEK_START)).toBe(true);
  });

  it("excludes the days either side", () => {
    expect(isDateInWeek("2026-09-05", WEEK_START)).toBe(false);
    expect(isDateInWeek("2026-09-13", WEEK_START)).toBe(false);
  });
});

describe("isInWeeklyPool", () => {
  it("accepts a weekly item anchored inside the week", () => {
    expect(isInWeeklyPool(makeActivity({ is_weekly: true }), WEEK_START)).toBe(true);
  });

  it("rejects a dated (non-pool) activity", () => {
    expect(isInWeeklyPool(makeActivity({ is_weekly: false }), WEEK_START)).toBe(false);
  });

  it("rejects archived and someday items", () => {
    expect(isInWeeklyPool(makeActivity({ is_weekly: true, archived: true }), WEEK_START)).toBe(false);
    expect(isInWeeklyPool(makeActivity({ is_weekly: true, is_someday: true }), WEEK_START)).toBe(false);
  });

  it("rejects a pool item anchored to another week", () => {
    const item = makeActivity({ is_weekly: true, activity_date: "2026-09-13" });
    expect(isInWeeklyPool(item, WEEK_START)).toBe(false);
  });
});

describe("strandedWeeklyItems", () => {
  it("catches pool items left behind in an earlier week", () => {
    const stranded = makeActivity({ id: "old", is_weekly: true, activity_date: "2026-08-30" });
    const current = makeActivity({ id: "now", is_weekly: true });
    const dated = makeActivity({ id: "dated", activity_date: "2026-08-30" });
    expect(strandedWeeklyItems([stranded, current, dated], WEEK_START).map((a) => a.id)).toEqual([
      "old",
    ]);
  });

  it("ignores archived leftovers", () => {
    const item = makeActivity({ is_weekly: true, activity_date: "2026-08-30", archived: true });
    expect(strandedWeeklyItems([item], WEEK_START)).toEqual([]);
  });
});

describe("horizon rules for weekly-pool items", () => {
  it("treats a pool item as within the horizon regardless of its anchor", () => {
    const item = makeActivity({ is_weekly: true, activity_date: "2026-12-25" });
    expect(isWithinHorizon(item, WEEK_START)).toBe(true);
  });

  it("sorts pool items into their own bucket", () => {
    const weekly = makeActivity({ id: "w", is_weekly: true });
    const someday = makeActivity({ id: "s", is_someday: true });
    const dated = makeActivity({ id: "d" });
    const result = partitionByHorizon([weekly, someday, dated], WEEK_START);
    expect(result.weekly.map((a) => a.id)).toEqual(["w"]);
    expect(result.someday.map((a) => a.id)).toEqual(["s"]);
    expect(result.withinHorizon.map((a) => a.id)).toEqual(["d"]);
  });

  it("never reports a pool item as overdue — its date is an anchor, not a due date", () => {
    const item = makeActivity({ is_weekly: true, activity_date: "2026-08-30" });
    expect(isPendingActivity(item, WEEK_START)).toBe(false);
    expect(isPendingActivity(makeActivity({ activity_date: "2026-08-30" }), WEEK_START)).toBe(true);
  });
});

describe("day assignment", () => {
  it("rejects a past day as an assignment target", () => {
    expect(canCreateActivityOnDate("2020-01-01")).toBe(false);
  });
});
