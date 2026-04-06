export type ScheduleSourceType = "activity" | "meeting" | "appointment" | "other";

export type ScheduleInstanceStatus =
  | "upcoming"
  | "working"
  | "completed"
  | "postponed"
  | "missed";

/**
 * Spec §17.12: ScheduleInstance — a timed block on the daily timeline.
 * Separate from Activity so one activity can have multiple partial schedule blocks.
 *
 * Polymorphic source via typed FK columns (not a single source_id):
 *   source_type = 'activity'              → source_activity_id is non-null
 *   source_type = 'meeting'               → source_meeting_id is non-null
 *   source_type = 'appointment' | 'other' → source_event_id is non-null
 */
export interface ScheduleInstance {
  id: string;
  user_id: string;
  source_type: ScheduleSourceType;
  source_activity_id: string | null;
  source_meeting_id: string | null;
  source_event_id: string | null;
  schedule_date: string; // ISO date YYYY-MM-DD
  start_at: string; // ISO datetime (UTC)
  end_at: string; // ISO datetime (UTC)
  locked_minutes: number;
  focus_minutes: number | null;
  status_snapshot: ScheduleInstanceStatus | null;
  keep_as_history: boolean;
  created_at: string;
  updated_at: string;
}
