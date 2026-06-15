import { redirect } from "next/navigation";

/**
 * Phase 0B (screen rationalization): Expense Record is off-methodology (the FOTW system tracks a
 * finance-awareness ritual, not expense budgeting). The screen is cut from the app surface; this route
 * redirects. Underlying expense data/tables are unchanged (full removal is a later, data-export step).
 */
export default function ExpenseRecordPage() {
  redirect("/daily-plan");
}
