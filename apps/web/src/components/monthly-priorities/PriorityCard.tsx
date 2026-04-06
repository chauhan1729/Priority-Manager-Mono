"use client";

import { useState } from "react";
import Link from "next/link";

import type {
  AnnualGoal,
  AnnualGoalSection,
  MonthlyPriority,
  MonthlyPrioritySection,
  MonthlyPriorityStatus,
  Project,
} from "@pm/types";
import {
  getEffectiveProgress,
  isArchivedPriority,
  isStale,
  SECTION_LABELS,
  MP_STATUS_LABELS,
  MP_STATUSES,
} from "@pm/domain";

import { SECTION_COLORS } from "./MonthlyPrioritiesView";

// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<MonthlyPriorityStatus, string> = {
  planned: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  dropped: "bg-gray-100 text-gray-400",
};

type GoalSummary = Pick<AnnualGoal, "id" | "section" | "title" | "status">;
type ProjectSummary = Pick<Project, "id" | "name" | "status" | "linked_monthly_priority_id">;

interface Props {
  priority: MonthlyPriority;
  projectProgressPercent: number | null;
  linkedGoal: GoalSummary | null;
  linkedProject: ProjectSummary | null;
  onEdit: () => void;
  onStatusUpdate: (status: string) => void;
  onProgressUpdate: (value: number) => void;
  onPin: (pinned: boolean) => void;
  onDelete: () => void;
  onOpenReview: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------

export function PriorityCard({
  priority,
  projectProgressPercent,
  linkedGoal,
  linkedProject,
  onEdit,
  onStatusUpdate,
  onProgressUpdate,
  onPin,
  onDelete,
  onOpenReview,
}: Props) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [editingProgress, setEditingProgress] = useState(false);
  const [localProgress, setLocalProgress] = useState(
    priority.manual_progress_percent ?? 0,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const colors = SECTION_COLORS[priority.section as MonthlyPrioritySection];
  const archived = isArchivedPriority(priority);
  const stale = isStale(priority);
  const effectiveProgress = getEffectiveProgress(priority, projectProgressPercent);
  const isAutoProgress = priority.progress_mode === "auto_project";

  function handleProgressBlur() {
    setEditingProgress(false);
    const clamped = Math.max(0, Math.min(100, Math.round(localProgress)));
    if (clamped !== (priority.manual_progress_percent ?? 0)) {
      onProgressUpdate(clamped);
    }
  }

  function handleProgressKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setLocalProgress(priority.manual_progress_percent ?? 0);
      setEditingProgress(false);
    }
  }

  return (
    <div
      className={`flex flex-col rounded-xl border bg-white shadow-sm transition hover:shadow-md ${colors.border} ${archived ? "opacity-70" : ""}`}
    >
      {/* Top bar: pin, status, stale indicator */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stale indicator */}
          {stale && (
            <span
              title="No progress updates in the past 7 days"
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
              Stale
            </span>
          )}

          {/* Pin badge */}
          {priority.pinned && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              ★ Top priority
            </span>
          )}
        </div>

        {/* Actions menu */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!archived && (
            <button
              onClick={() => onPin(!priority.pinned)}
              title={priority.pinned ? "Unpin" : "Pin as top priority"}
              className="rounded-full p-1 text-ink-light hover:text-blue-500 hover:bg-blue-50 transition text-xs"
            >
              {priority.pinned ? "★" : "☆"}
            </button>
          )}
          <button
            onClick={onEdit}
            className="rounded-full p-1 text-ink-light hover:text-ink hover:bg-blue-50 transition text-xs"
            title="Edit"
          >
            ✎
          </button>
          {!archived && (
            <button
              onClick={onOpenReview}
              title="Month-end review"
              className="rounded-full p-1 text-ink-light hover:text-ink hover:bg-blue-50 transition text-xs"
            >
              ↩
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 pb-3 flex-1">
        {/* Title */}
        <h3 className="font-handwriting text-lg text-ink leading-snug mb-2">
          {priority.title}
        </h3>

        {/* Note preview */}
        {priority.note && (
          <p className="text-xs text-ink-light italic line-clamp-2 mb-2">
            "{priority.note}"
          </p>
        )}

        {/* Target date */}
        {priority.target_date && (
          <p className="text-xs text-ink-light mb-2">
            Due {formatDate(priority.target_date)}
          </p>
        )}

        {/* Inline status selector */}
        <div className="relative mb-3">
          <button
            type="button"
            onClick={() => !archived && setStatusOpen((v) => !v)}
            disabled={archived}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[priority.status]} ${!archived ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
          >
            {MP_STATUS_LABELS[priority.status]}
          </button>

          {statusOpen && (
            <div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] rounded-xl border border-blue-100 bg-white shadow-lg py-1">
              {MP_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onStatusUpdate(s);
                    setStatusOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-blue-50 transition ${s === priority.status ? "font-semibold text-blue-700" : "text-ink"}`}
                >
                  {MP_STATUS_LABELS[s]}
                  {s === priority.status && <span className="ml-auto text-blue-500">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs text-ink-light mb-1">
          <span>
            {isAutoProgress ? (
              <span className="text-blue-500 font-medium">Auto</span>
            ) : (
              "Progress"
            )}
          </span>
          {isAutoProgress ? (
            <span className="font-medium text-ink">{effectiveProgress}%</span>
          ) : editingProgress ? (
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
            />
          ) : (
            <button
              type="button"
              title={archived ? undefined : "Click to edit progress"}
              onClick={() => !archived && setEditingProgress(true)}
              disabled={archived}
              className="font-medium text-ink hover:text-blue-600 disabled:cursor-default"
            >
              {effectiveProgress}%
            </button>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-50">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${effectiveProgress}%` }}
          />
        </div>
        {isAutoProgress && linkedProject && (
          <p className="mt-1 text-xs text-ink-light">
            From{" "}
            <Link
              href={`/project-planner/${linkedProject.id}`}
              className="text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {linkedProject.name}
            </Link>
          </p>
        )}
      </div>

      {/* Linked goal chip */}
      {linkedGoal && (
        <div className="border-t border-blue-50 px-4 py-2.5">
          <p className="text-xs text-ink-light mb-1">Annual goal</p>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 line-clamp-1">
            {SECTION_LABELS[linkedGoal.section as AnnualGoalSection]} · {linkedGoal.title}
          </span>
        </div>
      )}

      {/* Delete confirmation */}
      <div className="border-t border-blue-50 px-4 py-3">
        {confirmDelete ? (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-lg border border-blue-200 py-1.5 text-xs text-ink-light hover:border-blue-400 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
              className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
            >
              Delete
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-ink-light hover:text-red-500 transition"
          >
            Delete
          </button>
        )}
      </div>

      {/* Click-away to close status dropdown */}
      {statusOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setStatusOpen(false)}
        />
      )}
    </div>
  );
}
