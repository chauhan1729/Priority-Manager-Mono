import { describe, expect, it } from "vitest";

import type { CalendarEvent, YearEntry } from "@pm/types";

import {
  canCreateCalendarEventAt,
  canCreateCalendarEventOnDate,
  currentMonthKey,
  getAwayEntryForDate,
  isCalendarEventPast,
  isDateInAwayPeriod,
  monthEnd,
  monthStart,
  nextMonth,
  prevMonth,
  toMonthKeyFromDate,
} from "../calendar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    event_type: "appointment",
    title: "Test event",
    date: "2026-06-15",
    start_at: null,
    end_at: null,
    duration_minutes: null,
    linked_contact_id: null,
    linked_project_id: null,
    linked_meeting_id: null,
    linked_year_entry_id: null,
    location: null,
    notes: null,
    recurrence_rule: null,
    status: "upcoming",
    source_type: "calendar",
    linked_expense_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAwayEntry(
  type: "travel" | "away",
  startDate: string,
  endDate: string | null = null,
): YearEntry {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    type,
    title: "Trip",
    start_date: startDate,
    end_date: endDate,
    location: null,
    note: null,
    availability_status: "away",
    create_linked_trip_plan: false,
    linked_project_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
describe("isCalendarEventPast", () => {
  it("returns true when end_at is in the past", () => {
    const event = makeEvent({ end_at: new Date(Date.now() - 3600_000).toISOString() });
    expect(isCalendarEventPast(event)).toBe(true);
  });

  it("returns false when end_at is in the future", () => {
    const event = makeEvent({ end_at: new Date(Date.now() + 3600_000).toISOString() });
    expect(isCalendarEventPast(event)).toBe(false);
  });

  it("returns true for all-day event with past date (no end_at)", () => {
    const event = makeEvent({ date: "2020-01-01", start_at: null, end_at: null });
    expect(isCalendarEventPast(event)).toBe(true);
  });

  it("returns false for all-day event with today or future date", () => {
    const today = new Date().toISOString().slice(0, 10);
    const event = makeEvent({ date: today, start_at: null, end_at: null });
    expect(isCalendarEventPast(event)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("canCreateCalendarEventAt", () => {
  it("returns true for a future start time", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(canCreateCalendarEventAt(future)).toBe(true);
  });

  it("returns false for a past start time", () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    expect(canCreateCalendarEventAt(past)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("canCreateCalendarEventOnDate", () => {
  it("returns true for today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(canCreateCalendarEventOnDate(today)).toBe(true);
  });

  it("returns true for a future date", () => {
    expect(canCreateCalendarEventOnDate("2099-12-31")).toBe(true);
  });

  it("returns false for a past date", () => {
    expect(canCreateCalendarEventOnDate("2020-01-01")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("isDateInAwayPeriod", () => {
  it("returns true when date is within a single-day away entry", () => {
    const entries = [makeAwayEntry("away", "2026-06-15")];
    expect(isDateInAwayPeriod("2026-06-15", entries)).toBe(true);
  });

  it("returns true when date is within a multi-day away range", () => {
    const entries = [makeAwayEntry("travel", "2026-06-10", "2026-06-20")];
    expect(isDateInAwayPeriod("2026-06-15", entries)).toBe(true);
  });

  it("returns true for the start date of a range", () => {
    const entries = [makeAwayEntry("away", "2026-06-10", "2026-06-20")];
    expect(isDateInAwayPeriod("2026-06-10", entries)).toBe(true);
  });

  it("returns true for the end date of a range", () => {
    const entries = [makeAwayEntry("travel", "2026-06-10", "2026-06-20")];
    expect(isDateInAwayPeriod("2026-06-20", entries)).toBe(true);
  });

  it("returns false when date is before the away entry", () => {
    const entries = [makeAwayEntry("away", "2026-06-15", "2026-06-20")];
    expect(isDateInAwayPeriod("2026-06-14", entries)).toBe(false);
  });

  it("returns false when date is after the away entry", () => {
    const entries = [makeAwayEntry("travel", "2026-06-10", "2026-06-15")];
    expect(isDateInAwayPeriod("2026-06-16", entries)).toBe(false);
  });

  it("ignores birthday entries", () => {
    const birthdayEntry: YearEntry = {
      ...makeAwayEntry("away", "2026-06-15"),
      type: "birthday",
    };
    expect(isDateInAwayPeriod("2026-06-15", [birthdayEntry])).toBe(false);
  });

  it("returns false when no entries", () => {
    expect(isDateInAwayPeriod("2026-06-15", [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("getAwayEntryForDate", () => {
  it("returns the matching entry when date is covered", () => {
    const entry = makeAwayEntry("travel", "2026-06-10", "2026-06-20");
    const result = getAwayEntryForDate("2026-06-15", [entry]);
    expect(result).toBe(entry);
  });

  it("returns null when no entry covers the date", () => {
    const entry = makeAwayEntry("away", "2026-06-10", "2026-06-14");
    expect(getAwayEntryForDate("2026-06-15", [entry])).toBeNull();
  });

  it("returns null for empty entries array", () => {
    expect(getAwayEntryForDate("2026-06-15", [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("month navigation utilities", () => {
  it("monthStart returns first day of month", () => {
    expect(monthStart("2026-06")).toBe("2026-06-01");
    expect(monthStart("2026-01")).toBe("2026-01-01");
  });

  it("monthEnd returns last day of month", () => {
    expect(monthEnd("2026-06")).toBe("2026-06-30");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthEnd("2024-02")).toBe("2024-02-29"); // leap year
    expect(monthEnd("2026-12")).toBe("2026-12-31");
  });

  it("prevMonth returns previous month key", () => {
    expect(prevMonth("2026-06")).toBe("2026-05");
    expect(prevMonth("2026-01")).toBe("2025-12");
  });

  it("nextMonth returns next month key", () => {
    expect(nextMonth("2026-06")).toBe("2026-07");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });

  it("currentMonthKey returns YYYY-MM format", () => {
    const key = currentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  it("toMonthKeyFromDate extracts YYYY-MM from ISO date", () => {
    expect(toMonthKeyFromDate("2026-06-15")).toBe("2026-06");
    expect(toMonthKeyFromDate("2026-12-31")).toBe("2026-12");
  });
});
