import type { CalendarEvent, YearEntry } from "@pm/types";

// ---------------------------------------------------------------------------
// Past/future checks
// ---------------------------------------------------------------------------

/**
 * Returns true when a CalendarEvent is in the past.
 * Uses end_at if set; falls back to date comparison for all-day events.
 */
export function isCalendarEventPast(event: CalendarEvent): boolean {
  if (event.end_at) return new Date(event.end_at) < new Date();
  const today = new Date().toISOString().slice(0, 10);
  return event.date < today;
}

/**
 * Returns true if a new timed event can be created starting at the given ISO datetime.
 * Spec §12.1: no new timed events in the past.
 */
export function canCreateCalendarEventAt(startAt: string): boolean {
  return new Date(startAt) >= new Date();
}

/**
 * Returns true if a new all-day event can be created on the given ISO date.
 * Spec §12.1: date must not be in the past.
 */
export function canCreateCalendarEventOnDate(date: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return date >= today;
}

// ---------------------------------------------------------------------------
// Away / travel checks (spec §10.1 + §10.2)
// ---------------------------------------------------------------------------

/** Returns true if the given ISO date falls within any travel or away YearEntry. */
export function isDateInAwayPeriod(date: string, yearEntries: YearEntry[]): boolean {
  return yearEntries.some((entry) => _entryCoversDate(entry, date));
}

/**
 * Returns the first travel/away YearEntry that covers the given ISO date, or null.
 * Used to show which trip/away period is active on a given day.
 */
export function getAwayEntryForDate(date: string, yearEntries: YearEntry[]): YearEntry | null {
  return yearEntries.find((entry) => _entryCoversDate(entry, date)) ?? null;
}

function _entryCoversDate(entry: YearEntry, date: string): boolean {
  if (entry.type !== "travel" && entry.type !== "away") return false;
  if (date < entry.start_date) return false;
  const endDate = entry.end_date ?? entry.start_date;
  return date <= endDate;
}

// ---------------------------------------------------------------------------
// Month navigation utilities
// ---------------------------------------------------------------------------

/** Returns the ISO date string for the first day of the given "YYYY-MM" month key. */
export function monthStart(monthKey: string): string {
  return `${monthKey}-01`;
}

/** Returns the ISO date string for the last day of the given "YYYY-MM" month key. */
export function monthEnd(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  // Day 0 of the next month = last day of this month
  const lastDay = new Date(year!, month!, 0).getDate();
  return `${monthKey}-${String(lastDay).padStart(2, "0")}`;
}

/** Returns the "YYYY-MM" key for the month before the given month key. */
export function prevMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year!, month! - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns the "YYYY-MM" key for the month after the given month key. */
export function nextMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year!, month!, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns the "YYYY-MM" key for today's month. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns the "YYYY-MM" month key from any ISO date string. */
export function toMonthKeyFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

// ---------------------------------------------------------------------------
// Recurring event expansion
// ---------------------------------------------------------------------------

function _toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Expands recurring CalendarEvents into all occurrences within [startDate, endDate].
 * Non-recurring events are passed through only if within the range.
 * The original event id is preserved so the UI can link back to it.
 */
export function expandRecurringCalendarEvents(
  events: CalendarEvent[],
  startDate: string,
  endDate: string,
): CalendarEvent[] {
  const result: CalendarEvent[] = [];

  for (const event of events) {
    if (!event.recurrence_rule) {
      if (event.date >= startDate && event.date <= endDate) {
        result.push(event);
      }
      continue;
    }

    const durationMs =
      event.start_at && event.end_at
        ? new Date(event.end_at).getTime() - new Date(event.start_at).getTime()
        : 0;

    let current = new Date(`${event.date}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);

    let iterations = 0;
    while (current <= end && iterations < 366) {
      iterations++;
      const occDate = _toISO(current);

      if (occDate >= startDate) {
        let occStartAt = event.start_at;
        let occEndAt = event.end_at;

        // Move the occurrence's start_at onto its own date (not the base event's),
        // even when there's no duration — otherwise every occurrence inherits the
        // original (possibly past) datetime.
        if (event.start_at) {
          const origStart = new Date(event.start_at);
          const occStart = new Date(current);
          occStart.setUTCHours(
            origStart.getUTCHours(),
            origStart.getUTCMinutes(),
            origStart.getUTCSeconds(),
            0,
          );
          occStartAt = occStart.toISOString();
          occEndAt =
            durationMs > 0 ? new Date(occStart.getTime() + durationMs).toISOString() : event.end_at;
        }

        result.push({ ...event, date: occDate, start_at: occStartAt, end_at: occEndAt });
      }

      if (event.recurrence_rule === "daily") {
        current.setDate(current.getDate() + 1);
      } else if (event.recurrence_rule === "weekly") {
        current.setDate(current.getDate() + 7);
      } else if (event.recurrence_rule === "monthly") {
        current.setMonth(current.getMonth() + 1);
      } else {
        break;
      }
    }
  }

  return result.sort((a, b) => (a.start_at ?? a.date).localeCompare(b.start_at ?? b.date));
}
