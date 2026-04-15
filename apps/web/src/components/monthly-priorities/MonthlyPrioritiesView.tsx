"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  AnnualGoal,
  AnnualGoalSection,
  MonthlyPriority,
  MonthlyPrioritySection,
  Project,
} from "@pm/types";
import {
  canAddPriority,
  formatMonthLabel,
  getNextMonthKey,
  getPrevMonthKey,
  groupBySection,
  MAX_PRIORITIES_PER_SECTION,
  MP_SECTIONS,
  MP_SECTION_LABELS,
} from "@pm/domain";

import {
  carryForwardPriority,
  createMonthlyPriority,
  deleteMonthlyPriority,
  togglePriorityPin,
  updateMonthlyPriority,
  updatePriorityProgress,
  updatePriorityStatus,
  type CreatePriorityData,
  type UpdatePriorityData,
} from "@/app/(app)/monthly-priorities/actions";
import { showToast } from "@/components/ui/Toaster";
import { MonthEndReviewModal } from "./MonthEndReviewModal";
import { PriorityCard } from "./PriorityCard";
import { PriorityFormModal } from "./PriorityFormModal";

// ---------------------------------------------------------------------------

type GoalSummary = Pick<AnnualGoal, "id" | "section" | "title" | "status">;
type ProjectSummary = Pick<Project, "id" | "name" | "status" | "linked_monthly_priority_id">;

// Section colors consistent with notebook palette
export const SECTION_COLORS: Record<
  MonthlyPrioritySection,
  { border: string; badge: string; dot: string; countBg: string }
> = {
  business_career: {
    border: "border-blue-200",
    badge: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
    countBg: "bg-blue-50 text-blue-600",
  },
  personal: {
    border: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    countBg: "bg-emerald-50 text-emerald-600",
  },
};

interface Props {
  monthKey: string;
  priorities: MonthlyPriority[];
  projectProgressMap: Record<string, number>;
  annualGoals: GoalSummary[];
  projects: ProjectSummary[];
}

// ---------------------------------------------------------------------------

