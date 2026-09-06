import { localTodayForTimezone } from "@pm/domain";
import type { Activity, Contact, Project } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActivitiesView } from "@/components/activities/ActivitiesView";

/**
 * Phase 0A: shared server component behind the two priority screens (A Activities / B Activities).
 * Fetches the day's activities (shared `activities` table — no duplication) and renders the view
 * filtered to the given priority. Date is controlled via ?date=YYYY-MM-DD (defaults to today).
 */
export async function ActivitiesScreen({
  priorityFilter,
  dateParam,
}: {
  priorityFilter: "A" | "B";
  dateParam?: string | undefined;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware already handles redirect

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "UTC";

  const today = localTodayForTimezone(timezone);
  const selectedDate = dateParam ?? today;
  const isToday = selectedDate === today;

  // Pending backlog: overdue-but-still-open activities across all past days.
  // Only surfaced on the Today view, so skip the query otherwise.
  const pendingQuery = isToday
    ? supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .lt("activity_date", today)
        .eq("is_someday", false)
        .eq("is_weekly", false)
        .eq("archived", false)
        .in("status", ["not_started", "working", "postponed"])
        .order("activity_date", { ascending: true })
    : Promise.resolve({ data: [] });

  const [
    { data: activities },
    { data: pending },
    { data: projects },
    { data: contacts },
    { data: priorities },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", selectedDate)
      .eq("is_someday", false) // Phase 1B: someday items live only on the Someday screen
      .eq("is_weekly", false) // weekly-pool items live only on the Weekly screen
      .order("created_at", { ascending: true }),
    pendingQuery,
    supabase
      .from("projects")
      .select("id, name, status, linked_monthly_priority_id")
      .eq("user_id", user.id)
      .not("status", "in", "(cancelled,completed)")
      .order("name", { ascending: true }),
    supabase
      .from("contacts")
      .select("id, full_name")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("full_name", { ascending: true }),
    supabase
      .from("monthly_priorities")
      .select("id, title")
      .eq("user_id", user.id),
  ]);

  const priorityMap = new Map(
    (priorities ?? []).map((p: { id: string; title: string }) => [
      p.id,
      p.title,
    ]),
  );
  const projectPriorityMap = new Map(
    (projects ?? [])
      .filter(
        (p: { linked_monthly_priority_id: string | null }) =>
          p.linked_monthly_priority_id,
      )
      .map((p: { id: string; linked_monthly_priority_id: string }) => [
        p.id,
        priorityMap.get(p.linked_monthly_priority_id) ?? null,
      ]),
  );

  return (
    <ActivitiesView
      activities={(activities ?? []) as Activity[]}
      pendingActivities={(pending ?? []) as Activity[]}
      projects={(projects ?? []) as Pick<Project, "id" | "name" | "status">[]}
      contacts={(contacts ?? []) as Pick<Contact, "id" | "full_name">[]}
      selectedDate={selectedDate}
      projectPriorityMap={projectPriorityMap}
      priorityFilter={priorityFilter}
    />
  );
}
