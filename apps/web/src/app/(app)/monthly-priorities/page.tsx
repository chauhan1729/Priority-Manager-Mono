import type { Metadata } from "next";

import type { AnnualGoal, MonthlyPriority, Project } from "@pm/types";
import { getCurrentMonthKey, isValidMonthKey } from "@pm/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MonthlyPrioritiesView } from "@/components/monthly-priorities/MonthlyPrioritiesView";

export const metadata: Metadata = { title: "Monthly Priorities" };

/**
 * Spec §10.4: 2 sections (business_career, personal), 3–5 per section,
 * carry-forward flow, section counter, inline status, auto/manual progress.
 *
 * Sync note:
 * - linked_annual_goal_id → annual_goals FK (ON DELETE SET NULL)
 * - linked_project_id → projects FK (ON DELETE SET NULL)
 * - When progress_mode='auto_project', effective progress is computed from
 *   the project's activities at page load and passed as projectProgressMap.
 */
export default async function MonthlyPrioritiesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const rawMonth = params.month;
  const monthKey =
    typeof rawMonth === "string" && isValidMonthKey(rawMonth)
      ? rawMonth
      : getCurrentMonthKey();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch priorities for the selected month, pinned first
  const { data: prioritiesData } = await supabase
    .from("monthly_priorities")
    .select("*")
    .eq("user_id", user!.id)
    .eq("month_key", monthKey)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: true });

  const priorities = (prioritiesData ?? []) as MonthlyPriority[];

  // Compute project progress for auto_project priorities
  // Spec §10.4: progress auto from linked project when linked
  const autoProjectIds = priorities
    .filter((p) => p.progress_mode === "auto_project" && p.linked_project_id)
    .map((p) => p.linked_project_id!);

  let projectProgressMap: Record<string, number> = {};

  if (autoProjectIds.length > 0) {
    const { data: activities } = await supabase
      .from("activities")
      .select("linked_project_id, estimated_minutes, status")
      .in("linked_project_id", autoProjectIds)
      .eq("user_id", user!.id);

    // Aggregate completed vs total minutes per project
    const byProject: Record<string, { estimated: number; completed: number }> =
      {};

    for (const a of activities ?? []) {
      if (!a.linked_project_id) continue;
      const pid = a.linked_project_id as string;
      if (!byProject[pid]) byProject[pid] = { estimated: 0, completed: 0 };
      byProject[pid]!.estimated += a.estimated_minutes as number;
      if (a.status === "completed") {
        byProject[pid]!.completed += a.estimated_minutes as number;
      }
    }

    for (const [pid, stats] of Object.entries(byProject)) {
      projectProgressMap[pid] =
        stats.estimated === 0
          ? 0
          : Math.round((stats.completed / stats.estimated) * 100);
    }
  }

  // Fetch annual goals for link modal (active only — archived goals unlinked by UX, not enforced)
  const { data: goalsData } = await supabase
    .from("annual_goals")
    .select("id, section, title, status")
    .eq("user_id", user!.id)
    .order("section", { ascending: true })
    .order("created_at", { ascending: true });

  // Fetch projects for link modal (exclude cancelled — linking to dead projects is unhelpful)
  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, name, status, linked_monthly_priority_id")
    .eq("user_id", user!.id)
    .neq("status", "cancelled")
    .order("name", { ascending: true });

  const annualGoals = (goalsData ?? []) as Pick<
    AnnualGoal,
    "id" | "section" | "title" | "status"
  >[];
  const projects = (projectsData ?? []) as Pick<
    Project,
    "id" | "name" | "status" | "linked_monthly_priority_id"
  >[];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-blue-100 px-8 py-5">
        <h1 className="font-handwriting text-2xl text-ink">Monthly Priorities</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <MonthlyPrioritiesView
          monthKey={monthKey}
          priorities={priorities}
          projectProgressMap={projectProgressMap}
          annualGoals={annualGoals}
          projects={projects}
        />
      </div>
    </div>
  );
}
