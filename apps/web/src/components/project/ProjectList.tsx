"use client";

import { useState } from "react";

import type { ProjectStatus } from "@pm/types";
import type { ProjectWithMetrics } from "@/app/(app)/project-planner/page";
import { ProjectCard } from "./ProjectCard";
import { ProjectForm } from "./ProjectForm";

const STATUS_FILTERS: { label: string; value: ProjectStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Planned", value: "planned" },
  { label: "In Progress", value: "in_progress" },
  { label: "On Hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

interface Props {
  projects: ProjectWithMetrics[];
}

export function ProjectList({ projects }: Props) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);

  const filtered =
    statusFilter === "all" ? projects : projects.filter((p) => p.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 text-ink-light hover:bg-blue-100 hover:text-blue-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* New project button */}
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <span className="text-base leading-none">+</span> New Project
        </button>
      </div>

      {/* Project grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-200 bg-white px-8 py-16 text-center">
          <p className="font-handwriting text-lg text-ink-light">No projects yet</p>
          <p className="mt-1 text-sm text-ink-light">
            Create your first project to start tracking work.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Create project modal */}
      {showForm && <ProjectForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
