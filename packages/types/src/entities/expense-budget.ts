export interface ExpenseBudget {
  id: string;
  user_id: string;
  month: string; // "YYYY-MM"
  amount: number; // budget limit in the user's currency
  created_at: string;
  updated_at: string;
}
