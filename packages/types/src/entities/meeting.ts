export type MeetingStatus = "upcoming" | "completed" | "missed" | "cancelled";

export type MeetingRecurrenceRule = "daily" | "weekly" | "monthly" | null;

export interface Meeting {
  id: string;
  user_id: string;
  linked_contact_id: string;
  linked_calendar_event_id: string | null;
  title: string;
  date: string; // ISO date YYYY-MM-DD
  start_at: string; // ISO datetime
  end_at: string;
  duration_minutes: number;
  agenda: string;
  key_takeaways: string | null;
  recurrence_rule: MeetingRecurrenceRule;
  status: MeetingStatus;
  archived: boolean;
  created_at: string;
  updated_at: string;
}
