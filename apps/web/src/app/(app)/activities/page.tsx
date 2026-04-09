import type { Metadata } from "next";

import { localTodayForTimezone } from "@pm/domain";
import type { Activity, Contact, Project } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActivitiesView } from "@/components/activities/ActivitiesView";

export const metadata: Metadata = { title: "Activities" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/**
 * Spec §10.5: Activities page — server component.
 * Date is controlled via ?date=YYYY-MM-DD search param (defaults to today).
 * Fetches: activities for selected date, previous day's carry-forward candidates,
 * and active projects for name display and form selects.
 *
 * Sync note: This page renders the same shared `activities` table used by
 * Project Planner. No duplication occurs — both tabs reference the same rows.
 */
export default async function ActivitiesPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware already handles redirect

  // Use user's stored timezone so the default date is correct for their local time
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "UTC";

  const { date: dateParam } = await searchParams;
  const selectedDate = dateParam ?? localTodayForTimezone(timezone);

  // Compute previous date (for carry-forward panel)
  const parts = selectedDate.split("-");
  const prevDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) - 1);
  const previousDate = prevDate.toISOString().slice(0, 10);

  const [
    { data: activities },
    { data: prevActivities },
    { data: projects },
    { data: contacts },
    { data: priorities },
  ] = await Promise.all([
    // Activities for selected date
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", selectedDate)
      .order("created_at", { ascending: true }),

    // Previous day's carry-forward eligible activities
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", previousDate)
      .in("status", ["not_started", "postponed"]),

    // Active projects for name display + form selects
    supabase
      .from("projects")
      .select("id, name, status, linked_monthly_priority_id")
      .eq("user_id", user.id)
      .not("status", "in", "(cancelled,completed)")
      .order("name", { ascending: true }),

    // Non-deleted contacts for delegation picker
    supabase
      .from("contacts")
      .select("id, full_name")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("full_name", { ascending: true }),

    // Monthly priorities for indicator badge
    supabase
      .from("monthly_priorities")
      .select("id, title")
      .eq("user_id", user.id),
  ]);

  // Build a map: project_id → monthly priority title (for indicator badge on activity cards)
  const priorityMap = new Map(
    (priorities ?? []).map((p: { id: string; title: string }) => [p.id, p.title]),
  );
  const projectPriorityMap = new Map(
    (projects ?? [])
      .filter((p: { linked_monthly_priority_id: string | null }) => p.linked_monthly_priority_id)
      .map((p: { id: string; linked_monthly_priority_id: string }) => [
        p.id,
        priorityMap.get(p.linked_monthly_priority_id) ?? null,
      ]),
  );

  return (
    <ActivitiesView
      activities={(activities ?? []) as Activity[]}
      carryForwardActivities={(prevActivities ?? []) as Activity[]}
      projects={(projects ?? []) as Pick<Project, "id" | "name" | "status">[]}
      contacts={(contacts ?? []) as Pick<Contact, "id" | "full_name">[]}
      selectedDate={selectedDate}
      previousDate={previousDate}
      projectPriorityMap={projectPriorityMap}
    />
  );
}
