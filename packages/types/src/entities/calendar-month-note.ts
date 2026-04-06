export interface CalendarMonthNote {
  id: string;
  user_id: string;
  /** "YYYY-MM" */
  month_key: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
