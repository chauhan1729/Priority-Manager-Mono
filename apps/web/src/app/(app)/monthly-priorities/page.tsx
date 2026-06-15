import { redirect } from "next/navigation";

/**
 * Phase 0B/1B (screen rationalization): Monthly Priorities is merged into the 30-day horizon +
 * Someday list. This route now redirects to Someday; the underlying data/tables are unchanged.
 */
export default function MonthlyPrioritiesPage() {
  redirect("/someday");
}
