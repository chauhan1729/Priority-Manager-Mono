import { describe, it, expect } from "vitest";

import type { Activity, ScheduleInstance } from "@pm/types";

import {
  computeActivityDueTodayReminders,
  computeActivityPastDueReminders,
} from "../notification";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const TODAY = "2026-07-04";

function activity(overrides: Partial<Activity> = {}): Pick<
  Activity,
  "id" | "title" | "priority" | "activity_date" | "status" | "is_someday" | "archived"
> {
  return {
    id: "act-1",
    title: "Draft proposal",
    priority: "A",
    activity_date: TODAY,
    status: "not_started",
    is_someday: false,
    archived: false,
    ...overrides,
  };
}

function scheduledToday(activityId: string): Pick<
  ScheduleInstance,
  "source_type" | "source_activity_id" | "schedule_date"
> {
  return { source_type: "activity", source_activity_id: activityId, schedule_date: TODAY };
}

// ---------------------------------------------------------------------------
// computeActivityDueTodayReminders
// ---------------------------------------------------------------------------

describe("computeActivityDueTodayReminders", () => {
  it("emits for an A-priority activity due today with no schedule block", () => {
    const result = computeActivityDueTodayReminders([activity()], [], "09:00", TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("activity_due_today");
    expect(result[0]!.source_id).toBe("act-1");
    // Fires at the nudge time today.
    expect(result[0]!.scheduled_for.getHours()).toBe(9);
  });

  it("does not emit when the activity already has a block today", () => {
    const result = computeActivityDueTodayReminders(
      [activity()],
      [scheduledToday("act-1")],
      "09:00",
      TODAY,
    );
    expect(result).toHaveLength(0);
  });

  it("ignores B-priority activities", () => {
    expect(
      computeActivityDueTodayReminders([activity({ priority: "B" })], [], "09:00", TODAY),
    ).toHaveLength(0);
  });

  it("ignores completed, someday, and archived activities", () => {
    const cases = [
      activity({ status: "completed" }),
      activity({ is_someday: true }),
      activity({ archived: true }),
    ];
    for (const a of cases) {
      expect(computeActivityDueTodayReminders([a], [], "09:00", TODAY)).toHaveLength(0);
    }
  });

  it("ignores activities not dated today", () => {
    expect(
      computeActivityDueTodayReminders([activity({ activity_date: "2026-07-05" })], [], "09:00", TODAY),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeActivityPastDueReminders
// ---------------------------------------------------------------------------

describe("computeActivityPastDueReminders", () => {
  it("emits for a still-actionable activity whose date has passed", () => {
    const result = computeActivityPastDueReminders(
      [activity({ activity_date: "2026-07-01" })],
      "09:00",
      TODAY,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("activity_past_due");
    expect(result[0]!.source_id).toBe("act-1");
  });

  it("does not emit for today or future dates", () => {
    expect(
      computeActivityPastDueReminders([activity({ activity_date: TODAY })], "09:00", TODAY),
    ).toHaveLength(0);
    expect(
      computeActivityPastDueReminders([activity({ activity_date: "2026-07-10" })], "09:00", TODAY),
    ).toHaveLength(0);
  });

  it("ignores completed/cancelled, someday, and archived activities", () => {
    const cases = [
      activity({ activity_date: "2026-07-01", status: "completed" }),
      activity({ activity_date: "2026-07-01", status: "cancelled" }),
      activity({ activity_date: "2026-07-01", is_someday: true }),
      activity({ activity_date: "2026-07-01", archived: true }),
    ];
    for (const a of cases) {
      expect(computeActivityPastDueReminders([a], "09:00", TODAY)).toHaveLength(0);
    }
  });
});