export function MonthlyPrioritiesView({
  monthKey,
  priorities,
  projectProgressMap,
  annualGoals,
  projects,
}: Props) {
  const router = useRouter();
  const [_isPending, startTransition] = useTransition();

  const [formTarget, setFormTarget] = useState<null | "new" | MonthlyPriority>(null);
  const [formDefaultSection, setFormDefaultSection] =
    useState<MonthlyPrioritySection>("business_career");
  const [reviewTarget, setReviewTarget] = useState<MonthlyPriority | null>(null);

  const grouped = groupBySection(priorities);

  // Navigation
  function goToMonth(key: string) {
    router.push(`/monthly-priorities?month=${key}`);
  }

  // Handlers
  function handleAddPriority(section: MonthlyPrioritySection) {
    setFormDefaultSection(section);
    setFormTarget("new");
  }

  function handleCreate(data: CreatePriorityData) {
    startTransition(async () => {
      const result = await createMonthlyPriority(data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Priority added");
        setFormTarget(null);
      }
    });
  }

  function handleUpdate(id: string, data: UpdatePriorityData) {
    startTransition(async () => {
      const result = await updateMonthlyPriority(id, data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Priority updated");
        setFormTarget(null);
      }
    });
  }

  function handleStatusUpdate(id: string, status: string) {
    startTransition(async () => {
      const result = await updatePriorityStatus(id, status);
      if (result && "error" in result) {
        showToast(result.error, "error");
      }
      // No success toast for inline status updates — visual change is feedback
    });
  }

  function handleProgressUpdate(id: string, value: number) {
    startTransition(async () => {
      const result = await updatePriorityProgress(id, value);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Progress updated");
      }
    });
  }

  function handlePin(id: string, pinned: boolean) {
    startTransition(async () => {
      const result = await togglePriorityPin(id, pinned);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast(pinned ? "Pinned as top priority" : "Unpinned");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteMonthlyPriority(id);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Priority deleted");
      }
    });
  }

  function handleCarryForward(id: string) {
    const nextMonth = getNextMonthKey(monthKey);
    startTransition(async () => {
      const result = await carryForwardPriority(id, nextMonth);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast(`Carried forward to ${formatMonthLabel(nextMonth)}`);
        setReviewTarget(null);
      }
    });
  }

  const monthLabel = formatMonthLabel(monthKey);
  const prevKey = getPrevMonthKey(monthKey);
  const nextKey = getNextMonthKey(monthKey);

  return (
    <div className="relative min-h-full">
      {/* Header */}
      <div className="px-4 py-3 md:px-8 md:py-4 border-b border-blue-50">
        {/* Row 1: Page title */}
        <h1 className="font-handwriting text-2xl text-ink mb-2">Monthly Priorities</h1>

        {/* Row 2: Month nav + stats */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToMonth(prevKey)}
              className="rounded-lg border border-blue-100 px-2 py-1 text-xs font-medium text-ink-light hover:border-blue-400 hover:text-ink transition"
            >
              ←
            </button>
            <span className="font-handwriting text-lg text-ink px-1">{monthLabel}</span>
            <button
              onClick={() => goToMonth(nextKey)}
              className="rounded-lg border border-blue-100 px-2 py-1 text-xs font-medium text-ink-light hover:border-blue-400 hover:text-ink transition"
            >
              →
            </button>
          </div>
          <p className="text-xs text-ink-light">
            {priorities.length} total · {priorities.filter((p) => p.pinned).length} pinned
          </p>
        </div>
      </div>

      {/* 2 sections */}
      <div className="px-6 py-6 md:px-8 space-y-10">
        {MP_SECTIONS.map((section) => {
          const sectionPriorities = grouped[section];
          const count = sectionPriorities.length;
          const colors = SECTION_COLORS[section];
          const atCapacity = !canAddPriority(priorities, section, monthKey);

          return (
            <section key={section}>
              {/* Section header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                  <h3 className="font-handwriting text-xl text-ink">
                    {MP_SECTION_LABELS[section]}
                  </h3>
                  {/* X/5 counter */}
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      atCapacity ? "bg-amber-50 text-amber-700" : colors.countBg
                    }`}
                  >
                    {count}/{MAX_PRIORITIES_PER_SECTION}
                  </span>
                </div>
                <button
                  onClick={() => handleAddPriority(section)}
                  disabled={atCapacity}
                  className="flex items-center gap-1 rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Add priority
                </button>
              </div>

              {/* Priority cards */}
              {sectionPriorities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-blue-100 bg-blue-50/30 px-6 py-8 text-center">
                  <p className="text-sm text-ink-light">
                    No priorities for this section yet. Add 3–5 to get started.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionPriorities.map((priority) => {
                    const projectProgress = priority.linked_project_id
                      ? (projectProgressMap[priority.linked_project_id] ?? null)
                      : null;
                    const linkedGoal = annualGoals.find(
                      (g) => g.id === priority.linked_annual_goal_id,
                    );
                    const linkedProject = projects.find(
                      (p) => p.id === priority.linked_project_id,
                    );

                    return (
                      <PriorityCard
                        key={priority.id}
                        priority={priority}
                        projectProgressPercent={projectProgress}
                        linkedGoal={linkedGoal ?? null}
                        linkedProject={linkedProject ?? null}
                        onEdit={() => setFormTarget(priority)}
                        onStatusUpdate={(status) =>
                          handleStatusUpdate(priority.id, status)
                        }
                        onProgressUpdate={(value) =>
                          handleProgressUpdate(priority.id, value)
                        }
                        onPin={(pinned) => handlePin(priority.id, pinned)}
                        onDelete={() => handleDelete(priority.id)}
                        onOpenReview={() => setReviewTarget(priority)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Capacity warning */}
              {atCapacity && (
                <p className="mt-3 text-xs text-amber-600 text-center">
                  Section at capacity ({MAX_PRIORITIES_PER_SECTION}/{MAX_PRIORITIES_PER_SECTION}).
                  Complete or drop a priority to add another.
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* Create / edit form modal */}
      {formTarget !== null && (
        <PriorityFormModal
          mode={formTarget === "new" ? "create" : "edit"}
          monthKey={monthKey}
          defaultSection={formDefaultSection}
          {...(formTarget !== "new" ? { existing: formTarget } : {})}
          annualGoals={annualGoals}
          projects={projects}
          onClose={() => setFormTarget(null)}
          onCreate={handleCreate}
          onUpdate={(data) => handleUpdate((formTarget as MonthlyPriority).id, data)}
        />
      )}

      {/* Month-end review modal */}
      {reviewTarget && (
        <MonthEndReviewModal
          priority={reviewTarget}
          monthKey={monthKey}
          nextMonthKey={getNextMonthKey(monthKey)}
          onClose={() => setReviewTarget(null)}
          onComplete={() => handleStatusUpdate(reviewTarget.id, "completed")}
          onDrop={() => {
            handleStatusUpdate(reviewTarget.id, "dropped");
            setReviewTarget(null);
          }}
          onCarryForward={() => handleCarryForward(reviewTarget.id)}
          onRewrite={() => {
            // Pre-fill a new form with same data; let user edit before creating
            setReviewTarget(null);
            setFormDefaultSection(reviewTarget.section);
            setFormTarget(reviewTarget);
          }}
        />
      )}
    </div>
  );
}
