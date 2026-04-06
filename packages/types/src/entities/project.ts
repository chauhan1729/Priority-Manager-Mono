export type ProjectStatus =
  | "planned"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type ResourceType =
  | "budget"
  | "employee"
  | "contractor"
  | "new_hire"
  | "tool_software"
  | "equipment"
  | "other";

export type ResourceStatus =
  | "needed"
  | "requested"
  | "approved"
  | "acquired"
  | "delayed"
  | "cancelled";

export type MilestoneStatus = "pending" | "completed" | "missed";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null; // ISO date
  target_end_date: string | null;
  linked_annual_goal_id: string | null;
  linked_monthly_priority_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  target_date: string | null;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectResource {
  id: string;
  project_id: string;
  resource_type: ResourceType;
  title: string;
  note: string | null;
  estimated_cost: number | null;
  status: ResourceStatus;
  assigned_contact_id: string | null;
  needed_by_date: string | null;
  created_at: string;
  updated_at: string;
}
