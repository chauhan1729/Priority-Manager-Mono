import type { Metadata } from "next";

import type { Project, YearEntry } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { YearAtAGlanceView } from "@/components/year-at-a-glance/YearAtAGlanceView";

export const metadata: Metadata = { title: "Year at a Glance" };

interface Props {
  searchParams: Promise<{ year?: string }>;
}

/**
 * Spec §10.1: Year at a Glance — server component.
 * Year is controlled via ?year=YYYY search param (defaults to current year).
 *
 * Fetches in parallel:
 *   - All year_entries for the user (birthdays use annual recurrence, so no year filter)
 *   - Active projects for linked trip plan display
 *
 * Sync note: createYearEntry/updateYearEntry/deleteYearEntry all revalidatePath("/calendar")
 * so Calendar birthday chips and away overlays stay current after any mutation here.
 */
export default async function YearAtAGlancePage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;

  // Validate parsed year
  const safeYear = isNaN(year) || year < 1900 || year > 2100 ? currentYear : year;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: yearEntries }, { data: projects }] = await Promise.all([
    // All year entries — no year filter because:
    // - Birthdays are annual (stored with original year, displayed in every year)
    // - Travel/away entries spanning year boundaries need to be shown in both years
    supabase
      .from("year_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: true }),

    // Active projects for linked trip plan name display
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .not("status", "in", "(cancelled,completed)")
      .order("name", { ascending: true }),
  ]);

  return (
    <YearAtAGlanceView
      yearEntries={(yearEntries ?? []) as YearEntry[]}
      projects={(projects ?? []) as Pick<Project, "id" | "name" | "status">[]}
      year={safeYear}
      currentYear={currentYear}
    />
  );
}
