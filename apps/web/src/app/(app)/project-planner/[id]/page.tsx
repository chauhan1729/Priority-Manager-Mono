import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { isProjectAtRisk } from "@pm/domain";
import type { Activity, Contact, Project, ProjectMilestone, ProjectResource } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProjectDetail } from "@/components/project/ProjectDetail";

export const metadata: Metadata = { title: "Project Detail" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [projectResult, activitiesResult, milestonesResult, resourcesResult, allProjectsResult, contactsResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .eq("user_id", user!.id)
        .single(),
      supabase
        .from("activities")
        .select("*")
        .eq("linked_project_id", id)
        .eq("user_id", user!.id)
        .order("activity_date", { ascending: true }),
      supabase
        .from("project_milestones")
        .select("*")
        .eq("project_id", id)
        .order("target_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("project_resources")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("projects")
        .select("id, name, status")
        .eq("user_id", user!.id)
        .not("status", "in", "(cancelled,completed)")
        .order("name", { ascending: true }),
      supabase
        .from("contacts")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .eq("is_deleted", false)
        .order("full_name", { ascending: true }),
    ]);

  if (!projectResult.data) notFound();

  const project = projectResult.data as Project;

  // Fetch linked annual goal and monthly priority names (for overview display)
  const [annualGoalResult, monthlyPriorityResult] = await Promise.all([
    project.linked_annual_goal_id
      ? supabase
          .from("annual_goals")
          .select("title")
          .eq("id", project.linked_annual_goal_id)
          .single()
      : Promise.resolve({ data: null }),
    project.linked_monthly_priority_id
      ? supabase
          .from("monthly_priorities")
          .select("title")
          .eq("id", project.linked_monthly_priority_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const activities = (activitiesResult.data ?? []) as Activity[];
  const atRisk = isProjectAtRisk(project, activities);

  // Next upcoming task: earliest future activity not yet completed
  const today = new Date().toISOString().slice(0, 10);
  const nextTask = activities
    .filter((a) => a.status !== "completed" && a.status !== "cancelled" && a.activity_date >= today)
    .sort((a, b) => a.activity_date.localeCompare(b.activity_date))[0] ?? null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-blue-100 px-8 py-4">
        <Link
          href="/project-planner"
          className="text-sm text-ink-light transition hover:text-blue-600"
        >
          ← Projects
        </Link>
        <h1 className="font-handwriting text-2xl text-ink">{project.name}</h1>
        {atRisk && (
          <span
            className="ml-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
            title="Project is at risk"
          >
            ⚠ At risk
          </span>
        )}
      </header>
      <div className="flex-1 overflow-y-auto">
        <ProjectDetail
          project={project}
          activities={activities}
          milestones={(milestonesResult.data ?? []) as ProjectMilestone[]}
          resources={(resourcesResult.data ?? []) as ProjectResource[]}
          allProjects={(allProjectsResult.data ?? []) as Pick<Project, "id" | "name" | "status">[]}
          contacts={(contactsResult.data ?? []) as Pick<Contact, "id" | "full_name">[]}
          linkedGoalTitle={
            (annualGoalResult.data as { title?: string } | null)?.title ?? null
          }
          linkedPriorityTitle={
            (monthlyPriorityResult.data as { title?: string } | null)?.title ?? null
          }
          atRisk={atRisk}
          nextTask={nextTask}
        />
      </div>
    </div>
  );
}
