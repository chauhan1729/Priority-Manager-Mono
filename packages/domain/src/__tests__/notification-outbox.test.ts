import { describe, it, expect } from "vitest";

import type { ReminderSchedule } from "../notification";
import { buildOutboxRows, notificationRoute, outboxDedupKey } from "../notification/outbox";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function reminder(overrides: Partial<ReminderSchedule> = {}): ReminderSchedule {
  return {
    type: "morning_summary",
    source_id: null,
    scheduled_for: new Date("2026-07-03T08:00:00.000Z"),
    title: "Good morning!",
    body: "Review today's plan.",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// outboxDedupKey
// ---------------------------------------------------------------------------

describe("outboxDedupKey", () => {
  it("is stable for the same (type, source, instant)", () => {
    const a = reminder({ type: "meeting_upcoming", source_id: "m1" });
    const b = reminder({ type: "meeting_upcoming", source_id: "m1" });
    expect(outboxDedupKey(a)).toBe(outboxDedupKey(b));
  });

  it("differs when the instant differs", () => {
    const a = reminder({ scheduled_for: new Date("2026-07-03T08:00:00.000Z") });
    const b = reminder({ scheduled_for: new Date("2026-07-03T09:00:00.000Z") });
    expect(outboxDedupKey(a)).not.toBe(outboxDedupKey(b));
  });

  it("encodes a null source as 'null'", () => {
    expect(outboxDedupKey(reminder({ source_id: null }))).toContain("::null::");
  });
});

// ---------------------------------------------------------------------------
// notificationRoute
// ---------------------------------------------------------------------------

describe("notificationRoute", () => {
  it("routes meeting reminders to the meeting planner", () => {
    expect(notificationRoute("meeting_upcoming")).toBe("/meeting-planner");
    expect(notificationRoute("meeting_passed")).toBe("/meeting-planner");
  });

  it("defaults unknown/day reminders to the daily plan", () => {
    expect(notificationRoute("eod_review")).toBe("/daily-plan");
    expect(notificationRoute("activity_overdue")).toBe("/daily-plan");
  });
});

// ---------------------------------------------------------------------------
// buildOutboxRows
// ---------------------------------------------------------------------------

describe("buildOutboxRows", () => {
  const now = new Date("2026-07-03T07:00:00.000Z");

  it("includes only future reminders within the horizon", () => {
    const past = reminder({ scheduled_for: new Date("2026-07-03T06:00:00.000Z") });
    const soon = reminder({ scheduled_for: new Date("2026-07-03T08:00:00.000Z") });
    const beyond = reminder({ scheduled_for: new Date("2026-07-06T08:00:00.000Z") }); // >48h

    const rows = buildOutboxRows([past, soon, beyond], true, now);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.scheduled_for).toBe(soon.scheduled_for.toISOString());
  });

  it("marks rows silent when sound is disabled", () => {
    const soon = reminder({ scheduled_for: new Date("2026-07-03T08:00:00.000Z") });
    expect(buildOutboxRows([soon], false, now)[0]?.silent).toBe(true);
    expect(buildOutboxRows([soon], true, now)[0]?.silent).toBe(false);
  });

  it("carries the deep-link route and dedup key", () => {
    const soon = reminder({
      type: "meeting_upcoming",
      source_id: "m1",
      scheduled_for: new Date("2026-07-03T08:00:00.000Z"),
    });
    const [row] = buildOutboxRows([soon], true, now);
    expect(row?.url).toBe("/meeting-planner");
    expect(row?.dedup_key).toBe(outboxDedupKey(soon));
    expect(row?.reminder_type).toBe("meeting_upcoming");
    expect(row?.source_id).toBe("m1");
  });

  it("respects a custom horizon", () => {
    const in3h = reminder({ scheduled_for: new Date("2026-07-03T10:00:00.000Z") });
    // 1h horizon → excluded; 4h horizon → included
    expect(buildOutboxRows([in3h], true, now, 1 * 60 * 60 * 1000)).toHaveLength(0);
    expect(buildOutboxRows([in3h], true, now, 4 * 60 * 60 * 1000)).toHaveLength(1);
  });
});
