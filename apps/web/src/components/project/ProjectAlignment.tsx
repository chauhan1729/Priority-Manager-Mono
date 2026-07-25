"use client";

import { useTransition } from "react";

import { formatMonthLabel, SECTION_LABELS } from "@pm/domain";
import type { AnnualGoal, AnnualGoalSection, MonthlyPriority } from "@pm/types";
import {
  setProjectAnnualGoal,
  setProjectMonthlyPriority,
} from "@/app/(app)/project-planner/actions";
import { showToast } from "@/components/ui/Toaster";

type GoalOption = Pick<AnnualGoal, "id" | "section" | "title">;
type PriorityOption = Pick<MonthlyPriority, "id" | "title" | "month_key">;

interface Props {
  projectId: string;
  linkedGoalId: string | null;
  linkedPriorityId: string | null;
  goals: GoalOption[];
  priorities: PriorityOption[];
}

/**
 * Tag a project to an annual goal and/or a monthly priority from the project's
 * own screen. "— None —" unlinks. Saves immediately.
 */
export function ProjectAlignment({
  projectId,
  linkedGoalId,
  linkedPriorityId,
  goals,
  priorities,
}: Props) {
  const [isPending, start] = useTransition();

  function changeGoal(value: string) {
    start(async () => {
      const res = await setProjectAnnualGoal(projectId, value || null);
      if (res && "error" in res) showToast(res.error, "error");
      else showToast(value ? "Linked to goal" : "Unlinked from goal");
    });
  }

  function changePriority(value: string) {
    start(async () => {
      const res = await setProjectMonthlyPriority(projectId, value || null);
      if (res && "error" in res) showToast(res.error, "error");
      else showToast(value ? "Linked to priority" : "Unlinked from priority");
    });
  }

  return (
    <div className="rounded-xl border border-blue-50 bg-white p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-light">
        Alignment
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Annual goal */}
        <div>
          <label htmlFor="align-goal" className="mb-1.5 block text-xs font-medium text-ink-light">
            🎯 Annual goal
          </label>
          <select
            id="align-goal"
            value={linkedGoalId ?? ""}
            disabled={isPending}
            onChange={(e) => changeGoal(e.target.value)}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          >
            <option value="">— None —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {SECTION_LABELS[g.section as AnnualGoalSection]} · {g.title}
              </option>
            ))}
          </select>
        </div>

        {/* Monthly priority */}
        <div>
          <label htmlFor="align-priority" className="mb-1.5 block text-xs font-medium text-ink-light">
            📌 Monthly priority
          </label>
          <select
            id="align-priority"
            value={linkedPriorityId ?? ""}
            disabled={isPending}
            onChange={(e) => changePriority(e.target.value)}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          >
            <option value="">— None —</option>
            {priorities.map((p) => (
              <option key={p.id} value={p.id}>
                {formatMonthLabel(p.month_key)} · {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-light">
        Linking updates this project&apos;s record — no duplicates are created. Auto-progress
        priorities revert to manual when unlinked.
      </p>
    </div>
  );
}
