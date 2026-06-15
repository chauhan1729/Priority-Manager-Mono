import { redirect } from "next/navigation";

/**
 * Phase 0B (screen rationalization): Year at a Glance is folded into Calendar — birthdays/travel
 * surface there. This route now redirects; the underlying data/tables are unchanged.
 */
export default function YearAtAGlancePage() {
  redirect("/calendar");
}
