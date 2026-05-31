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
  | "event_upcoming";

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
  currency_code: string; // ISO 4217 code, e.g. "USD" (app-wide display currency)
  created_at: string;
  updated_at: string;
}

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
