/**
 * Web Push outbox helpers.
 *
 * The browser computes reminders (in the user's real local timezone) and, for
 * the ones due within the sync horizon, writes rows into `push_outbox`. A cron
 * Edge Function later delivers whatever is due. These pure helpers translate a
 * computed ReminderSchedule[] into idempotent outbox rows — kept in the domain
 * package so the logic is shared and unit-tested rather than living in the UI.
 */

import type { ReminderType } from "@pm/types";

import type { ReminderSchedule } from "./index";

/** A row ready to upsert into `push_outbox` (user_id is added by the caller). */
export interface OutboxRowInput {
  dedup_key: string;
  reminder_type: ReminderType;
  source_id: string | null;
  scheduled_for: string; // ISO (UTC)
  title: string;
  body: string;
  silent: boolean;
  url: string;
}

/**
 * Stable idempotency key for a reminder occurrence. Same (type, source, instant)
 * → same key, so re-syncing the outbox never creates duplicates.
 */
export function outboxDedupKey(reminder: ReminderSchedule): string {
  return `${reminder.type}::${reminder.source_id ?? "null"}::${reminder.scheduled_for.toISOString()}`;
}

/**
 * Maps a reminder type to the in-app route its notification should open.
 * Falls back to the Daily Plan (the app's home screen).
 */
export function notificationRoute(type: ReminderType): string {
  switch (type) {
    case "meeting_upcoming":
    case "meeting_passed":
    case "meeting_prep":
      return "/meeting-planner";
    case "event_upcoming":
      return "/calendar";
    case "renewal":
      return "/expense-record";
    case "birthday":
    case "travel":
      return "/year-at-a-glance";
    case "six_time_slot":
    case "six_time_nightly":
      return "/six-time-book";
    case "giving_daily":
      return "/giving";
    case "weekly_someday_review":
      return "/someday";
    case "eod_review":
    case "morning_summary":
    case "activity_starting":
    case "activity_overdue":
    default:
      return "/daily-plan";
  }
}

/**
 * Builds outbox rows for reminders that should be delivered by the server while
 * the app is closed. Only *future* reminders within `horizonMs` are included:
 *  - already-due reminders are shown immediately by the foreground path, and
 *  - reminders beyond the horizon are queued on a later sync (when the user next
 *    opens the app), matching the app's "opens at least daily" assumption.
 *
 * @param soundEnabled  master sound switch → notifications are silent when false.
 */
export function buildOutboxRows(
  reminders: ReminderSchedule[],
  soundEnabled: boolean,
  now: Date = new Date(),
  horizonMs: number = 48 * 60 * 60 * 1000,
): OutboxRowInput[] {
  const horizonEnd = now.getTime() + horizonMs;
  return reminders
    .filter((r) => {
      const t = r.scheduled_for.getTime();
      return t > now.getTime() && t <= horizonEnd;
    })
    .map((r) => ({
      dedup_key: outboxDedupKey(r),
      reminder_type: r.type,
      source_id: r.source_id,
      scheduled_for: r.scheduled_for.toISOString(),
      title: r.title,
      body: r.body,
      silent: !soundEnabled,
      url: notificationRoute(r.type),
    }));
}
