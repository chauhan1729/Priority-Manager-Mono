import type {
  Activity,
  CalendarEvent,
  Expense,
  Meeting,
  ReminderPreference,
  ReminderType,
  ScheduleInstance,
  SixTimeConfig,
  SixTimeProblem,
  YearEntry,
} from "@pm/types";

import { getNextOccurrenceDate } from "../expense";
import { isSixTimeSetUp } from "../six-time";
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
    body: "Log updates on what's done and what's not — don't let progress go untracked.",
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
    body: "Review today's plan. Commit to what you'll focus on and complete.",
  };
}

// ---------------------------------------------------------------------------
// Phase 4 / 6: Six-Time Book reminders (one daily log + nightly review)
// ---------------------------------------------------------------------------

/**
 * Returns a single "log your Six-Time Book" nudge for today, if enabled + set up.
 * Fires at the configured daily_log_time.
 */
export function computeSixTimeDailyReminder(
  config: Pick<SixTimeConfig, "enabled" | "daily_log_time"> | null | undefined,
  problems: Pick<SixTimeProblem, "position" | "status" | "reminder_phrase">[],
  todayISO: string,
): ReminderSchedule | null {
  if (!config?.enabled || !isSixTimeSetUp(problems as SixTimeProblem[])) return null;
  return {
    type: "six_time_daily",
    source_id: null,
    scheduled_for: buildDateTimeFromTime(config.daily_log_time, todayISO),
    title: "Six-Time log",
    body: "Log today — a win, a slip, and a small to-do for each focus problem.",
  };
}

/** The nightly review reminder (top 3 best / worst), if enabled. */
export function computeSixTimeNightlyReminder(
  config: Pick<SixTimeConfig, "enabled" | "nightly_time"> | null | undefined,
  todayISO: string,
): ReminderSchedule | null {
  if (!config?.enabled) return null;
  return {
    type: "six_time_nightly",
    source_id: null,
    scheduled_for: buildDateTimeFromTime(config.nightly_time, todayISO),
    title: "Nightly review",
    body: "Review your day — top 3 best and worst, free of judgment. Focus on the good before sleep.",
  };
}

// ---------------------------------------------------------------------------
// Phase 5: daily giving reminder
// ---------------------------------------------------------------------------

/** A daily "give something + keep score" nudge, while a giving challenge is active. */
export function computeGivingReminder(
  prefs: Partial<Pick<ReminderPreference, "giving_reminder_enabled" | "giving_reminder_time">>,
  hasActiveChallenge: boolean,
  todayISO: string,
): ReminderSchedule | null {
  if (!prefs.giving_reminder_enabled || !hasActiveChallenge) return null;
  return {
    type: "giving_daily",
    source_id: null,
    scheduled_for: buildDateTimeFromTime(prefs.giving_reminder_time ?? "20:00", todayISO),
    title: "Give something today",
    body: "Give freely and cheerfully — then log what you gave and what you received.",
  };
}

// ---------------------------------------------------------------------------
// Phase 1B: weekly Someday-review reminder
// ---------------------------------------------------------------------------

/**
 * Returns the weekly Someday-review reminder if enabled and today is the configured weekday.
 * Fires at `someday_review_time`. Prompts the user to review the Someday list and pull items
 * into the 30-day horizon.
 */
