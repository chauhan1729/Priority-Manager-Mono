"use client";

import { useEffect, useRef, useState } from "react";

import type {
  AnnualGoal,
  AnnualGoalSection,
  MonthlyPriority,
  MonthlyPrioritySection,
  MonthlyPriorityStatus,
  Project,
  ProgressMode,
} from "@pm/types";
import {
  formatMonthLabel,
  MP_SECTIONS,
  MP_STATUSES,
  MP_SECTION_LABELS,
  MP_STATUS_LABELS,
  SECTION_LABELS,
} from "@pm/domain";

import type {
  CreatePriorityData,
  UpdatePriorityData,
} from "@/app/(app)/monthly-priorities/actions";

// ---------------------------------------------------------------------------

type GoalSummary = Pick<AnnualGoal, "id" | "section" | "title" | "status">;
type ProjectSummary = Pick<Project, "id" | "name" | "status" | "linked_monthly_priority_id">;

interface Props {
  mode: "create" | "edit";
  monthKey: string;
  defaultSection?: MonthlyPrioritySection;
  existing?: MonthlyPriority;
  annualGoals: GoalSummary[];
  projects: ProjectSummary[];
  onClose: () => void;
  onCreate: (data: CreatePriorityData) => void;
  onUpdate: (data: UpdatePriorityData) => void;
}

// ---------------------------------------------------------------------------

export function PriorityFormModal({
  mode,
  monthKey,
  defaultSection = "business_career",
  existing,
  annualGoals,
  projects,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const titleRef = useRef<HTMLInputElement>(null);

  const [section, setSection] = useState<MonthlyPrioritySection>(
    existing?.section ?? defaultSection,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [targetDate, setTargetDate] = useState(existing?.target_date ?? "");
  const [startedDate, setStartedDate] = useState(existing?.started_date ?? "");
  const [assignedDate, setAssignedDate] = useState(existing?.assigned_date ?? "");
  const [status, setStatus] = useState<MonthlyPriorityStatus>(
    existing?.status ?? "planned",
  );
  const [linkedGoalId, setLinkedGoalId] = useState<string>(
    existing?.linked_annual_goal_id ?? "",
  );
  const [linkedProjectId, setLinkedProjectId] = useState<string>(
    existing?.linked_project_id ?? "",
  );
  const [progressMode, setProgressMode] = useState<ProgressMode>(
    existing?.progress_mode ?? "manual",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // When project is unlinked, force manual progress mode
  function handleProjectChange(projectId: string) {
    setLinkedProjectId(projectId);
    if (!projectId) {
      setProgressMode("manual");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (progressMode === "auto_project" && !linkedProjectId) {
      setError("Auto progress requires a linked project.");
      return;
    }
    setError("");

    if (mode === "create") {
      onCreate({
        section,
        title: title.trim(),
        month_key: monthKey,
        category: category.trim() || null,
        started_date: startedDate || null,
        assigned_date: assignedDate || null,
        target_date: targetDate || null,
        linked_annual_goal_id: linkedGoalId || null,
        linked_project_id: linkedProjectId || null,
        progress_mode: progressMode,
        note: note.trim() || null,
        pinned: false,
      });
    } else {
      const update: UpdatePriorityData = {};
      if (title.trim() !== existing?.title) update.title = title.trim();
      if ((category.trim() || null) !== existing?.category)
        update.category = category.trim() || null;
      if ((note.trim() || null) !== existing?.note) update.note = note.trim() || null;
      if ((targetDate || null) !== existing?.target_date)
        update.target_date = targetDate || null;
      if ((startedDate || null) !== existing?.started_date)
        update.started_date = startedDate || null;
      if ((assignedDate || null) !== existing?.assigned_date)
        update.assigned_date = assignedDate || null;
      if (status !== existing?.status) update.status = status;
      if ((linkedGoalId || null) !== existing?.linked_annual_goal_id)
        update.linked_annual_goal_id = linkedGoalId || null;
      if ((linkedProjectId || null) !== existing?.linked_project_id)
        update.linked_project_id = linkedProjectId || null;
      if (progressMode !== existing?.progress_mode) update.progress_mode = progressMode;
      onUpdate(update);
    }
  }

  const monthLabel = formatMonthLabel(monthKey);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-100 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="font-handwriting text-xl text-ink">
              {mode === "create" ? "New Priority" : "Edit Priority"}
            </h2>
            <p className="text-xs text-ink-light mt-0.5">{monthLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-light hover:bg-blue-50 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 px-6 py-5 overflow-y-auto flex-1"
        >
          {/* Section — immutable in edit mode */}
          {mode === "create" ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Section
              </label>
              <div className="flex gap-2">
                {MP_SECTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSection(s)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                      section === s
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-blue-100 text-ink-light hover:border-blue-300"
                    }`}
                  >
                    {MP_SECTION_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Section
              </label>
              <p className="text-sm text-ink">{MP_SECTION_LABELS[existing!.section]}</p>
              <p className="text-xs text-ink-light mt-0.5">
                Section cannot be changed after creation.
              </p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Launch B2B outreach campaign"
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Why this month (note) */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Why this matters this month
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="The reason this is a priority right now"
              rows={2}
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Revenue, Health, Learning"
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Target date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Started date
              </label>
              <input
                type="date"
                value={startedDate}
                onChange={(e) => setStartedDate(e.target.value)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Status (edit mode only) */}
          {mode === "edit" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MonthlyPriorityStatus)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                {MP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {MP_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Annual goal link */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Linked annual goal
            </label>
            <select
              value={linkedGoalId}
              onChange={(e) => setLinkedGoalId(e.target.value)}
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">— None —</option>
              {annualGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {SECTION_LABELS[g.section as AnnualGoalSection]} · {g.title}
                </option>
              ))}
            </select>
          </div>

          {/* Project link + progress mode */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Linked project
            </label>
            <select
              value={linkedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.linked_monthly_priority_id &&
                  p.linked_monthly_priority_id !== existing?.id
                    ? " (linked to another priority)"
                    : ""}
                </option>
              ))}
            </select>

            {/* Progress mode — only when project linked */}
            {linkedProjectId && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setProgressMode("manual")}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                    progressMode === "manual"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-blue-100 text-ink-light hover:border-blue-300"
                  }`}
                >
                  Manual progress
                </button>
                <button
                  type="button"
                  onClick={() => setProgressMode("auto_project")}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                    progressMode === "auto_project"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-blue-100 text-ink-light hover:border-blue-300"
                  }`}
                >
                  Auto from project
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm text-ink-light hover:border-blue-400 hover:text-ink transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              {mode === "create" ? "Add priority" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
