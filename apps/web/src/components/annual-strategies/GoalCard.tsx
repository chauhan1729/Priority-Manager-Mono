"use client";

import { useState } from "react";
import Link from "next/link";

import type { AnnualGoal, AnnualGoalSection, AnnualGoalStatus, Project } from "@pm/types";
import { canLinkProject, isArchivedGoal, SECTION_LABELS, STATUS_LABELS } from "@pm/domain";

import { SECTION_COLORS } from "./AnnualStrategiesView";

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<AnnualGoalStatus, string> = {
  not_started: "bg-gray-100 text-gray-600",
  active: "bg-blue-100 text-blue-700",
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-red-100 text-red-600",
  completed: "bg-emerald-100 text-emerald-700",
  dropped: "bg-gray-100 text-gray-500",
};

// ---------------------------------------------------------------------------

type ProjectSummary = Pick<Project, "id" | "name" | "status" | "linked_annual_goal_id">;

interface Props {
  goal: AnnualGoal;
  linkedProjects: ProjectSummary[];
  onSelect: () => void;
  onProgressUpdate: (value: number) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------

export function GoalCard({ goal, linkedProjects, onSelect, onProgressUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [localProgress, setLocalProgress] = useState(goal.progress_percent);
  const colors = SECTION_COLORS[goal.section as AnnualGoalSection];
  const archived = isArchivedGoal(goal);

  function handleProgressBlur() {
    setEditing(false);
    const clamped = Math.max(0, Math.min(100, Math.round(localProgress)));
    if (clamped !== goal.progress_percent) {
      onProgressUpdate(clamped);
    }
  }

  function handleProgressKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setLocalProgress(goal.progress_percent);
      setEditing(false);
    }
  }

  return (
    <div
      className={`group flex flex-col rounded-xl border bg-white shadow-sm transition hover:shadow-md ${colors.border} ${archived ? "opacity-70" : ""}`}
    >
      {/* Clickable header area */}
      <button
        onClick={onSelect}
        className="flex-1 p-5 text-left"
        type="button"
      >
        {/* Status + target date row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[goal.status]}`}>
            {STATUS_LABELS[goal.status]}
          </span>
          {goal.target_date && (
            <span className="text-xs text-ink-light">{formatDate(goal.target_date)}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-handwriting text-lg text-ink group-hover:text-blue-700 leading-snug">
          {goal.title}
        </h3>

        {/* Why it matters preview */}
        {goal.why_it_matters && (
          <p className="mt-1.5 text-xs text-ink-light line-clamp-2 italic">
            "{goal.why_it_matters}"
          </p>
        )}

        {/* Description preview */}
        {goal.description && !goal.why_it_matters && (
          <p className="mt-1.5 text-xs text-ink-light line-clamp-2">{goal.description}</p>
        )}
      </button>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between text-xs text-ink-light mb-1">
          <span>Progress</span>
          {editing ? (
            <input
              type="number"
              min={0}
              max={100}
              value={localProgress}
              onChange={(e) => setLocalProgress(Number(e.target.value))}
              onBlur={handleProgressBlur}
              onKeyDown={handleProgressKey}
              className="w-14 rounded border border-blue-300 px-1.5 py-0.5 text-xs text-right text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              title="Click to edit progress"
              onClick={(e) => {
                e.stopPropagation();
                if (!archived) setEditing(true);
              }}
              disabled={archived}
              className="font-medium text-ink hover:text-blue-600 disabled:cursor-default"
            >
              {goal.progress_percent}%
            </button>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-50">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${goal.progress_percent}%` }}
          />
        </div>
      </div>

      {/* Linked projects preview */}
      {linkedProjects.length > 0 && (
        <div className="border-t border-blue-50 px-5 py-3">
          <p className="text-xs text-ink-light mb-1.5 font-medium">Linked projects</p>
          <div className="flex flex-wrap gap-1.5">
            {linkedProjects.slice(0, 3).map((p) => (
              <Link
                key={p.id}
                href={`/project-planner/${p.id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 hover:bg-blue-100 transition"
              >
                {p.name}
              </Link>
            ))}
            {linkedProjects.length > 3 && (
              <span className="rounded-full bg-gray-50 px-2.5 py-0.5 text-xs text-ink-light">
                +{linkedProjects.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Monthly alignment hint — shown only when no monthly priority yet (architecture placeholder) */}
      {!archived && canLinkProject(goal) && linkedProjects.length === 0 && (
        <div className="border-t border-blue-50 px-5 py-2.5">
          <p className="text-xs text-ink-light italic">No projects linked yet</p>
        </div>
      )}
    </div>
  );
}
