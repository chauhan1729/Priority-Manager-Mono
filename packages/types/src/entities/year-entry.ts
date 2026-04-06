export type YearEntryType = "travel" | "away" | "birthday";

export type AvailabilityStatus = "available" | "away" | "partial";

export interface YearEntry {
  id: string;
  user_id: string;
  type: YearEntryType;
  title: string;
  start_date: string; // ISO date YYYY-MM-DD
  end_date: string | null;
  location: string | null;
  note: string | null;
  availability_status: AvailabilityStatus | null;
  create_linked_trip_plan: boolean;
  linked_project_id: string | null;
  created_at: string;
  updated_at: string;
}
