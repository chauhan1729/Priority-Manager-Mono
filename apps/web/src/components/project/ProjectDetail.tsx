"use client";

import { useState, useTransition } from "react";

import { getProjectMetrics } from "@pm/domain";
import type {
  Activity,
  AnnualGoal,
  Contact,
  MonthlyPriority,
  Project,
  ProjectMilestone,
  ProjectResource,
} from "@pm/types";
import {
  deleteProject,
  updateProjectNotes,
} from "@/app/(app)/project-planner/actions";
import { STATUS_CLASSES, STATUS_LABELS } from "./ProjectCard";
import { ProjectForm } from "./ProjectForm";
import { ProjectAlignment } from "./ProjectAlignment";
import { ActivitiesTab } from "./ActivitiesTab";
import { MilestonesTab } from "./MilestonesTab";
import { ResourcesTab } from "./ResourcesTab";

type Tab = "overview" | "activities" | "milestones" | "resources" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activities", label: "Activities" },
  { id: "milestones", label: "Milestones" },
  { id: "resources", label: "Resources" },
  { id: "notes", label: "Notes" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface Props {
  project: Project;
  activities: Activity[];
  milestones: ProjectMilestone[];
  resources: ProjectResource[];
  allProjects: Pick<Project, "id" | "name" | "status">[];
  contacts: Pick<Contact, "id" | "full_name">[];
  /** Active annual goals to pick from in the Alignment control. */
  goals: Pick<AnnualGoal, "id" | "section" | "title">[];
  /** Monthly priorities to pick from in the Alignment control. */
  priorities: Pick<MonthlyPriority, "id" | "title" | "month_key">[];
  /** Name of the linked annual goal (if any). */
  linkedGoalTitle: string | null;
  /** Name of the linked monthly priority (if any). */
  linkedPriorityTitle: string | null;
  /** Whether this project is flagged as at-risk by domain logic. */
  atRisk: boolean;
  /** The next upcoming non-completed activity (for overview). */
  nextTask: Activity | null;
}

export function ProjectDetail({
  project,
  activities,
  milestones,
  resources,
  allProjects,
  contacts,
  goals,
  priorities,
  linkedGoalTitle,
  linkedPriorityTitle,
  atRisk,
  nextTask,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showEditForm, setShowEditForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notes, setNotes] = useState(project.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(true);
  const [isPending, startTransition] = useTransition();

  const metrics = getProjectMetrics(activities);

  // Compute risk reason for display
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue =
    project.target_end_date != null &&
    project.target_end_date < today &&
    project.status !== "completed";
  const isNoProgress = project.status === "in_progress" && metrics.progressPercent === 0;

  // Resource budget total
  const budgetTotal = resources.reduce(
    (sum, r) => (r.estimated_cost != null ? sum + r.estimated_cost : sum),
    0,
  );
  const hasResourceBudget = resources.some((r) => r.estimated_cost != null);

  function handleDeleteConfirmed() {
    startTransition(() => {
      deleteProject(project.id);
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      await updateProjectNotes(project.id, notes);
      setNotesSaved(true);
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 md:px-8">
      {/* Project header card */}
      <div className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[project.status]}`}
              >
                {STATUS_LABELS[project.status]}
              </span>
              {atRisk && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  {isOverdue ? "⚠ Overdue" : "⚠ No progress"}
                </span>
              )}
            </div>

            {project.description && (
              <p className="mt-2 text-sm text-ink-light">{project.description}</p>
            )}

            {/* Linked strategy / priority chips */}
            {(linkedGoalTitle || linkedPriorityTitle) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {linkedGoalTitle && (
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">
                    🎯 {linkedGoalTitle}
                  </span>
                )}
                {linkedPriorityTitle && (
                  <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-0.5 text-xs text-violet-700">
                    📌 {linkedPriorityTitle}
                  </span>
                )}
              </div>
            )}

            <p className="mt-2 text-xs text-ink-light">
              {formatDate(project.start_date)} → {formatDate(project.target_end_date)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => setShowEditForm(true)}
              className="rounded-lg border border-blue-100 px-3 py-1.5 text-sm font-medium text-ink-light hover:bg-blue-50 hover:text-blue-700"
            >
              Edit
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-red-100 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
                <span className="text-xs text-red-700">Delete project and all activities?</span>
                <button
                  onClick={handleDeleteConfirmed}
                  disabled={isPending}
                  className="rounded px-2 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded px-2 py-0.5 text-xs text-ink-light hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 border-t border-blue-50 pt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-ink">
              Progress — {metrics.progressPercent}%
            </span>
            <span className="text-xs text-ink-light">
              {metrics.completedHours}h / {metrics.totalEstimatedHours}h completed
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-50">
            <div
              className={`h-full rounded-full transition-all ${
                atRisk ? "bg-amber-400" : "bg-blue-500"
              }`}
              style={{ width: `${metrics.progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-5 text-xs text-ink-light">
            <span>
              <strong className="text-ink">{metrics.totalTasks}</strong> total tasks
            </span>
            <span>
              <strong className="text-ink">{metrics.completedTasks}</strong> completed
            </span>
            <span>
              <strong className="text-ink">{metrics.totalEstimatedHours}h</strong> estimated
            </span>
            {hasResourceBudget && (
              <span>
                <strong className="text-ink">
                  ${budgetTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </strong>{" "}
                budget
              </span>
            )}
          </div>
        </div>

        {/* Next upcoming task callout */}
        {nextTask && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs font-medium text-ink-light">Next task</span>
            <span className="flex-1 text-sm text-ink truncate">{nextTask.title}</span>
            <span className="text-xs text-ink-light">{formatShortDate(nextTask.activity_date)}</span>
          </div>
        )}

        {/* Risk explanation */}
        {atRisk && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            {isOverdue && isNoProgress
              ? "This project is overdue and has no recorded progress. Consider updating its status or target date."
              : isOverdue
              ? `Target end date was ${formatDate(project.target_end_date)} and the project is still ${STATUS_LABELS[project.status].toLowerCase()}.`
              : "This project is in progress but has no completed tasks yet."}
          </div>
        )}
      </div>

      {/* Tab navigation — horizontally scrollable so 5 tabs never overflow on mobile */}
      <div className="mt-6 border-b border-blue-100">
        <nav className="flex gap-0 overflow-x-auto scrollbar-hide" aria-label="Project detail tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-ink-light hover:border-blue-200 hover:text-ink"
              }`}
            >
              {tab.label}
              {tab.id === "activities" && metrics.totalTasks > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-normal text-blue-700">
                  {metrics.completedTasks}/{metrics.totalTasks}
                </span>
              )}
              {tab.id === "milestones" && milestones.length > 0 && (
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-600">
                  {milestones.length}
                </span>
              )}
              {tab.id === "resources" && resources.length > 0 && (
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-600">
                  {resources.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <dl className="rounded-xl border border-blue-50 bg-white p-5 text-sm">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-ink-light">Status</dt>
                  <dd className="mt-1 font-medium text-ink">{STATUS_LABELS[project.status]}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-ink-light">Start Date</dt>
                  <dd className="mt-1 text-ink">{formatDate(project.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-ink-light">Target End</dt>
                  <dd className={`mt-1 ${isOverdue ? "text-amber-700 font-medium" : "text-ink"}`}>
                    {formatDate(project.target_end_date)}
                    {isOverdue && " ⚠"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-ink-light">Total Tasks</dt>
                  <dd className="mt-1 text-ink">{metrics.totalTasks}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-ink-light">Completed</dt>
                  <dd className="mt-1 text-ink">{metrics.completedTasks}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-ink-light">Hours Logged</dt>
                  <dd className="mt-1 text-ink">
                    {metrics.completedHours}h / {metrics.totalEstimatedHours}h
                  </dd>
                </div>
                {hasResourceBudget && (
                  <div>
                    <dt className="text-xs font-medium text-ink-light">Resource Budget</dt>
                    <dd className="mt-1 text-ink">
                      ${budgetTotal.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                    </dd>
                  </div>
                )}
              </div>
            </dl>

            <ProjectAlignment
              projectId={project.id}
              linkedGoalId={project.linked_annual_goal_id}
              linkedPriorityId={project.linked_monthly_priority_id}
              goals={goals}
              priorities={priorities}
            />
          </div>
        )}

        {activeTab === "activities" && (
          <ActivitiesTab projectId={project.id} activities={activities} projects={allProjects} contacts={contacts} linkedPriorityTitle={linkedPriorityTitle} />
        )}

        {activeTab === "milestones" && (
          <MilestonesTab projectId={project.id} milestones={milestones} />
        )}

        {activeTab === "resources" && (
          <ResourcesTab projectId={project.id} resources={resources} />
        )}

        {activeTab === "notes" && (
          <div className="rounded-xl border border-blue-100 bg-white p-5">
            <h3 className="font-handwriting text-base text-ink mb-3">Notes</h3>
            <textarea
              rows={12}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesSaved(false);
              }}
              placeholder="Add notes, context, decisions, links…"
              className="w-full resize-none rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-2 flex items-center justify-end gap-3">
              {notesSaved && (
                <span className="text-xs text-green-600">Saved</span>
              )}
              <button
                onClick={handleSaveNotes}
                disabled={isPending || notesSaved}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
              >
                Save Notes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit form modal */}
      {showEditForm && (
        <ProjectForm project={project} onClose={() => setShowEditForm(false)} />
      )}
    </div>
  );
}
