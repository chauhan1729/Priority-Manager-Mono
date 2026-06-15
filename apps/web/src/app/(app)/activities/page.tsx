import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/**
 * Phase 0A: Activities split into two screens (A Activities / B Activities).
 * The old /activities route now redirects to the A screen, preserving the date param.
 */
export default async function ActivitiesPage({ searchParams }: Props) {
  const { date } = await searchParams;
  redirect(date ? `/activities/a?date=${date}` : "/activities/a");
}
