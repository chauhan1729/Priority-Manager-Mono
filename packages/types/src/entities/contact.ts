export type ContactCategory =
  | "personal"
  | "professional"
  | "family"
  | "client"
  | "vendor"
  | "other";

export interface Contact {
  id: string;
  user_id: string;
  category: ContactCategory;
  full_name: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}
