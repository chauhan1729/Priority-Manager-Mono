import type { Metadata } from "next";

import { ActivitiesScreen } from "@/components/activities/ActivitiesScreen";

export const metadata: Metadata = { title: "B Activities" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/** Phase 0A: B Activities screen — the "choose if you have time" bucket. Default for new activities. */
export default async function BPrioritiesPage({ searchParams }: Props) {
  const { date } = await searchParams;
  return <ActivitiesScreen priorityFilter="B" dateParam={date} />;
}
