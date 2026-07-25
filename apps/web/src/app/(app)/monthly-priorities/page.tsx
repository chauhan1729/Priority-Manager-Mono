import { redirect } from "next/navigation";

/**
 * Monthly Priorities now lives on the Goals / Ideal Scene hub as the "Monthly" tab.
 * This legacy route redirects there so any lingering links stay coherent. The
 * underlying data/tables are unchanged.
 */
export default function MonthlyPrioritiesPage() {
  redirect("/annual-strategies?tab=monthly");
}
