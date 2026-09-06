"use client";

import { useTransition } from "react";

import type { Project } from "@pm/types";
import { setActivityProject } from "@/app/(app)/activities/actions";
import { showToast } from "@/components/ui/Toaster";

const PROJECT_NAME_MAX = 22;

/**
 * A native select popup sizes itself to its longest option, so one long project
 * name widens the popup past a narrow viewport. Cap the label; the option value
 * is the project id, so nothing is lost.
 */
export function truncateProjectName(name: string): string {
  return name.length > PROJECT_NAME_MAX
    ? `${name.slice(0, PROJECT_NAME_MAX - 1).trimEnd()}…`
    : name;
}

/**
 * Set the project on an item parked on Someday or in the weekly pool. Both lists defer the
 * work→project requirement, so this is how an item satisfies it before being given a day.
 */
export function ParkedProjectPicker({
  activityId,
  projectId,
  projects,
}: {
  activityId: string;
  projectId: string | null;
  projects: Pick<Project, "id" | "name" | "status">[];
}) {
  const [isPending, startTransition] = useTransition();

  if (projects.length === 0) return null;

  return (
    <label className="mt-1 flex items-center gap-1 text-xs text-ink-light">
      <span aria-hidden="true">📁</span>
      <span className="sr-only">Project</span>
      <select
        value={projectId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value || null;
          startTransition(async () => {
            const res = await setActivityProject(activityId, next);
            if (res?.error) showToast(res.error, "error");
            else showToast(next ? "Project linked" : "Project cleared");
          });
        }}
        className="min-w-0 max-w-full truncate rounded border border-transparent bg-transparent py-0.5 text-xs text-ink-light hover:border-blue-100 hover:bg-blue-50/40 focus:border-blue-400 focus:outline-none disabled:opacity-50"
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {truncateProjectName(p.name)}
          </option>
        ))}
      </select>
    </label>
  );
}
