"use client";

import { useActionState, useEffect } from "react";

import type { Project, ProjectStatus } from "@pm/types";
import { createProject, updateProject, type ActionResult } from "@/app/(app)/project-planner/actions";
import { STATUS_LABELS } from "./ProjectCard";

const PROJECT_STATUSES: ProjectStatus[] = [
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
];

interface Props {
  /** When provided, renders in edit mode pre-filled with project values. */
  project?: Project | undefined;
  onClose: () => void;
}

export function ProjectForm({ project, onClose }: Props) {
  const action = project ? updateProject.bind(null, project.id) : createProject;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, null);

  // Close on success
  useEffect(() => {
    if (state && "success" in state) {
      onClose();
    }
  }, [state, onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-handwriting text-xl text-ink mb-5">
          {project ? "Edit Project" : "New Project"}
        </h2>

        <form action={formAction} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1" htmlFor="name">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={project?.name ?? ""}
              placeholder="What are you building?"
              className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={project?.description ?? ""}
              placeholder="Brief summary (optional)"
              className="w-full resize-none rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={project?.status ?? "planned"}
              className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1" htmlFor="start_date">
                Start Date
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={project?.start_date ?? ""}
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1" htmlFor="target_end_date">
                Target End Date
              </label>
              <input
                id="target_end_date"
                name="target_end_date"
                type="date"
                defaultValue={project?.target_end_date ?? ""}
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Error */}
          {state && "error" in state && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-ink-light hover:bg-blue-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              {project ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
