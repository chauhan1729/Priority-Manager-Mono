import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import type { AnnualGoal, MonthlyPriority, Project } from "@pm/types";
import { getCurrentMonthKey, isValidMonthKey } from "@pm/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AnnualStrategiesView } from "@/components/annual-strategies/AnnualStrategiesView";
import { MonthlyPrioritiesView } from "@/components/monthly-priorities/MonthlyPrioritiesView";

export const metadata: Metadata = { title: "Goals / Ideal Scene" };

/**
 * Goals / Ideal Scene — a single hub with two tabs:
 *  - Annual  → yearly outcome goals (spec §10.3): 3 sections, manual progress, linked projects.
 *  - Monthly → monthly priorities (spec §10.4): 2 sections, up to 3 per section, carry-forward.
 *
 * The active tab lives in `?tab=`, and the month in `?month=`, so month navigation
 * (which pushes `?month=`) preserves the tab. Each tab fetches only its own data.
 *
 * Sync notes (data model unchanged):
 * - projects.linked_annual_goal_id → annual_goals (Annual tab)
 * - monthly_priorities.linked_annual_goal_id / linked_project_id, and
 *   projects.linked_monthly_priority_id (Monthly tab)
 */
export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const params = await searchParams;
  const tab: "annual" | "monthly" = params.tab === "monthly" ? "monthly" : "annual";
  const monthParam =
    typeof params.month === "string" && isValidMonthKey(params.month) ? params.month : undefined;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let content: ReactNode;

  if (tab === "annual") {
    const [goalsResult, projectsResult, prioritiesResult] = await Promise.all([
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
      // Monthly priorities linked to a goal — shown under each goal's detail panel.
      supabase
        .from("monthly_priorities")
        .select("id, title, month_key, linked_annual_goal_id")
        .eq("user_id", user!.id)
        .not("linked_annual_goal_id", "is", null)
        .order("month_key", { ascending: false }),
    ]);

    const goals = (goalsResult.data ?? []) as AnnualGoal[];
    const projects = (projectsResult.data ?? []) as Pick<
      Project,
      "id" | "name" | "status" | "linked_annual_goal_id"
    >[];
    const priorities = (prioritiesResult.data ?? []) as Pick<
      MonthlyPriority,
      "id" | "title" | "month_key" | "linked_annual_goal_id"
    >[];

    content = <AnnualStrategiesView goals={goals} projects={projects} priorities={priorities} />;
  } else {
    const monthKey = monthParam ?? getCurrentMonthKey();

    // Priorities for the selected month, pinned first.
    const { data: prioritiesData } = await supabase
      .from("monthly_priorities")
      .select("*")
      .eq("user_id", user!.id)
      .eq("month_key", monthKey)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: true });

    const priorities = (prioritiesData ?? []) as MonthlyPriority[];

    // Effective progress for auto_project priorities, computed from the linked
    // project's activities (spec §10.4).
    const autoProjectIds = priorities
      .filter((p) => p.progress_mode === "auto_project" && p.linked_project_id)
      .map((p) => p.linked_project_id!);

    const projectProgressMap: Record<string, number> = {};

    if (autoProjectIds.length > 0) {
      const { data: activities } = await supabase
        .from("activities")
        .select("linked_project_id, estimated_minutes, status")
        .in("linked_project_id", autoProjectIds)
        .eq("user_id", user!.id);

      const byProject: Record<string, { estimated: number; completed: number }> = {};
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
          stats.estimated === 0 ? 0 : Math.round((stats.completed / stats.estimated) * 100);
      }
    }

    // Annual goals (for the link modal) + projects (excluding cancelled).
    const [goalsData, projectsData] = await Promise.all([
      supabase
        .from("annual_goals")
        .select("id, section, title, status")
        .eq("user_id", user!.id)
        .order("section", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("projects")
        .select("id, name, status, linked_monthly_priority_id")
        .eq("user_id", user!.id)
        .neq("status", "cancelled")
        .order("name", { ascending: true }),
    ]);

    const annualGoals = (goalsData.data ?? []) as Pick<
      AnnualGoal,
      "id" | "section" | "title" | "status"
    >[];
    const projects = (projectsData.data ?? []) as Pick<
      Project,
      "id" | "name" | "status" | "linked_monthly_priority_id"
    >[];

    content = (
      <MonthlyPrioritiesView
        monthKey={monthKey}
        priorities={priorities}
        projectProgressMap={projectProgressMap}
        annualGoals={annualGoals}
        projects={projects}
      />
    );
  }

  const tabs = [
    {
      key: "annual",
      label: "Annual",
      title: "Annual Goals",
      subtitle: "Your long-range goals and the ideal scene behind them — the “why” that makes a task an A.",
      href: "/annual-strategies?tab=annual",
    },
    {
      key: "monthly",
      label: "Monthly",
      title: "Monthly Priorities",
      subtitle: "Your top 3 priorities per section this month — the concrete moves toward your goals.",
      href: `/annual-strategies?tab=monthly${monthParam ? `&month=${monthParam}` : ""}`,
    },
  ] as const;

  const active = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-blue-100 px-4 pt-4 md:px-8 md:pt-5">
        <div className="hidden md:block">
          <h1 className="font-handwriting text-2xl text-ink">{active.title}</h1>
          <p className="mt-0.5 text-xs text-ink-light">{active.subtitle}</p>
        </div>
        <nav className="mt-0 flex gap-1 md:mt-3">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-ink-light hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex-1 overflow-y-auto">{content}</div>
    </div>
  );
}
