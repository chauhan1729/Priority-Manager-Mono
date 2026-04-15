"use client";

import { useState, useTransition } from "react";

import type { AnnualGoal, AnnualGoalSection, Project } from "@pm/types";
import {
  ANNUAL_GOAL_SECTIONS,
  filterActive,
  filterArchived,
  groupGoalsBySection,
  SECTION_LABELS,
} from "@pm/domain";

import {
  createAnnualGoal,
  deleteAnnualGoal,
  linkProjectToGoal,
  unlinkProjectFromGoal,
  updateAnnualGoal,
  updateGoalProgress,
  type CreateGoalData,
  type UpdateGoalData,
} from "@/app/(app)/annual-strategies/actions";
import { showToast } from "@/components/ui/Toaster";
import { GoalCard } from "./GoalCard";
import { GoalDetailPanel } from "./GoalDetailPanel";
import { GoalFormModal } from "./GoalFormModal";
import { ProjectLinkModal } from "./ProjectLinkModal";

// ---------------------------------------------------------------------------

type ProjectSummary = Pick<Project, "id" | "name" | "status" | "linked_annual_goal_id">;

interface Props {
  goals: AnnualGoal[];
  projects: ProjectSummary[];
}

// ---------------------------------------------------------------------------
// Section accent colors (consistent with notebook palette)
// ---------------------------------------------------------------------------

const SECTION_COLORS: Record<AnnualGoalSection, { border: string; badge: string; dot: string }> = {
  business: {
    border: "border-blue-200",
    badge: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  career: {
    border: "border-violet-200",
    badge: "bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
  personal: {
    border: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
};

export { SECTION_COLORS };

// ---------------------------------------------------------------------------

export function AnnualStrategiesView({ goals, projects }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<AnnualGoal | null>(null);
  const [formTarget, setFormTarget] = useState<null | "new" | AnnualGoal>(null);
  const [defaultSection, setDefaultSection] = useState<AnnualGoalSection>("business");
  const [linkTarget, setLinkTarget] = useState<AnnualGoal | null>(null);
  const [_isPending, startTransition] = useTransition();

  const visibleGoals = showArchived ? filterArchived(goals) : filterActive(goals);
  const grouped = groupGoalsBySection(visibleGoals);

  // Projects available to link (not cancelled/completed — user shouldn't link dead projects)
  const linkableProjects = projects.filter(
    (p) => p.status !== "cancelled" && p.status !== "completed",
  );

  function handleAddGoal(section: AnnualGoalSection) {
    setDefaultSection(section);
    setFormTarget("new");
  }

  function handleCreate(data: CreateGoalData) {
    startTransition(async () => {
      const result = await createAnnualGoal(data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Goal created");
        setFormTarget(null);
      }
    });
  }

  function handleUpdate(id: string, data: UpdateGoalData) {
    startTransition(async () => {
      const result = await updateAnnualGoal(id, data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Goal updated");
        setFormTarget(null);
        // Refresh selected goal panel if it was the one edited
        if (selectedGoal?.id === id) {
          setSelectedGoal(null);
        }
      }
    });
  }

  function handleProgressUpdate(id: string, value: number) {
    startTransition(async () => {
      const result = await updateGoalProgress(id, value);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Progress updated");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAnnualGoal(id);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Goal deleted");
        setSelectedGoal(null);
      }
    });
  }

  function handleLink(goalId: string, projectId: string) {
    startTransition(async () => {
      const result = await linkProjectToGoal(goalId, projectId);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Project linked");
        setLinkTarget(null);
      }
    });
  }

  function handleUnlink(goalId: string, projectId: string) {
    startTransition(async () => {
      const result = await unlinkProjectFromGoal(goalId, projectId);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Project unlinked");
      }
    });
  }

  const activeCount = filterActive(goals).length;
  const archivedCount = filterArchived(goals).length;

  return (
    <div className="relative min-h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 md:px-8 border-b border-blue-50">
        <p className="text-sm text-ink-light">
          {activeCount} active · {archivedCount} archived
        </p>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-ink-light hover:border-blue-400 hover:text-ink transition"
        >
          {showArchived ? "Show active" : "Show archived"}
        </button>
      </div>

      {/* 3 sections */}
      <div className="px-6 py-6 md:px-8 space-y-10">
        {ANNUAL_GOAL_SECTIONS.map((section) => {
          const sectionGoals = grouped[section];
          const colors = SECTION_COLORS[section];
          return (
            <section key={section}>
              {/* Section header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                  <h2 className="font-handwriting text-xl text-ink">{SECTION_LABELS[section]}</h2>
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}>
                    {sectionGoals.length}
                  </span>
                </div>
                {!showArchived && (
                  <button
                    onClick={() => handleAddGoal(section)}
                    className="flex items-center gap-1 rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition"
                  >
                    + Add goal
                  </button>
                )}
              </div>

              {/* Goal cards */}
              {sectionGoals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-blue-100 bg-blue-50/30 px-6 py-8 text-center">
                  <p className="text-sm text-ink-light">
                    {showArchived
                      ? "No archived goals in this section."
                      : "No active goals yet. Add one to get started."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionGoals.map((goal) => {
                    const linkedProjects = projects.filter(
                      (p) => p.linked_annual_goal_id === goal.id,
                    );
                    return (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        linkedProjects={linkedProjects}
                        onSelect={() => setSelectedGoal(goal)}
                        onProgressUpdate={(v) => handleProgressUpdate(goal.id, v)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedGoal && (
        <GoalDetailPanel
          goal={selectedGoal}
          linkedProjects={projects.filter((p) => p.linked_annual_goal_id === selectedGoal.id)}
          onClose={() => setSelectedGoal(null)}
          onEdit={() => setFormTarget(selectedGoal)}
          onDelete={() => handleDelete(selectedGoal.id)}
          onOpenLinkModal={() => setLinkTarget(selectedGoal)}
          onUnlink={(projectId) => handleUnlink(selectedGoal.id, projectId)}
        />
      )}

      {/* Create/edit form modal */}
      {formTarget !== null && (
        <GoalFormModal
          mode={formTarget === "new" ? "create" : "edit"}
          defaultSection={defaultSection}
          {...(formTarget !== "new" ? { existing: formTarget } : {})}
          onClose={() => setFormTarget(null)}
          onCreate={handleCreate}
          onUpdate={(data) =>
            handleUpdate((formTarget as AnnualGoal).id, data)
          }
        />
      )}

      {/* Project link modal */}
      {linkTarget && (
        <ProjectLinkModal
          goal={linkTarget}
          allProjects={linkableProjects}
          linkedProjects={projects.filter((p) => p.linked_annual_goal_id === linkTarget.id)}
          onClose={() => setLinkTarget(null)}
          onLink={(projectId) => handleLink(linkTarget.id, projectId)}
          onUnlink={(projectId) => handleUnlink(linkTarget.id, projectId)}
        />
      )}
    </div>
  );
}
