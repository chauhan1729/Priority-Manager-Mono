"use client";

import Link from "next/link";

import type { ProjectStatus } from "@pm/types";
import type { ProjectWithMetrics } from "@/app/(app)/project-planner/page";

// ---------------------------------------------------------------------------
// Shared status helpers (also used by ProjectForm, ProjectDetail)
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_CLASSES: Record<ProjectStatus, string> = {
  planned: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface Props {
  project: ProjectWithMetrics;
}

export function ProjectCard({ project }: Props) {
  const { metrics, atRisk, nextTaskTitle, nextTaskDate } = project;

  return (
    <Link
      href={`/project-planner/${project.id}`}
      className="group flex flex-col rounded-xl border border-blue-100 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md overflow-hidden min-w-0"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-handwriting text-lg text-ink group-hover:text-blue-700 truncate">
            {project.name}
          </h2>
          {project.description && (
            <p className="mt-0.5 text-xs text-ink-light line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 flex-wrap justify-end">
          {atRisk && (
            <span
              title="At risk"
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
            >
              ⚠
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[project.status]}`}
          >
            {STATUS_LABELS[project.status]}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-ink-light mb-1">
          <span>Progress</span>
          <span className="font-medium text-ink">{metrics.progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-50">
          <div
            className={`h-full rounded-full transition-all ${atRisk ? "bg-amber-400" : "bg-blue-500"}`}
            style={{ width: `${metrics.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Metrics row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-ink-light">
        <span>
          <strong className="text-ink">{metrics.completedTasks}</strong>/{metrics.totalTasks} tasks
        </span>
        <span>
          <strong className="text-ink">{metrics.completedHours}h</strong>/{metrics.totalEstimatedHours}h
        </span>
      </div>

      {/* Next upcoming task */}
      {nextTaskTitle && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50/50 px-3 py-1.5">
          <span className="text-xs text-ink-light flex-shrink-0">Next</span>
          <span className="flex-1 text-xs text-ink truncate">{nextTaskTitle}</span>
          {nextTaskDate && (
            <span className="flex-shrink-0 text-xs text-ink-light">{formatShortDate(nextTaskDate)}</span>
          )}
        </div>
      )}

      {/* Date range + linked priority */}
      <div className="mt-3 border-t border-blue-50 pt-3 text-xs text-ink-light space-y-1">
        {(project.start_date ?? project.target_end_date) && (
          <div>{formatDate(project.start_date)} → {formatDate(project.target_end_date)}</div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-violet-400">📌</span>
          {project.linkedPriorityTitle ? (
            <span className="text-violet-700 max-w-[16rem] truncate">
              {project.linkedPriorityTitle}
            </span>
          ) : (
            <span className="italic text-ink-light/60">Not a monthly priority</span>
          )}
        </div>
      </div>
    </Link>
  );
}
