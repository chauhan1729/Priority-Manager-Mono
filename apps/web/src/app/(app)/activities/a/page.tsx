import type { Metadata } from "next";

import { ActivitiesScreen } from "@/components/activities/ActivitiesScreen";

export const metadata: Metadata = { title: "A Activities" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/** Phase 0A: A Activities screen — the must-do-today bucket (schedulable in Daily Plan). */
export default async function APrioritiesPage({ searchParams }: Props) {
  const { date } = await searchParams;
  return <ActivitiesScreen priorityFilter="A" dateParam={date} />;
}
