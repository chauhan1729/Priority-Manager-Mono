import type { YearEntry } from "@pm/types";

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Returns true if the entry is a birthday type. */
export function isBirthdayEntry(entry: YearEntry): boolean {
  return entry.type === "birthday";
}

/** Returns true if the entry is a travel or away type. */
export function isTravelOrAway(entry: YearEntry): boolean {
  return entry.type === "travel" || entry.type === "away";
}

// ---------------------------------------------------------------------------
// Date coverage
// ---------------------------------------------------------------------------

/**
 * Returns true if the given entry covers the given ISO date.
 *
 * - Birthday entries: year-agnostic — match by month+day only (annual recurrence).
 * - Travel/away entries: standard date-range check using start_date and end_date.
 *
 * Spec §10.1: birthdays sync into Calendar via annual recurrence without duplication.
 */
export function entrySpansDate(entry: YearEntry, date: string): boolean {
  if (entry.type === "birthday") {
    // Annual recurrence: match month+day only ("MM-DD")
    const entryMonthDay = entry.start_date.slice(5);
    const dateMonthDay = date.slice(5);
    return entryMonthDay === dateMonthDay;
  }
  // Travel / away: standard date-range
  if (date < entry.start_date) return false;
  const endDate = entry.end_date ?? entry.start_date;
  return date <= endDate;
}

/**
 * Returns true if the entry should appear anywhere in the given year's grid.
 * - Birthdays: always (annual recurrence).
 * - Travel/away: entry overlaps any part of the year.
 */
export function entryOverlapsYear(entry: YearEntry, year: number): boolean {
  if (entry.type === "birthday") return true;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const endDate = entry.end_date ?? entry.start_date;
  return entry.start_date <= yearEnd && endDate >= yearStart;
}

// ---------------------------------------------------------------------------
// Birthday utilities
// ---------------------------------------------------------------------------

/**
 * For a birthday entry, returns the ISO date "YYYY-MM-DD" placing the birthday
 * in the given year (e.g., entry stored as "1990-03-15" → "2026-03-15" for year 2026).
 *
 * Returns null if the date is invalid for that year (e.g., Feb 29 on a non-leap year).
 */
export function birthdayDateForYear(entry: YearEntry, year: number): string | null {
  const monthDay = entry.start_date.slice(5); // "MM-DD"
  const candidate = `${year}-${monthDay}`;
  // Validate: parse and round-trip to catch invalid dates like 2025-02-29
  const d = new Date(`${candidate}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== candidate) return null;
  return candidate;
}

// ---------------------------------------------------------------------------
// Linked trip plan
// ---------------------------------------------------------------------------

/**
 * Returns the suggested project name for a linked trip plan.
 * Spec §10.1: linked projects are lightweight trip plans, not a separate system.
 */
export function buildLinkedProjectName(entry: Pick<YearEntry, "title">): string {
  return `${entry.title} — Trip Plan`;
}

/**
 * Returns true if the entry is eligible to have a new linked trip plan created.
 * - Birthday entries cannot have linked trip plans.
 * - Entries that already have a linked_project_id cannot create another.
 */
export function canCreateLinkedTripPlan(entry: YearEntry): boolean {
  return entry.type !== "birthday" && entry.linked_project_id === null;
}
