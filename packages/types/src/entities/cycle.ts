// Phase 1A: Work Cycles (tundruk-adjacent "complete a cycle" practice from the FOTW methodology).
// A Cycle is a completion-driven, COUNT-UP focus session against an activity — no countdown, no fixed
// pomodoro length. `soft_target_minutes` (from the activity estimate) is shown only as a hint.
// Reuses ScheduleInstance for timeline placement; a cycle optionally links to one.

export type CyclePhase = "focus" | "break" | "completed" | "abandoned";

export interface Cycle {
  id: string;
  user_id: string;
  activity_id: string; // FK → activities (shared source of truth)
  schedule_instance_id: string | null; // optional link to the timeline block
  soft_target_minutes: number | null; // informational target from activity.estimated_minutes; null if none
  elapsed_focus_minutes: number; // accumulated focus time from completed focus segments
  /** Anchor of the active focus segment (ISO datetime); null while on break / completed / abandoned. */
  segment_started_at: string | null;
  break_count: number; // mini-breaks taken
  phase: CyclePhase;
  started_at: string; // ISO datetime
  completed_at: string | null;
  note: string | null; // optional "what I got done" acknowledgment
  created_at: string;
  updated_at: string;
}
