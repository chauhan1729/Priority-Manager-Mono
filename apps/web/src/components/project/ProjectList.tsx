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
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filtered = projects
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) =>
      search.trim() === "" ||
      p.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.trim().toLowerCase()),
    );

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-4">
        {/* Search + New Project */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-3 flex items-center text-ink-light pointer-events-none text-sm">
              ⌕
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full rounded-lg border border-blue-100 bg-white pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-2 flex items-center px-1 text-ink-light hover:text-ink text-sm"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            <span className="text-base leading-none">+</span> New Project
          </button>
        </div>

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
      </div>

      {/* Project grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-200 bg-white px-8 py-16 text-center">
          {search ? (
            <>
              <p className="font-handwriting text-lg text-ink-light">No projects match "{search}"</p>
              <button onClick={() => setSearch("")} className="mt-2 text-xs text-blue-600 hover:underline">
                Clear search
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
