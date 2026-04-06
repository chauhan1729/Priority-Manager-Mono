export type MonthlyPrioritySection = "business_career" | "personal";

export type MonthlyPriorityStatus =
  | "planned"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "dropped";

export type ProgressMode = "manual" | "auto_project";

export interface MonthlyPriority {
  id: string;
  user_id: string;
  section: MonthlyPrioritySection;
  title: string;
  category: string | null;
  started_date: string | null; // ISO date
  assigned_date: string | null;
  target_date: string | null;
  linked_annual_goal_id: string | null;
  linked_project_id: string | null;
  progress_mode: ProgressMode;
  manual_progress_percent: number | null; // 0–100
  status: MonthlyPriorityStatus;
  note: string | null;
  pinned: boolean;
  month_key: string; // e.g. "2026-04"
  created_at: string;
  updated_at: string;
}
