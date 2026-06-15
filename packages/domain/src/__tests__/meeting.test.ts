import { describe, expect, it } from "vitest";

import { type Meeting } from "@pm/types";

import {
  getMeetingEditableFields,
  isMeetingPast,
  isMeetingRunning,
  needsStatusUpdatePrompt,
  needsTakeawayPrompt,
} from "../meeting";

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  const future = new Date(Date.now() + 86400_000); // tomorrow
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    linked_contact_id: "contact-1",
    linked_calendar_event_id: null,
    title: "Test meeting",
    date: "2026-04-05",
    start_at: future.toISOString(),
    end_at: new Date(future.getTime() + 3600_000).toISOString(),
    duration_minutes: 60,
    agenda: "Discuss things",
    key_takeaways: null,
    recurrence_rule: null,
    status: "upcoming",
    archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function pastMeeting(overrides: Partial<Meeting> = {}): Meeting {
  const past = new Date(Date.now() - 86400_000); // yesterday
  return makeMeeting({
    start_at: new Date(past.getTime() - 3600_000).toISOString(),
    end_at: past.toISOString(),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
describe("isMeetingPast", () => {
  it("returns true when end_at is in the past", () => {
    expect(isMeetingPast(pastMeeting())).toBe(true);
  });

  it("returns false when end_at is in the future", () => {
    expect(isMeetingPast(makeMeeting())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("isMeetingRunning", () => {
  it("returns true when start_at has passed but end_at has not", () => {
    const now = new Date();
    const running = makeMeeting({
      start_at: new Date(now.getTime() - 30_000).toISOString(), // 30s ago
      end_at: new Date(now.getTime() + 30_000).toISOString(),   // 30s from now
    });
    expect(isMeetingRunning(running)).toBe(true);
  });

  it("returns false for a future meeting", () => {
    expect(isMeetingRunning(makeMeeting())).toBe(false);
  });

  it("returns false for a fully past meeting", () => {
    expect(isMeetingRunning(pastMeeting())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("needsStatusUpdatePrompt (spec §10.9)", () => {
  it("returns true when past and status is still 'upcoming'", () => {
    const m = pastMeeting({ status: "upcoming" });
    expect(needsStatusUpdatePrompt(m)).toBe(true);
  });

  it("returns false when past and status is 'completed'", () => {
    const m = pastMeeting({ status: "completed" });
    expect(needsStatusUpdatePrompt(m)).toBe(false);
  });

  it("returns false when past and status is 'missed'", () => {
    const m = pastMeeting({ status: "missed" });
    expect(needsStatusUpdatePrompt(m)).toBe(false);
  });

  it("returns false when past and status is 'cancelled'", () => {
    const m = pastMeeting({ status: "cancelled" });
    expect(needsStatusUpdatePrompt(m)).toBe(false);
  });

  it("returns false when meeting is still in the future", () => {
    const m = makeMeeting({ status: "upcoming" });
    expect(needsStatusUpdatePrompt(m)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("getMeetingEditableFields (spec §12.3)", () => {
  it("returns all fields for a future meeting", () => {
    const fields = getMeetingEditableFields(makeMeeting());
    expect(fields).toContain("title");
    expect(fields).toContain("agenda");
    expect(fields).toContain("key_takeaways");
    expect(fields).toContain("start_at");
  });

  it("returns only key_takeaways and status for a past meeting", () => {
    const fields = getMeetingEditableFields(pastMeeting());
    expect(fields).toEqual(["key_takeaways", "status"]);
  });

  it("past meeting: does NOT include title", () => {
    const fields = getMeetingEditableFields(pastMeeting());
    expect(fields).not.toContain("title");
  });

  it("past meeting: does NOT include agenda", () => {
    const fields = getMeetingEditableFields(pastMeeting());
    expect(fields).not.toContain("agenda");
  });
});

// ---------------------------------------------------------------------------
describe("needsTakeawayPrompt", () => {
  it("returns true when past, no takeaways, and not cancelled", () => {
    const m = pastMeeting({ key_takeaways: null, status: "completed" });
    expect(needsTakeawayPrompt(m)).toBe(true);
  });

  it("returns false when takeaways already filled", () => {
    const m = pastMeeting({ key_takeaways: "Great meeting", status: "completed" });
    expect(needsTakeawayPrompt(m)).toBe(false);
  });

  it("returns false for a cancelled meeting", () => {
    const m = pastMeeting({ key_takeaways: null, status: "cancelled" });
    expect(needsTakeawayPrompt(m)).toBe(false);
  });

  it("returns false for a future meeting (time not yet passed)", () => {
    const m = makeMeeting({ key_takeaways: null });
    expect(needsTakeawayPrompt(m)).toBe(false);
  });
});
