import type { Metadata } from "next";

import type { AnnualGoal, Project } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AnnualStrategiesView } from "@/components/annual-strategies/AnnualStrategiesView";

export const metadata: Metadata = { title: "Goals / Ideal Scene" };

/**
 * Spec §10.3: yearly outcome-based planning layer.
 * 3 sections (business, career, personal), manual progress, linked projects.
 *
 * Sync note: linked projects are found via projects.linked_annual_goal_id.
 * AnnualGoal never owns projects directly — the FK lives on projects.
 * Monthly Priorities (future) link here via monthly_priorities.linked_annual_goal_id.
 */
export default async function AnnualStrategiesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [goalsResult, projectsResult] = await Promise.all([
    supabase
      .from("annual_goals")
      .select("*")
      .eq("user_id", user!.id)
      .order("section", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("projects")
      .select("id, name, status, linked_annual_goal_id")
      .eq("user_id", user!.id)
      .order("name", { ascending: true }),
  ]);

  const goals = (goalsResult.data ?? []) as AnnualGoal[];
  const projects = (projectsResult.data ?? []) as Pick<
    Project,
    "id" | "name" | "status" | "linked_annual_goal_id"
  >[];

  return (
    <div className="flex h-full flex-col">
      <header className="hidden md:block border-b border-blue-100 px-8 py-5">
        <h1 className="font-handwriting text-2xl text-ink">Goals / Ideal Scene</h1>
        <p className="mt-0.5 text-xs text-ink-light">
          Your long-range goals and the ideal scene behind them — the &ldquo;why&rdquo; that makes a task an A.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto">
        <AnnualStrategiesView goals={goals} projects={projects} />
      </div>
    </div>
  );
}
