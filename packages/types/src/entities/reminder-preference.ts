export type ReminderType =
  | "eod_review"
  | "meeting_upcoming"
  | "meeting_passed"
  | "renewal"
  | "birthday"
  | "travel"
  | "morning_summary"
  | "activity_starting"
  | "activity_overdue"
  | "event_upcoming"
  | "weekly_someday_review"
  | "meeting_prep"
  | "six_time_slot"
  | "six_time_nightly"
  | "giving_daily";

export interface ReminderPreference {
  id: string;
  user_id: string;
  eod_review_enabled: boolean;
  eod_review_time: string; // "HH:MM"
  meeting_reminder_minutes_before: number;
  morning_summary_enabled: boolean;
  morning_summary_time: string; // "HH:MM"
  birthday_reminder_days_before: number;
  travel_reminder_days_before: number;
  renewal_reminder_days_before: number;
  // Activity (scheduled block) reminders
  activity_starting_enabled: boolean;
  activity_reminder_minutes_before: number;
  activity_overdue_enabled: boolean;
  // Calendar event (appointment/other) reminders
  event_reminder_minutes_before: number;
  // Phase 1B: weekly Someday-list review
  someday_review_enabled: boolean;
  someday_review_weekday: number; // 0=Sunday … 6=Saturday
  someday_review_time: string; // "HH:MM"
  // Phase 2B: "prepare for meeting" reminder, N days before
  meeting_prep_enabled: boolean;
  meeting_prep_days_before: number;
  // Phase 3A: recommended buffer (minutes) before a meeting to keep free
  meeting_buffer_minutes: number;
  // Phase 5: daily giving reminder
  giving_reminder_enabled: boolean;
  giving_reminder_time: string; // "HH:MM"
  currency_code: string; // ISO 4217 code, e.g. "USD" (app-wide display currency)
  // Notification sound (web): foreground tone choice + master on/off.
  // Background push cannot carry a custom sound file (browser limitation); the
  // enabled flag toggles the OS notification sound via the push `silent` field.
  notification_sound: NotificationSound;
  notification_sound_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Foreground notification tones, synthesized in-browser via the Web Audio API. */
export type NotificationSound = "chime" | "bell" | "ding" | "none";

export interface ReminderInstance {
  id: string;
  user_id: string;
  reminder_type: ReminderType;
  source_id: string | null; // meeting_id, year_entry_id, expense_id, etc.
  scheduled_for: string; // ISO datetime
  fired_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}
