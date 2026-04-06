export interface User {
  id: string;
  name: string;
  email: string;
  auth_provider: "email" | "google" | "apple";
  timezone: string;
  eod_review_time: string | null; // e.g. "21:00"
  created_at: string;
  updated_at: string;
}
