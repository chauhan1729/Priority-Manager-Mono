export type ActivitySection = "work" | "outside" | "delegated" | "unplanned";

// Phase 0A: priority is mandatory — every activity is an A or a B ("everything is a B").
// The DB enforces NOT NULL DEFAULT 'B'; no null rows exist.
export type ActivityPriority = "A" | "B";

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
  // Phase 1B: parked outside the 30-day horizon ("someday" list, reviewed weekly). Someday items
  // are exempt from the work→project requirement until pulled into the horizon.
  is_someday: boolean;
  recurrence_rule: ActivityRecurrenceRule | null; // optional repeating pattern
  created_at: string;
  updated_at: string;
}
