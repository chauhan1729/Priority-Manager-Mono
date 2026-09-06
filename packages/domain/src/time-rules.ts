/**
 * Core time rules from spec §12.
 * All "is past" checks live here so they are consistent across web and mobile.
 */

/** Returns true if the given ISO date string is strictly before today. */
export function isDateInPast(isoDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(isoDate);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

/** Returns true if the given ISO datetime string is strictly before now. */
export function isDateTimeInPast(isoDatetime: string): boolean {
  return new Date(isoDatetime) < new Date();
}

/** Returns true if a new activity can be created for the given date. */
export function canCreateActivityOnDate(isoDate: string): boolean {
  return !isDateInPast(isoDate);
}

/** Returns true if a new schedule block can be placed at the given start time. */
export function canScheduleAt(isoStartDatetime: string): boolean {
  return !isDateTimeInPast(isoStartDatetime);
}

/** Returns true if a new meeting can be created at the given date/time. */
export function canCreateMeetingAt(isoStartDatetime: string): boolean {
  return !isDateTimeInPast(isoStartDatetime);
}

/** Returns "YYYY-MM" key for a given date. */
export function toMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Add `days` to an ISO date (YYYY-MM-DD), noon-anchored to avoid timezone drift. */
export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two ISO dates (b - a). */
export function daysBetweenISO(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T12:00:00`).getTime();
  const b = new Date(`${bISO}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Returns today's ISO date string YYYY-MM-DD (UTC). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Converts a local date + "HH:MM" time string to a UTC Date, interpreting the
 * input as wall-clock time in the given IANA timezone.
 *
 * Example: localTimeToUTC("2026-04-05", "10:00", "Asia/Kolkata")
 *          → Date representing 2026-04-05T04:30:00.000Z
 */
export function localTimeToUTC(date: string, hhmm: string, ianaTimezone: string): Date {
  // Strategy: make a UTC guess at the same wall-clock time, then compute the
  // actual UTC offset the timezone has at that moment and correct for it.
  const utcGuess = new Date(`${date}T${hhmm}:00.000Z`);

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(utcGuess);

    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const localH = parseInt(p["hour"] ?? "0", 10);
    const localM = parseInt(p["minute"] ?? "0", 10);
    const [wantH, wantM] = hhmm.split(":").map(Number);
    const diffMin = (localH * 60 + localM) - ((wantH ?? 0) * 60 + (wantM ?? 0));
    return new Date(utcGuess.getTime() - diffMin * 60_000);
  } catch {
    // Fallback: just treat input as UTC (original behaviour)
    return utcGuess;
  }
}

/**
 * Returns today's ISO date string YYYY-MM-DD in the given IANA timezone.
 * Use this server-side when the user's local date matters (e.g. UTC+5:30 users
 * see the wrong date if we use todayISO() which is always UTC).
 */
export function localTodayForTimezone(ianaTimezone: string): string {
  try {
    // en-CA locale gives dates in YYYY-MM-DD format — same as ISO date
    return new Intl.DateTimeFormat("en-CA", { timeZone: ianaTimezone }).format(new Date());
  } catch {
    // Fallback to UTC if timezone string is invalid
    return new Date().toISOString().slice(0, 10);
  }
}