export function computeSomedayReviewReminder(
  prefs: Partial<
    Pick<
      ReminderPreference,
      "someday_review_enabled" | "someday_review_weekday" | "someday_review_time"
    >
  >,
  todayISO: string,
): ReminderSchedule | null {
  if (!prefs.someday_review_enabled) return null;
  const weekday = new Date(`${todayISO}T12:00:00`).getDay(); // 0=Sun … 6=Sat
  if (weekday !== prefs.someday_review_weekday) return null;
  return {
    type: "weekly_someday_review",
    source_id: null,
    scheduled_for: buildDateTimeFromTime(prefs.someday_review_time ?? "09:00", todayISO),
    title: "Weekly review",
    body: "Review your Someday list — pull anything ready into the next 30 days.",
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
    // Emit until the meeting starts. scheduled_for = reminderTime works in BOTH
    // paths: the foreground fires it once due, and the outbox queues it while it's
    // still in the future (closed-app push). Only the upper bound (now < startAt)
    // matters — a lower bound would strand the future case out of the outbox.
    if (now >= startAt) return [];
    return [
      {
        type: "meeting_upcoming" as ReminderType,
        source_id: m.id,
        scheduled_for: reminderTime,
        title: m.title,
        body: `Meeting in ${minutesBefore} min. Show up fully, or reschedule and own it.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Phase 2B: "Prepare for meeting" reminders (N days before)
// ---------------------------------------------------------------------------

/**
 * Returns "prepare for meeting" reminders for upcoming meetings whose date is exactly
 * `daysBefore` days from today. Fires at 09:00 on the prep day. Driven from the shared
 * meetings record — no duplicate task.
 */
export function computeMeetingPrepReminders(
  // `date` optional so callers that don't yet supply it (e.g. mobile) still compile — they just
  // won't emit prep reminders until they pass the meeting date.
  meetings: (Pick<Meeting, "id" | "title" | "status"> & { date?: string | null })[],
  daysBefore: number,
  todayISO: string,
): ReminderSchedule[] {
  return meetings.flatMap((m) => {
    if (m.status !== "upcoming" || !m.date) return [];
    if (addDays(m.date, -daysBefore) !== todayISO) return [];
    return [
      {
        type: "meeting_prep" as ReminderType,
        source_id: m.id,
        scheduled_for: buildDateTimeFromTime("09:00", todayISO),
        title: `Prepare for: ${m.title}`,
        body:
          daysBefore === 1
            ? "Meeting tomorrow — prep your file, agenda, and questions."
            : `Meeting in ${daysBefore} days — prep your file, agenda, and questions.`,
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
    // No `end_at > now` guard: emit scheduled_for = end_at whether it's past or
    // future, so it fires in the foreground once the meeting ends AND queues for
    // closed-app push at end time. Mirrors computeActivityOverdueReminders.
    const needsTakeaway = !m.key_takeaways;
    return [
      {
        type: "meeting_passed" as ReminderType,
        source_id: m.id,
        scheduled_for: new Date(m.end_at),
        title: m.title,
        body: needsTakeaway
          ? "Meeting done — add takeaways and update status so nothing is lost."
          : "Meeting done — update the status so nothing is lost.",
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
        title: e.title,
        body: `Renewal in ${daysBefore} day${daysBefore === 1 ? "" : "s"}. Handle it or reschedule and own it.`,
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
            ? `Today is ${entry.title}'s birthday — reach out and make it count.`
            : `${entry.title}'s birthday in ${daysBefore} day${daysBefore === 1 ? "" : "s"} — plan something meaningful.`,
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
        title: entry.title,
        body:
          daysBefore === 0
            ? "Travel starts today — focus on what needs to happen."
            : `${daysBefore} day${daysBefore === 1 ? "" : "s"} away — prepare ahead or reschedule and own it.`,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Spec §18.4: Activity (scheduled block) starting reminders
// ---------------------------------------------------------------------------

/**
 * A schedule block is "settled" (no longer needs a start/overdue reminder) once it
 * is completed, missed, or postponed to another time.
 */
export function isTerminalScheduleStatus(
  status: ScheduleInstance["status_snapshot"],
): boolean {
  return status === "completed" || status === "missed" || status === "postponed";
}

/**
 * Returns reminders for activity blocks whose start_at is within `minutesBefore` of `now`.
 * Fires reminderTime = start_at - minutesBefore. Skipped if the block is already
 * completed/missed/postponed.
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
    if (isTerminalScheduleStatus(i.status_snapshot)) return [];
    const startAt = new Date(i.start_at);
    const reminderTime = new Date(startAt.getTime() - minutesBefore * 60_000);
    // Emit until the block starts (not "future-only") so the foreground fires it
    // once due AND the outbox queues it ahead of time for closed-app push.
    if (now >= startAt) return [];
    const title = activityTitleById.get(i.source_activity_id);
    if (!title) return [];
    return [
      {
        type: "activity_starting" as ReminderType,
        source_id: i.id,
        scheduled_for: reminderTime,
        title,
        body: "Focus and complete this cycle, or acknowledge, take responsibility, and move it to another time.",
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
    // Schedule the reminder at endAt for all non-terminal instances.
    // Mobile: future.filter keeps only endAt > now (schedules ahead of time).
    // Web: fireNewOverdueReminders fires when scheduled_for <= now (catches it after end).
    const title = activityTitleById.get(i.source_activity_id);
    if (!title) return [];
    return [
      {
        type: "activity_overdue" as ReminderType,
        source_id: i.id,
        scheduled_for: endAt,
        title,
        body: "Block ended — add an update so progress isn't lost and can be tracked.",
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
 *
 * Skipped when the event is settled — either the event row itself is
 * completed/cancelled/missed, or its day's schedule instance (where per-occurrence
 * status is marked from the Daily Plan) is completed/missed/postponed.
 */
export function computeEventUpcomingReminders(
  events: (Pick<CalendarEvent, "id" | "title" | "event_type" | "start_at"> & {
    status?: CalendarEvent["status"];
  })[],
  minutesBefore: number,
  now: Date,
  scheduleInstances: {
    source_event_id?: string | null;
    status_snapshot?: ScheduleInstance["status_snapshot"];
  }[] = [],
): ReminderSchedule[] {
  const settledEventIds = new Set(
    scheduleInstances
      .filter((i) => i.source_event_id && isTerminalScheduleStatus(i.status_snapshot ?? null))
      .map((i) => i.source_event_id as string),
  );
  return events.flatMap((e) => {
    if (e.event_type !== "appointment" && e.event_type !== "other") return [];
    if (!e.start_at) return [];
    if (e.status === "completed" || e.status === "cancelled" || e.status === "missed") return [];
    if (settledEventIds.has(e.id)) return [];
    const startAt = new Date(e.start_at);
    const reminderTime = new Date(startAt.getTime() - minutesBefore * 60_000);
    // Emit until the event starts so it fires in the foreground once due AND
    // queues in the outbox while still future (closed-app push).
    if (now >= startAt) return [];
    return [
      {
        type: "event_upcoming" as ReminderType,
        source_id: e.id,
        scheduled_for: reminderTime,
        title: e.title,
        body: "Focus and show up fully, or acknowledge, take responsibility, and reschedule.",
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Activity date-based nudges (Group D): due-today + past-due
// ---------------------------------------------------------------------------

/** Statuses that still need action (not finished / cancelled / handed off). */
function isActionableStatus(status: Activity["status"]): boolean {
  return status === "not_started" || status === "working" || status === "postponed";
}

type ActivityForNudge = Pick<
  Activity,
  "id" | "title" | "priority" | "activity_date" | "status" | "is_someday" | "is_weekly" | "archived"
>;

/**
 * Returns a nudge for each A-priority activity dated today that is still
 * actionable AND has no schedule block today — i.e. due today but not yet on
 * the timeline. Fires at `nudgeTime`. Someday/weekly-pool/archived items are excluded.
 */
export function computeActivityDueTodayReminders(
  activities: ActivityForNudge[],
  scheduleInstances: Pick<ScheduleInstance, "source_type" | "source_activity_id" | "schedule_date">[],
  nudgeTime: string,
  todayISO: string,
): ReminderSchedule[] {
  const scheduledTodayActivityIds = new Set(
    scheduleInstances
      .filter(
        (i) =>
          i.source_type === "activity" &&
          i.source_activity_id &&
          i.schedule_date === todayISO,
      )
      .map((i) => i.source_activity_id as string),
  );

  return activities.flatMap((a) => {
    if (a.archived || a.is_someday || a.is_weekly) return [];
    if (a.priority !== "A") return [];
    if (!isActionableStatus(a.status)) return [];
    if (a.activity_date !== todayISO) return [];
    if (scheduledTodayActivityIds.has(a.id)) return [];
    return [
      {
        type: "activity_due_today" as ReminderType,
        source_id: a.id,
        scheduled_for: buildDateTimeFromTime(nudgeTime, todayISO),
        title: a.title,
        body: "Due today and not scheduled — put it on the timeline or reschedule and own it.",
      },
    ];
  });
}

/**
 * Returns a nudge for each still-actionable activity whose date is in the past —
 * it slipped without being completed. Fires at `nudgeTime` today. Someday/weekly-pool/archived
 * items are excluded — a weekly item's date is a week anchor, not a due date. Repeats daily (localStorage/instance dedup fires it once/day)
 * until the activity is completed, cancelled, or rescheduled.
 */
export function computeActivityPastDueReminders(
  activities: ActivityForNudge[],
  nudgeTime: string,
  todayISO: string,
): ReminderSchedule[] {
  return activities.flatMap((a) => {
    if (a.archived || a.is_someday || a.is_weekly) return [];
    if (!isActionableStatus(a.status)) return [];
    if (a.activity_date >= todayISO) return [];
    return [
      {
        type: "activity_past_due" as ReminderType,
        source_id: a.id,
        scheduled_for: buildDateTimeFromTime(nudgeTime, todayISO),
        title: a.title,
        body: "Overdue — it slipped past its date. Finish it, reschedule, or cancel and own it.",
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
  > &
    // Phase 1B: optional so callers that haven't adopted these prefs yet (e.g. mobile) still compile.
    Partial<
      Pick<
        ReminderPreference,
        | "someday_review_enabled"
        | "someday_review_weekday"
        | "someday_review_time"
        | "meeting_prep_enabled"
        | "meeting_prep_days_before"
        | "giving_reminder_enabled"
        | "giving_reminder_time"
        | "activity_due_today_enabled"
        | "activity_past_due_enabled"
        | "activity_nudge_time"
      >
    >;
  meetings: (Pick<
    Meeting,
    "id" | "title" | "start_at" | "end_at" | "status" | "key_takeaways"
  > & { date?: string | null })[];
  expenses: Pick<Expense, "id" | "title" | "amount" | "expense_date" | "recurrence_rule">[];
  yearEntries: Pick<YearEntry, "id" | "title" | "type" | "start_date">[];
  scheduleInstances?: (Pick<
    ScheduleInstance,
    | "id"
    | "source_type"
    | "source_activity_id"
    | "start_at"
    | "end_at"
    | "status_snapshot"
    | "schedule_date"
  > & { source_event_id?: string | null })[];
  activities?: Pick<
    Activity,
    "id" | "title" | "priority" | "activity_date" | "status" | "is_someday" | "is_weekly" | "archived"
  >[];
  calendarEvents?: (Pick<CalendarEvent, "id" | "title" | "event_type" | "start_at"> & {
    status?: CalendarEvent["status"];
  })[];
  // Phase 4 / 6: optional so callers that haven't adopted Six-Time (e.g. mobile) still compile.
  sixTimeConfig?: Pick<SixTimeConfig, "enabled" | "daily_log_time" | "nightly_time"> | null;
  sixTimeProblems?: Pick<SixTimeProblem, "position" | "status" | "reminder_phrase">[];
  // Phase 5: whether a giving challenge is active (drives the daily giving reminder).
  hasActiveGivingChallenge?: boolean;
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
    sixTimeConfig = null,
    sixTimeProblems = [],
    hasActiveGivingChallenge = false,
    todayISO,
    now,
  } = params;

  const results: ReminderSchedule[] = [
    computeEodReminder(prefs, todayISO),
    computeMorningSummaryReminder(prefs, todayISO),
    computeSomedayReviewReminder(prefs, todayISO),
    ...computeMeetingUpcomingReminders(meetings, prefs.meeting_reminder_minutes_before, now),
    ...computeMeetingPassedReminders(meetings, now),
    ...(prefs.meeting_prep_enabled
      ? computeMeetingPrepReminders(meetings, prefs.meeting_prep_days_before ?? 1, todayISO)
      : []),
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
    ...computeEventUpcomingReminders(
      calendarEvents,
      prefs.event_reminder_minutes_before,
      now,
      scheduleInstances,
    ),
    computeSixTimeDailyReminder(sixTimeConfig, sixTimeProblems, todayISO),
    computeSixTimeNightlyReminder(sixTimeConfig, todayISO),
    computeGivingReminder(prefs, hasActiveGivingChallenge, todayISO),
    ...(prefs.activity_due_today_enabled
      ? computeActivityDueTodayReminders(
          activities,
          scheduleInstances,
          prefs.activity_nudge_time ?? "09:00",
          todayISO,
        )
      : []),
    ...(prefs.activity_past_due_enabled
      ? computeActivityPastDueReminders(activities, prefs.activity_nudge_time ?? "09:00", todayISO)
      : []),
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
