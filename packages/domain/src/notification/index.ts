import type {
  Activity,
  CalendarEvent,
  Expense,
  Meeting,
  ReminderPreference,
  ReminderType,
  ScheduleInstance,
  YearEntry,
} from "@pm/types";

import { getNextOccurrenceDate } from "../expense";
import { birthdayDateForYear, isBirthdayEntry, isTravelOrAway } from "../year-entry";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

/** A computed reminder that should be shown or scheduled. */
export interface ReminderSchedule {
  type: ReminderType;
  /** The source record ID (meeting_id, year_entry_id, expense_id …) or null. */
  source_id: string | null;
  /** When the reminder should fire. */
  scheduled_for: Date;
  /** Short notification title. */
  title: string;
  /** Notification body text. */
  body: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a Date from a "HH:MM" time string and an ISO date (YYYY-MM-DD).
 * Date is interpreted as local time.
 */
function buildDateTimeFromTime(timeHHMM: string, dateISO: string): Date {
  const [hoursStr, minutesStr] = timeHHMM.split(":");
  const hours = parseInt(hoursStr ?? "0", 10);
  const minutes = parseInt(minutesStr ?? "0", 10);
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Returns the ISO date string for `isoDate` + `days` days.
 */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// §13: End-of-day review reminder
// ---------------------------------------------------------------------------

/**
 * Returns the EOD reminder for today if enabled, null otherwise.
 * Fires at the user-configured `eod_review_time`.
 */
export function computeEodReminder(
  prefs: Pick<ReminderPreference, "eod_review_enabled" | "eod_review_time">,
  todayISO: string,
): ReminderSchedule | null {
  if (!prefs.eod_review_enabled) return null;
  return {
    type: "eod_review",
    source_id: null,
    scheduled_for: buildDateTimeFromTime(prefs.eod_review_time, todayISO),
    title: "End of Day Review",
    body: "Review unfinished activities, update statuses, and plan for tomorrow.",
  };
}

// ---------------------------------------------------------------------------
// §13: Morning summary reminder
// ---------------------------------------------------------------------------

/**
 * Returns the morning summary reminder for today if enabled, null otherwise.
 * Fires at the user-configured `morning_summary_time`.
 */
export function computeMorningSummaryReminder(
  prefs: Pick<ReminderPreference, "morning_summary_enabled" | "morning_summary_time">,
  todayISO: string,
): ReminderSchedule | null {
  if (!prefs.morning_summary_enabled) return null;
  return {
    type: "morning_summary",
    source_id: null,
    scheduled_for: buildDateTimeFromTime(prefs.morning_summary_time, todayISO),
    title: "Good morning!",
    body: "Check today's schedule, priorities, and activities.",
  };
}

// ---------------------------------------------------------------------------
// §13: Upcoming meeting reminders
// ---------------------------------------------------------------------------

/**
 * Returns reminders for meetings whose start time is within `minutesBefore` of `now`.
 * Only fires for meetings still in "upcoming" status.
 *
 * A reminder fires when: reminderTime <= now < startAt
 * where reminderTime = startAt - minutesBefore.
 */
export function computeMeetingUpcomingReminders(
  meetings: Pick<Meeting, "id" | "title" | "start_at" | "status">[],
  minutesBefore: number,
  now: Date,
): ReminderSchedule[] {
  return meetings.flatMap((m) => {
    if (m.status !== "upcoming") return [];
    const startAt = new Date(m.start_at);
    const reminderTime = new Date(startAt.getTime() - minutesBefore * 60_000);
    // Reminder window: [reminderTime, startAt)
    if (now < reminderTime || now >= startAt) return [];
    return [
      {
        type: "meeting_upcoming" as ReminderType,
        source_id: m.id,
        scheduled_for: reminderTime,
        title: `Upcoming: ${m.title}`,
        body: `Starts in ${minutesBefore} minutes.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// §13 + §18.4: Meeting time-passed reminders
// ---------------------------------------------------------------------------

/**
 * Returns reminders for meetings that have ended but are still "upcoming".
 * Spec §10.9: prompt user to update status and add takeaways, do not auto-finalize.
 */
export function computeMeetingPassedReminders(
  meetings: Pick<Meeting, "id" | "title" | "end_at" | "status" | "key_takeaways">[],
  now: Date,
): ReminderSchedule[] {
  return meetings.flatMap((m) => {
    if (m.status !== "upcoming") return [];
    if (new Date(m.end_at) > now) return [];
    const needsTakeaway = !m.key_takeaways;
    return [
      {
        type: "meeting_passed" as ReminderType,
        source_id: m.id,
        scheduled_for: new Date(m.end_at),
        title: `Meeting ended: ${m.title}`,
        body: needsTakeaway
          ? "Update meeting status and add key takeaways."
          : "Update meeting status.",
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// §13: Subscription/renewal reminders
// ---------------------------------------------------------------------------

/**
 * Returns renewal reminders for recurring expenses whose next occurrence is
 * exactly `daysBefore` days from today.
 *
 * Driven from shared Expense records — no separate reminder-owned copy.
 */
export function computeRenewalReminders(
  expenses: Pick<Expense, "id" | "title" | "amount" | "expense_date" | "recurrence_rule">[],
  daysBefore: number,
  todayISO: string,
): ReminderSchedule[] {
  const targetDate = addDays(todayISO, daysBefore);
  return expenses.flatMap((e) => {
    if (!e.recurrence_rule) return [];
    // getNextOccurrenceDate needs a full Expense, but only uses expense_date and recurrence_rule
    const nextDate = getNextOccurrenceDate(e as Expense, todayISO);
    if (!nextDate || nextDate !== targetDate) return [];
    return [
      {
        type: "renewal" as ReminderType,
        source_id: e.id,
        scheduled_for: buildDateTimeFromTime("09:00", todayISO),
        title: `Upcoming renewal: ${e.title}`,
        body: `Due in ${daysBefore} day${daysBefore === 1 ? "" : "s"}.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// §13: Birthday reminders
// ---------------------------------------------------------------------------

/**
 * Returns birthday reminders for YearEntry birthday entries whose birthday
 * (in the current year) is exactly `daysBefore` days from today.
 *
 * Driven from shared YearEntry records — no duplicate birthday records.
 */
export function computeBirthdayReminders(
  yearEntries: Pick<YearEntry, "id" | "title" | "type" | "start_date">[],
  daysBefore: number,
  todayISO: string,
): ReminderSchedule[] {
  const targetDate = addDays(todayISO, daysBefore);
  const targetYear = parseInt(targetDate.slice(0, 4), 10);

  return yearEntries.flatMap((entry) => {
    if (!isBirthdayEntry(entry as YearEntry)) return [];
    const birthdayThisYear = birthdayDateForYear(entry as YearEntry, targetYear);
    if (!birthdayThisYear || birthdayThisYear !== targetDate) return [];
    return [
      {
        type: "birthday" as ReminderType,
        source_id: entry.id,
        scheduled_for: buildDateTimeFromTime("09:00", todayISO),
        title: `Birthday: ${entry.title}`,
        body:
          daysBefore === 0
            ? `Today is ${entry.title}'s birthday!`
            : `${entry.title}'s birthday is in ${daysBefore} day${daysBefore === 1 ? "" : "s"}.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// §13: Travel upcoming reminders
// ---------------------------------------------------------------------------

/**
 * Returns travel reminders for YearEntry travel/away entries whose start_date
 * is exactly `daysBefore` days from today.
 *
 * Driven from shared YearEntry records — no duplicate travel records.
 */
export function computeTravelReminders(
  yearEntries: Pick<YearEntry, "id" | "title" | "type" | "start_date">[],
  daysBefore: number,
  todayISO: string,
): ReminderSchedule[] {
  const targetDate = addDays(todayISO, daysBefore);
  return yearEntries.flatMap((entry) => {
    if (!isTravelOrAway(entry as YearEntry)) return [];
    if (entry.start_date !== targetDate) return [];
    return [
      {
        type: "travel" as ReminderType,
        source_id: entry.id,
        scheduled_for: buildDateTimeFromTime("09:00", todayISO),
        title: `Travel upcoming: ${entry.title}`,
        body:
          daysBefore === 0
            ? `${entry.title} starts today.`
            : `${entry.title} starts in ${daysBefore} day${daysBefore === 1 ? "" : "s"}.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Spec §18.4: Activity (scheduled block) starting reminders
// ---------------------------------------------------------------------------

/**
 * Returns reminders for activity blocks whose start_at is within `minutesBefore` of `now`.
 * Fires reminderTime = start_at - minutesBefore. Skipped if the block is already
 * completed/cancelled/missed.
 */
export function computeActivityStartingReminders(
  instances: Pick<
    ScheduleInstance,
    "id" | "source_type" | "source_activity_id" | "start_at" | "status_snapshot"
  >[],
  activities: Pick<Activity, "id" | "title">[],
  minutesBefore: number,
  now: Date,
): ReminderSchedule[] {
  const activityTitleById = new Map(activities.map((a) => [a.id, a.title]));
  return instances.flatMap((i) => {
    if (i.source_type !== "activity" || !i.source_activity_id) return [];
    if (i.status_snapshot === "completed" || i.status_snapshot === "missed") return [];
    const startAt = new Date(i.start_at);
    const reminderTime = new Date(startAt.getTime() - minutesBefore * 60_000);
    if (reminderTime <= now) return [];
    const title = activityTitleById.get(i.source_activity_id);
    if (!title) return [];
    return [
      {
        type: "activity_starting" as ReminderType,
        source_id: i.id,
        scheduled_for: reminderTime,
        title: `Starting soon: ${title}`,
        body: `Scheduled block starts in ${minutesBefore} minute${minutesBefore === 1 ? "" : "s"}.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Spec §18.4: Activity (scheduled block) overdue reminders
// ---------------------------------------------------------------------------

/**
 * Returns "time passed" reminders for activity blocks whose end_at has passed but
 * status_snapshot is still upcoming/working — prompts the user to update status.
 * Fires at end_at + 1 minute (when the scheduler next picks them up).
 */
export function computeActivityOverdueReminders(
  instances: Pick<
    ScheduleInstance,
    "id" | "source_type" | "source_activity_id" | "end_at" | "status_snapshot"
  >[],
  activities: Pick<Activity, "id" | "title">[],
  now: Date,
): ReminderSchedule[] {
  const activityTitleById = new Map(activities.map((a) => [a.id, a.title]));
  return instances.flatMap((i) => {
    if (i.source_type !== "activity" || !i.source_activity_id) return [];
    if (i.status_snapshot !== "upcoming" && i.status_snapshot !== "working") return [];
    const endAt = new Date(i.end_at);
    // Fire once end has passed. Schedule at end_at itself; the scheduler will
    // filter out past-only reminders before dispatch.
    if (endAt > now) return [];
    const title = activityTitleById.get(i.source_activity_id);
    if (!title) return [];
    return [
      {
        type: "activity_overdue" as ReminderType,
        source_id: i.id,
        scheduled_for: endAt,
        title: `Block ended: ${title}`,
        body: "Update the status of this block.",
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Spec §13: Calendar event (appointment/other) upcoming reminders
// ---------------------------------------------------------------------------

/**
 * Returns reminders for calendar events of type 'appointment' or 'other' whose
 * start_at is within `minutesBefore` of `now`.
 * Meeting-type calendar events are handled by computeMeetingUpcomingReminders.
 */
export function computeEventUpcomingReminders(
  events: Pick<CalendarEvent, "id" | "title" | "event_type" | "start_at">[],
  minutesBefore: number,
  now: Date,
): ReminderSchedule[] {
  return events.flatMap((e) => {
    if (e.event_type !== "appointment" && e.event_type !== "other") return [];
    if (!e.start_at) return [];
    const startAt = new Date(e.start_at);
    const reminderTime = new Date(startAt.getTime() - minutesBefore * 60_000);
    if (reminderTime <= now) return [];
    return [
      {
        type: "event_upcoming" as ReminderType,
        source_id: e.id,
        scheduled_for: reminderTime,
        title: `Upcoming: ${e.title}`,
        body: `Starts in ${minutesBefore} minute${minutesBefore === 1 ? "" : "s"}.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Orchestrator: compute all reminders at once
// ---------------------------------------------------------------------------

export interface ComputeRemindersParams {
  prefs: Pick<
    ReminderPreference,
    | "eod_review_enabled"
    | "eod_review_time"
    | "morning_summary_enabled"
    | "morning_summary_time"
    | "meeting_reminder_minutes_before"
    | "birthday_reminder_days_before"
    | "travel_reminder_days_before"
    | "renewal_reminder_days_before"
    | "activity_starting_enabled"
    | "activity_reminder_minutes_before"
    | "activity_overdue_enabled"
    | "event_reminder_minutes_before"
  >;
  meetings: Pick<Meeting, "id" | "title" | "start_at" | "end_at" | "status" | "key_takeaways">[];
  expenses: Pick<Expense, "id" | "title" | "amount" | "expense_date" | "recurrence_rule">[];
  yearEntries: Pick<YearEntry, "id" | "title" | "type" | "start_date">[];
  scheduleInstances?: Pick<
    ScheduleInstance,
    "id" | "source_type" | "source_activity_id" | "start_at" | "end_at" | "status_snapshot"
  >[];
  activities?: Pick<Activity, "id" | "title">[];
  calendarEvents?: Pick<CalendarEvent, "id" | "title" | "event_type" | "start_at">[];
  todayISO: string;
  now: Date;
}

/**
 * Orchestrates all 7 reminder types from shared source records.
 * Returns a flat list of ReminderSchedule sorted by scheduled_for ascending.
 *
 * Spec §13: all reminders read from shared records — no duplicate reminder-owned copies.
 */
export function computeAllReminders(params: ComputeRemindersParams): ReminderSchedule[] {
  const {
    prefs,
    meetings,
    expenses,
    yearEntries,
    scheduleInstances = [],
    activities = [],
    calendarEvents = [],
    todayISO,
    now,
  } = params;

  const results: ReminderSchedule[] = [
    computeEodReminder(prefs, todayISO),
    computeMorningSummaryReminder(prefs, todayISO),
    ...computeMeetingUpcomingReminders(meetings, prefs.meeting_reminder_minutes_before, now),
    ...computeMeetingPassedReminders(meetings, now),
    ...computeRenewalReminders(expenses, prefs.renewal_reminder_days_before, todayISO),
    ...computeBirthdayReminders(yearEntries, prefs.birthday_reminder_days_before, todayISO),
    ...computeTravelReminders(yearEntries, prefs.travel_reminder_days_before, todayISO),
    ...(prefs.activity_starting_enabled
      ? computeActivityStartingReminders(
          scheduleInstances,
          activities,
          prefs.activity_reminder_minutes_before,
          now,
        )
      : []),
    ...(prefs.activity_overdue_enabled
      ? computeActivityOverdueReminders(scheduleInstances, activities, now)
      : []),
    ...computeEventUpcomingReminders(calendarEvents, prefs.event_reminder_minutes_before, now),
  ].filter((r): r is ReminderSchedule => r !== null);

  return results.sort((a, b) => a.scheduled_for.getTime() - b.scheduled_for.getTime());
}

// ---------------------------------------------------------------------------
// Deduplication helper (for reminder_instances log)
// ---------------------------------------------------------------------------

/**
 * Returns only reminders from the schedule that have not yet been fired,
 * based on the provided set of already-fired (type, source_id) pairs.
 *
 * Use this to prevent double-firing across page reloads.
 */
export function filterUnfiredReminders(
  reminders: ReminderSchedule[],
  fired: { reminder_type: string; source_id: string | null }[],
): ReminderSchedule[] {
  return reminders.filter((r) => {
    return !fired.some(
      (f) =>
        f.reminder_type === r.type &&
        (f.source_id ?? null) === (r.source_id ?? null),
    );
  });
}
