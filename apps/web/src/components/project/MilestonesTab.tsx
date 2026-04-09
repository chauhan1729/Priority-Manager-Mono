"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useState } from "react";

import type { MilestoneStatus, ProjectMilestone } from "@pm/types";
import {
  createMilestone,
  deleteMilestone,
  updateMilestone,
  updateMilestoneStatus,
  type ActionResult,
} from "@/app/(app)/project-planner/actions";
import { showToast } from "@/components/ui/Toaster";

const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  missed: "Missed",
};

const MILESTONE_STATUS_CLASSES: Record<MilestoneStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  completed: "bg-green-100 text-green-700",
  missed: "bg-red-100 text-red-600",
};

function formatDate(iso: string | null): string {
  if (!iso) return "No target date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Add milestone form
// ---------------------------------------------------------------------------

interface AddMilestoneFormProps {
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddMilestoneForm({ projectId, onSuccess, onCancel }: AddMilestoneFormProps) {
  const boundAction = createMilestone.bind(null, projectId);
  const [state, formAction] = useActionState<ActionResult, FormData>(boundAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
      showToast("Milestone added");
      onSuccess();
    } else if (state && "error" in state) {
      showToast(state.error, "error");
    }
  }, [state, onSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
    >
      <h4 className="text-xs font-semibold text-ink-light uppercase tracking-wide">
        Add Milestone
      </h4>

      <input
        name="title"
        type="text"
        required
        placeholder="Milestone title"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      <div>
        <label className="block text-xs text-ink-light mb-1">Target Date (optional)</label>
        <input
          name="target_date"
          type="date"
          className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {state && "error" in state && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-1.5 text-sm font-medium text-ink-light hover:bg-blue-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Milestone
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit milestone form (inline)
// ---------------------------------------------------------------------------

interface EditMilestoneFormProps {
  milestone: ProjectMilestone;
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function EditMilestoneForm({ milestone, projectId, onSuccess, onCancel }: EditMilestoneFormProps) {
  const boundAction = updateMilestone.bind(null, milestone.id, projectId);
  const [state, formAction] = useActionState<ActionResult, FormData>(boundAction, null);

  useEffect(() => {
    if (state && "success" in state) {
      showToast("Milestone updated");
      onSuccess();
    } else if (state && "error" in state) {
      showToast(state.error, "error");
    }
  }, [state, onSuccess]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4"
    >
      <h4 className="text-xs font-semibold text-ink-light uppercase tracking-wide">Edit Milestone</h4>

      <input
        name="title"
        type="text"
        required
        defaultValue={milestone.title}
        placeholder="Milestone title"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-ink-light mb-1">Target Date</label>
          <input
            name="target_date"
            type="date"
            defaultValue={milestone.target_date ?? ""}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-light mb-1">Status</label>
          <select
            name="status"
            defaultValue={milestone.status}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          >
            {(Object.keys(MILESTONE_STATUS_LABELS) as MilestoneStatus[]).map((s) => (
              <option key={s} value={s}>{MILESTONE_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {state && "error" in state && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-1.5 text-sm font-medium text-ink-light hover:bg-blue-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

interface Props {
  projectId: string;
  milestones: ProjectMilestone[];
}

export function MilestonesTab({ projectId, milestones }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(milestoneId: string, status: string) {
    startTransition(() => {
      updateMilestoneStatus(milestoneId, projectId, status);
    });
  }

  function handleDelete(milestoneId: string) {
    startTransition(() => {
      deleteMilestone(milestoneId, projectId);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-light">
        Milestones mark major checkpoints. Progress is tracked by activity hours, not milestones.
      </p>

      {!showForm && editingId === null ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-blue-200 px-4 py-2.5 text-sm text-ink-light hover:border-blue-400 hover:text-blue-700 transition"
        >
          <span className="text-lg leading-none">+</span> Add Milestone
        </button>
      ) : showForm ? (
        <AddMilestoneForm projectId={projectId} onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      ) : null}

      {milestones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-100 bg-white px-6 py-10 text-center text-sm text-ink-light">
          No milestones yet.
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.map((milestone) =>
            editingId === milestone.id ? (
              <EditMilestoneForm
                key={milestone.id}
                milestone={milestone}
                projectId={projectId}
                onSuccess={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={milestone.id}
                className="flex flex-col gap-2 rounded-xl border border-blue-50 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Left */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{milestone.title}</p>
                  <p className="mt-0.5 text-xs text-ink-light">{formatDate(milestone.target_date)}</p>
                </div>

                {/* Right */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      MILESTONE_STATUS_CLASSES[milestone.status]
                    }`}
                  >
                    {MILESTONE_STATUS_LABELS[milestone.status]}
                  </span>
                  <select
                    value={milestone.status}
                    onChange={(e) => handleStatusChange(milestone.id, e.target.value)}
                    disabled={isPending}
                    aria-label="Update milestone status"
                    className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-xs text-ink focus:outline-none disabled:opacity-50"
                  >
                    {(Object.keys(MILESTONE_STATUS_LABELS) as MilestoneStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {MILESTONE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => { setEditingId(milestone.id); setShowForm(false); }}
                    disabled={isPending}
                    aria-label="Edit milestone"
                    title="Edit"
                    className="rounded p-1 text-ink-light hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(milestone.id)}
                    disabled={isPending}
                    aria-label="Delete milestone"
                    className="rounded p-1 text-ink-light hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
