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

  const selectedDate = dateParam ?? localTodayForTimezone(timezone);

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
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", selectedDate)
      .eq("is_someday", false) // Phase 1B: someday items live only on the Someday screen
      .order("created_at", { ascending: true }),
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", previousDate)
      .eq("is_someday", false)
      .in("status", ["not_started", "postponed"]),
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
      priorityFilter={priorityFilter}
    />
  );
}
