import type { Metadata } from "next";

import { getProjectMetrics, isProjectAtRisk } from "@pm/domain";
import type { Activity, Project } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProjectList } from "@/components/project/ProjectList";

export const metadata: Metadata = { title: "Project Planner" };

/** Activity shape needed for metrics + next-task computation on the list page. */
export type ActivitySummary = Pick<
  Activity,
  "id" | "linked_project_id" | "status" | "estimated_minutes" | "title" | "activity_date"
>;

/** Pre-computed metrics + next task, passed into each ProjectCard. */
export type ProjectWithMetrics = Project & {
  metrics: ReturnType<typeof getProjectMetrics>;
  atRisk: boolean;
  nextTaskTitle: string | null;
  nextTaskDate: string | null;
};

export default async function ProjectPlannerPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);

  const [projectsResult, activitiesResult] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("id, linked_project_id, status, estimated_minutes, title, activity_date")
      .eq("user_id", user!.id)
      .not("linked_project_id", "is", null),
  ]);

  const projects = (projectsResult.data ?? []) as Project[];
  const activities = (activitiesResult.data ?? []) as ActivitySummary[];

  // Pre-compute metrics per project (domain layer)
  const projectsWithMetrics: ProjectWithMetrics[] = projects.map((p) => {
    const linked = activities.filter((a) => a.linked_project_id === p.id);

    // Next upcoming task: earliest future non-completed activity
    const nextTask = linked
      .filter((a) => a.status !== "completed" && a.status !== "cancelled" && a.activity_date >= today)
      .sort((a, b) => a.activity_date.localeCompare(b.activity_date))[0];

    return {
      ...p,
      metrics: getProjectMetrics(linked as Activity[]),
      atRisk: isProjectAtRisk(p, linked as Activity[]),
      nextTaskTitle: nextTask?.title ?? null,
      nextTaskDate: nextTask?.activity_date ?? null,
    };
  });

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-blue-100 px-8 py-5">
        <h1 className="font-handwriting text-2xl text-ink">Project Planner</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <ProjectList projects={projectsWithMetrics} />
      </div>
    </div>
  );
}
