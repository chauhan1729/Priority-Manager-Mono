"use client";

import { useState } from "react";
import Link from "next/link";

import type { AnnualGoal, AnnualGoalSection, AnnualGoalStatus, MonthlyPriority, Project } from "@pm/types";
import { canLinkProject, formatMonthLabel, isArchivedGoal, SECTION_LABELS, STATUS_LABELS } from "@pm/domain";

import { SECTION_COLORS } from "./AnnualStrategiesView";

// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<AnnualGoalStatus, string> = {
  not_started: "bg-gray-100 text-gray-600",
  active: "bg-blue-100 text-blue-700",
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-red-100 text-red-600",
  completed: "bg-emerald-100 text-emerald-700",
  dropped: "bg-gray-100 text-gray-500",
};

type ProjectSummary = Pick<Project, "id" | "name" | "status" | "linked_annual_goal_id">;
type PrioritySummary = Pick<MonthlyPriority, "id" | "title" | "month_key">;

interface Props {
  goal: AnnualGoal;
  linkedProjects: ProjectSummary[];
  /** Monthly priorities whose linked_annual_goal_id is this goal. */
  linkedPriorities: PrioritySummary[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenLinkModal: () => void;
  onUnlink: (projectId: string) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------

export function GoalDetailPanel({
  goal,
  linkedProjects,
  linkedPriorities,
  onClose,
  onEdit,
  onDelete,
  onOpenLinkModal,
  onUnlink,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const colors = SECTION_COLORS[goal.section as AnnualGoalSection];
  const archived = isArchivedGoal(goal);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl sm:rounded-l-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-blue-100 px-6 py-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}>
                {SECTION_LABELS[goal.section as AnnualGoalSection]}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[goal.status]}`}>
                {STATUS_LABELS[goal.status]}
              </span>
            </div>
            <h2 className="font-handwriting text-xl text-ink leading-snug">{goal.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="mt-1 rounded-full p-1 text-ink-light hover:bg-blue-50 hover:text-ink transition flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium text-ink">Progress</span>
              <span className="text-ink-light">{goal.progress_percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-50">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${goal.progress_percent}%` }}
              />
            </div>
            {!archived && (
              <p className="mt-1 text-xs text-ink-light">
                Progress is manual — click the % on the card to update it.
              </p>
            )}
          </div>

          {/* Why it matters */}
          {goal.why_it_matters && (
            <div>
              <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-1">
                Why it matters
              </p>
              <p className="text-sm text-ink italic">"{goal.why_it_matters}"</p>
            </div>
          )}

          {/* Description */}
          {goal.description && (
            <div>
              <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-1">
                Description
              </p>
              <p className="text-sm text-ink">{goal.description}</p>
            </div>
          )}

          {/* Target date */}
          {goal.target_date && (
            <div>
              <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-1">
                Target date
              </p>
              <p className="text-sm text-ink">{formatDate(goal.target_date)}</p>
            </div>
          )}

          {/* Notes */}
          {goal.notes && (
            <div>
              <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-1">
                Notes
              </p>
              <p className="text-sm text-ink whitespace-pre-line">{goal.notes}</p>
            </div>
          )}

          {/* Linked projects */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-ink-light uppercase tracking-wide">
                Linked projects
              </p>
              {canLinkProject(goal) && (
                <button
                  onClick={onOpenLinkModal}
                  className="text-xs text-blue-600 hover:text-blue-800 transition"
                >
                  + Manage
                </button>
              )}
            </div>

            {linkedProjects.length === 0 ? (
              <p className="text-sm text-ink-light italic">No projects linked.</p>
            ) : (
              <div className="space-y-2">
                {linkedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2"
                  >
                    <Link
                      href={`/project-planner/${p.id}`}
                      className="text-sm font-medium text-blue-700 hover:text-blue-900 truncate"
                    >
                      {p.name}
                    </Link>
                    <button
                      onClick={() => onUnlink(p.id)}
                      title="Unlink project"
                      className="ml-2 text-xs text-ink-light hover:text-red-500 transition flex-shrink-0"
                    >
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked monthly priorities — the monthly focus that ladders up to this goal */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-light">
              Linked priorities
            </p>
            {linkedPriorities.length === 0 ? (
              <p className="text-sm italic text-ink-light">
                No monthly priorities linked. Link one from the Monthly tab to bridge this goal to
                your monthly focus.
              </p>
            ) : (
              <div className="space-y-2">
                {linkedPriorities.map((p) => (
                  <Link
                    key={p.id}
                    href={`/annual-strategies?tab=monthly&month=${p.month_key}`}
                    className="flex items-center justify-between rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 transition hover:border-violet-300"
                  >
                    <span className="truncate text-sm font-medium text-violet-700">{p.title}</span>
                    <span className="ml-2 flex-shrink-0 text-xs text-ink-light">
                      {formatMonthLabel(p.month_key)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-blue-100 px-6 py-4">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-ink font-medium">
                Delete this goal?{" "}
                {linkedProjects.length > 0 && (
                  <span className="text-xs text-ink-light font-normal">
                    ({linkedProjects.length} linked project{linkedProjects.length > 1 ? "s" : ""} will be unlinked but kept.)
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-lg border border-blue-200 py-2 text-sm text-ink-light hover:border-blue-400 hover:text-ink transition"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onEdit}
                className="flex-1 rounded-lg border border-blue-300 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-500 hover:border-red-400 hover:text-red-600 transition"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
