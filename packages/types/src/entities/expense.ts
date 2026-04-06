export type ExpenseCategory =
  | "personal"
  | "business"
  | "travel"
  | "food"
  | "transport"
  | "subscriptions"
  | "household"
  | "other";

export interface Expense {
  id: string;
  user_id: string;
  title: string;
  merchant_payee: string | null;
  amount: number;
  expense_date: string; // ISO date YYYY-MM-DD
  category: ExpenseCategory;
  payment_method: string | null;
  note: string | null;
  linked_project_id: string | null;
  linked_contact_id: string | null;
  linked_year_entry_id: string | null;
  recurrence_rule: "daily" | "weekly" | "monthly" | null;
  created_at: string;
  updated_at: string;
}
