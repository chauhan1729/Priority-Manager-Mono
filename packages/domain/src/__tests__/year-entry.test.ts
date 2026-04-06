import { describe, expect, it } from "vitest";

import type { YearEntry } from "@pm/types";

import {
  birthdayDateForYear,
  buildLinkedProjectName,
  canCreateLinkedTripPlan,
  entryOverlapsYear,
  entrySpansDate,
  isBirthdayEntry,
  isTravelOrAway,
} from "../year-entry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<YearEntry> = {}): YearEntry {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    type: "travel",
    title: "Summer Trip",
    start_date: "2026-07-01",
    end_date: "2026-07-14",
    location: "Italy",
    note: null,
    availability_status: "away",
    create_linked_trip_plan: false,
    linked_project_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function birthday(startDate: string, overrides: Partial<YearEntry> = {}): YearEntry {
  return makeEntry({
    type: "birthday",
    title: "Alice's Birthday",
    start_date: startDate,
    end_date: null,
    location: null,
    availability_status: null,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
describe("isBirthdayEntry", () => {
  it("returns true for birthday type", () => {
    expect(isBirthdayEntry(birthday("2000-03-15"))).toBe(true);
  });

  it("returns false for travel type", () => {
    expect(isBirthdayEntry(makeEntry({ type: "travel" }))).toBe(false);
  });

  it("returns false for away type", () => {
    expect(isBirthdayEntry(makeEntry({ type: "away" }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("isTravelOrAway", () => {
  it("returns true for travel type", () => {
    expect(isTravelOrAway(makeEntry({ type: "travel" }))).toBe(true);
  });

  it("returns true for away type", () => {
    expect(isTravelOrAway(makeEntry({ type: "away" }))).toBe(true);
  });

  it("returns false for birthday type", () => {
    expect(isTravelOrAway(birthday("2000-03-15"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("entrySpansDate", () => {
  // Birthday: year-agnostic (annual recurrence)
  it("birthday: returns true when month+day matches regardless of year", () => {
    const entry = birthday("1990-03-15");
    expect(entrySpansDate(entry, "2026-03-15")).toBe(true);
    expect(entrySpansDate(entry, "2000-03-15")).toBe(true);
    expect(entrySpansDate(entry, "2099-03-15")).toBe(true);
  });

  it("birthday: returns false when month+day does not match", () => {
    const entry = birthday("1990-03-15");
    expect(entrySpansDate(entry, "2026-03-14")).toBe(false);
    expect(entrySpansDate(entry, "2026-04-15")).toBe(false);
  });

  // Travel/away: date-range check
  it("travel: returns true for start_date (single-day entry)", () => {
    const entry = makeEntry({ type: "travel", start_date: "2026-07-01", end_date: null });
    expect(entrySpansDate(entry, "2026-07-01")).toBe(true);
  });

  it("travel: returns false for date before single-day entry", () => {
    const entry = makeEntry({ type: "travel", start_date: "2026-07-01", end_date: null });
    expect(entrySpansDate(entry, "2026-06-30")).toBe(false);
  });

  it("travel: returns false for date after single-day entry", () => {
    const entry = makeEntry({ type: "travel", start_date: "2026-07-01", end_date: null });
    expect(entrySpansDate(entry, "2026-07-02")).toBe(false);
  });

  it("travel: returns true for dates within a multi-day range", () => {
    const entry = makeEntry({ type: "travel", start_date: "2026-07-01", end_date: "2026-07-14" });
    expect(entrySpansDate(entry, "2026-07-01")).toBe(true);
    expect(entrySpansDate(entry, "2026-07-07")).toBe(true);
    expect(entrySpansDate(entry, "2026-07-14")).toBe(true);
  });

  it("travel: returns false for dates outside the range", () => {
    const entry = makeEntry({ type: "travel", start_date: "2026-07-01", end_date: "2026-07-14" });
    expect(entrySpansDate(entry, "2026-06-30")).toBe(false);
    expect(entrySpansDate(entry, "2026-07-15")).toBe(false);
  });

  it("away: behaves the same as travel for date-range check", () => {
    const entry = makeEntry({ type: "away", start_date: "2026-08-10", end_date: "2026-08-20" });
    expect(entrySpansDate(entry, "2026-08-15")).toBe(true);
    expect(entrySpansDate(entry, "2026-08-09")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("entryOverlapsYear", () => {
  it("birthday: always returns true regardless of year", () => {
    const entry = birthday("1990-03-15");
    expect(entryOverlapsYear(entry, 2026)).toBe(true);
    expect(entryOverlapsYear(entry, 2000)).toBe(true);
    expect(entryOverlapsYear(entry, 2099)).toBe(true);
  });

  it("travel: returns true when entry falls entirely within the year", () => {
    const entry = makeEntry({ start_date: "2026-06-01", end_date: "2026-06-30" });
    expect(entryOverlapsYear(entry, 2026)).toBe(true);
  });

  it("travel: returns true when entry spans across year boundary into year", () => {
    const entry = makeEntry({ start_date: "2025-12-25", end_date: "2026-01-05" });
    expect(entryOverlapsYear(entry, 2026)).toBe(true);
  });

  it("travel: returns true when entry spans across year boundary out of year", () => {
    const entry = makeEntry({ start_date: "2026-12-25", end_date: "2027-01-05" });
    expect(entryOverlapsYear(entry, 2026)).toBe(true);
  });

  it("travel: returns false when entry is in a different year", () => {
    const entry = makeEntry({ start_date: "2025-06-01", end_date: "2025-06-30" });
    expect(entryOverlapsYear(entry, 2026)).toBe(false);
  });

  it("away: returns false for single-day entry in different year", () => {
    const entry = makeEntry({ type: "away", start_date: "2025-03-15", end_date: null });
    expect(entryOverlapsYear(entry, 2026)).toBe(false);
  });

  it("away: returns true for single-day entry in same year", () => {
    const entry = makeEntry({ type: "away", start_date: "2026-03-15", end_date: null });
    expect(entryOverlapsYear(entry, 2026)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("birthdayDateForYear", () => {
  it("returns the birthday date in the target year", () => {
    const entry = birthday("1990-03-15");
    expect(birthdayDateForYear(entry, 2026)).toBe("2026-03-15");
  });

  it("handles Dec 31 birthday", () => {
    const entry = birthday("2000-12-31");
    expect(birthdayDateForYear(entry, 2026)).toBe("2026-12-31");
  });

  it("returns valid Feb 29 birthday on a leap year", () => {
    const entry = birthday("2000-02-29");
    expect(birthdayDateForYear(entry, 2024)).toBe("2024-02-29");
  });

  it("returns null for Feb 29 birthday on a non-leap year", () => {
    const entry = birthday("2000-02-29");
    expect(birthdayDateForYear(entry, 2026)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("buildLinkedProjectName", () => {
  it("appends Trip Plan suffix to entry title", () => {
    expect(buildLinkedProjectName({ title: "Summer Italy" })).toBe("Summer Italy — Trip Plan");
  });

  it("works with short titles", () => {
    expect(buildLinkedProjectName({ title: "NYC" })).toBe("NYC — Trip Plan");
  });
});

// ---------------------------------------------------------------------------
describe("canCreateLinkedTripPlan", () => {
  it("returns true for travel entry with no linked project", () => {
    const entry = makeEntry({ type: "travel", linked_project_id: null });
    expect(canCreateLinkedTripPlan(entry)).toBe(true);
  });

  it("returns true for away entry with no linked project", () => {
    const entry = makeEntry({ type: "away", linked_project_id: null });
    expect(canCreateLinkedTripPlan(entry)).toBe(true);
  });

  it("returns false for birthday entry (birthdays cannot have trip plans)", () => {
    const entry = birthday("1990-03-15");
    expect(canCreateLinkedTripPlan(entry)).toBe(false);
  });

  it("returns false for travel entry that already has a linked project", () => {
    const entry = makeEntry({ type: "travel", linked_project_id: "project-uuid-1" });
    expect(canCreateLinkedTripPlan(entry)).toBe(false);
  });

  it("returns false for away entry that already has a linked project", () => {
    const entry = makeEntry({ type: "away", linked_project_id: "project-uuid-2" });
    expect(canCreateLinkedTripPlan(entry)).toBe(false);
  });
});
