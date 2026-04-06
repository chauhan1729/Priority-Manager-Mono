import { redirect } from "next/navigation";

/**
 * Spec §8: Daily Plan is the default home screen.
 * Root "/" just redirects — no landing page.
 */
export default function RootPage() {
  redirect("/daily-plan");
}
