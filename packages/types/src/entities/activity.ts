export type ActivitySection = "work" | "outside" | "delegated" | "unplanned";

export type ActivityPriority = "A" | "B" | null;

export type ActivityStatus =
  | "not_started"
  | "working"
  | "completed"
  | "postponed"
  | "delegated"
  | "cancelled";

export type ActivityOriginType = "manual" | "project" | "carry_forward";

export type ActivityRecurrenceRule = "daily" | "weekly" | "monthly";

export interface Activity {
  id: string;
  user_id: string;
  section_type: ActivitySection;
  title: string;
  priority: ActivityPriority;
  activity_date: string; // ISO date YYYY-MM-DD
  estimated_minutes: number;
  remaining_minutes: number;
  status: ActivityStatus;
  linked_project_id: string | null;
  delegated_contact_id: string | null;
  note: string | null;
  origin_type: ActivityOriginType | null;
  moved_from_date: string | null; // ISO date, set when carried forward
  hours_worked: number; // cumulative minutes spent in completed schedule blocks
  archived: boolean;
  recurrence_rule: ActivityRecurrenceRule | null; // optional repeating pattern
  created_at: string;
  updated_at: string;
}
