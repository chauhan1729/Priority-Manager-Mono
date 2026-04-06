export type CalendarEventType =
  | "meeting"
  | "appointment"
  | "birthday"
  | "renewal"
  | "other";

export type CalendarEventStatus = "upcoming" | "completed" | "cancelled" | "missed";

export type CalendarEventSourceType =
  | "calendar"
  | "meeting_planner"
  | "year_entry"
  | "expense_recurring";

export type RecurrenceRule = "daily" | "weekly" | "monthly" | null;

export interface CalendarEvent {
  id: string;
  user_id: string;
  event_type: CalendarEventType;
  title: string;
  date: string; // ISO date YYYY-MM-DD
  start_at: string | null; // ISO datetime
  end_at: string | null;
  duration_minutes: number | null;
  linked_contact_id: string | null;
  linked_project_id: string | null;
  linked_meeting_id: string | null;
  linked_year_entry_id: string | null;
  location: string | null;
  notes: string | null;
  recurrence_rule: RecurrenceRule;
  status: CalendarEventStatus;
  source_type: CalendarEventSourceType;
  linked_expense_id: string | null;
  created_at: string;
  updated_at: string;
}
