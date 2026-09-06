export interface User {
  id: string;
  name: string;
  email: string;
  auth_provider: "email" | "google" | "apple";
  timezone: string;
  eod_review_time: string | null; // e.g. "21:00"
  last_weekly_review_date: string | null; // ISO date of the last completed weekly review
  created_at: string;
  updated_at: string;
}
