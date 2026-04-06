export type AnnualGoalSection = "business" | "career" | "personal";

export type AnnualGoalStatus =
  | "not_started"
  | "active"
  | "on_track"
  | "at_risk"
  | "completed"
  | "dropped";

export interface AnnualGoal {
  id: string;
  user_id: string;
  section: AnnualGoalSection;
  title: string;
  description: string;
  why_it_matters: string;
  target_date: string | null; // ISO date
  progress_percent: number; // 0–100, manual
  status: AnnualGoalStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
