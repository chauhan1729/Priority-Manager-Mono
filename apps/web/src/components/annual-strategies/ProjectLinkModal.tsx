"use client";

import { useState } from "react";

import type { AnnualGoal, Project, ProjectStatus } from "@pm/types";
import { SECTION_LABELS } from "@pm/domain";

// ---------------------------------------------------------------------------

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

type ProjectSummary = Pick<Project, "id" | "name" | "status" | "linked_annual_goal_id">;

interface Props {
  goal: AnnualGoal;
  allProjects: ProjectSummary[];
  linkedProjects: ProjectSummary[];
  onClose: () => void;
  onLink: (projectId: string) => void;
  onUnlink: (projectId: string) => void;
}

// ---------------------------------------------------------------------------

export function ProjectLinkModal({
  goal,
  allProjects,
  linkedProjects,
  onClose,
  onLink,
  onUnlink,
}: Props) {
  const [query, setQuery] = useState("");

  const linkedIds = new Set(linkedProjects.map((p) => p.id));

  // Projects not already linked to this goal (and match search query)
  const available = allProjects.filter(
    (p) =>
      !linkedIds.has(p.id) &&
      (p.name.toLowerCase().includes(query.toLowerCase()) || query === ""),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-100 px-6 py-4">
          <div>
            <h2 className="font-handwriting text-xl text-ink">Linked Projects</h2>
            <p className="text-xs text-ink-light mt-0.5">
              {SECTION_LABELS[goal.section]} · {goal.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-light hover:bg-blue-50 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Currently linked */}
          {linkedProjects.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-2">
                Currently linked
              </p>
              <div className="space-y-2">
                {linkedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                      <p className="text-xs text-ink-light">{PROJECT_STATUS_LABELS[p.status]}</p>
                    </div>
                    <button
                      onClick={() => onUnlink(p.id)}
                      className="ml-3 text-xs text-ink-light hover:text-red-500 transition flex-shrink-0"
                    >
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add project */}
          <div>
            <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-2">
              Link a project
            </p>

            {/* Sync note */}
            <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
              <p className="text-xs text-amber-700">
                Linking updates the project's record — no duplicates are created.
                Activities remain under the project, not this goal.
              </p>
            </div>

            {/* Search */}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
            />

            {available.length === 0 ? (
              <p className="text-sm text-ink-light italic text-center py-4">
                {query ? "No projects match your search." : "No available projects to link."}
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1.5">
                {available.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onLink(p.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-blue-100 px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                      <p className="text-xs text-ink-light">
                        {p.linked_annual_goal_id ? "Currently linked to another goal" : PROJECT_STATUS_LABELS[p.status]}
                      </p>
                    </div>
                    <span className="ml-3 text-xs text-blue-600 flex-shrink-0">Link →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-blue-100 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-blue-200 py-2 text-sm text-ink-light hover:border-blue-400 hover:text-ink transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
