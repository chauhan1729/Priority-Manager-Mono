"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useState } from "react";

import type { ProjectResource, ResourceStatus, ResourceType } from "@pm/types";
import {
  createResource,
  deleteResource,
  updateResourceStatus,
  type ActionResult,
} from "@/app/(app)/project-planner/actions";
import { showToast } from "@/components/ui/Toaster";

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  budget: "Budget",
  employee: "Employee",
  contractor: "Contractor",
  new_hire: "New Hire",
  tool_software: "Tool / Software",
  equipment: "Equipment",
  other: "Other",
};

const RESOURCE_STATUS_LABELS: Record<ResourceStatus, string> = {
  needed: "Needed",
  requested: "Requested",
  approved: "Approved",
  acquired: "Acquired",
  delayed: "Delayed",
  cancelled: "Cancelled",
};

const RESOURCE_STATUS_CLASSES: Record<ResourceStatus, string> = {
  needed: "bg-gray-100 text-gray-600",
  requested: "bg-blue-100 text-blue-700",
  approved: "bg-indigo-100 text-indigo-700",
  acquired: "bg-green-100 text-green-700",
  delayed: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-600",
};

const RESOURCE_TYPE_CLASSES: Record<ResourceType, string> = {
  budget: "bg-emerald-50 text-emerald-700",
  employee: "bg-violet-50 text-violet-700",
  contractor: "bg-purple-50 text-purple-700",
  new_hire: "bg-pink-50 text-pink-700",
  tool_software: "bg-cyan-50 text-cyan-700",
  equipment: "bg-orange-50 text-orange-700",
  other: "bg-gray-50 text-gray-600",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Add resource form
// ---------------------------------------------------------------------------

interface AddResourceFormProps {
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddResourceForm({ projectId, onSuccess, onCancel }: AddResourceFormProps) {
  const boundAction = createResource.bind(null, projectId);
  const [state, formAction] = useActionState<ActionResult, FormData>(boundAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
      showToast("Resource added");
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
        Add Resource
      </h4>

      <div className="grid grid-cols-2 gap-3">
        {/* Type */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Type</label>
          <select
            name="resource_type"
            required
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          >
            <option value="">Select type…</option>
            {(Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).map((t) => (
              <option key={t} value={t}>
                {RESOURCE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Status</label>
          <select
            name="status"
            defaultValue="needed"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          >
            {(Object.keys(RESOURCE_STATUS_LABELS) as ResourceStatus[]).map((s) => (
              <option key={s} value={s}>
                {RESOURCE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Title */}
      <input
        name="title"
        type="text"
        required
        placeholder="Resource name / description"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Estimated cost */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Estimated Cost (optional)</label>
          <input
            name="estimated_cost"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
          />
        </div>

        {/* Needed by */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Needed By (optional)</label>
          <input
            name="needed_by_date"
            type="date"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Note */}
      <input
        name="note"
        type="text"
        placeholder="Note (optional)"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
      />

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
          Add Resource
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
  resources: ProjectResource[];
}

export function ResourcesTab({ projectId, resources }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(resourceId: string, status: string) {
    startTransition(() => {
      updateResourceStatus(resourceId, projectId, status);
    });
  }

  function handleDelete(resourceId: string) {
    startTransition(() => {
      deleteResource(resourceId, projectId);
    });
  }

  return (
    <div className="space-y-4">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-blue-200 px-4 py-2.5 text-sm text-ink-light hover:border-blue-400 hover:text-blue-700 transition"
        >
          <span className="text-lg leading-none">+</span> Add Resource
        </button>
      ) : (
        <AddResourceForm projectId={projectId} onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      )}

      {resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-100 bg-white px-6 py-10 text-center text-sm text-ink-light">
          No resources yet.
        </div>
      ) : (
        <div className="space-y-2">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="flex flex-col gap-2 rounded-xl border border-blue-50 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Left */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      RESOURCE_TYPE_CLASSES[resource.resource_type]
                    }`}
                  >
                    {RESOURCE_TYPE_LABELS[resource.resource_type]}
                  </span>
                  <span className="text-sm font-medium text-ink truncate">{resource.title}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-light">
                  {resource.estimated_cost != null && (
                    <span>${resource.estimated_cost.toLocaleString()}</span>
                  )}
                  {resource.needed_by_date && (
                    <span>Needed by {formatDate(resource.needed_by_date)}</span>
                  )}
                  {resource.note && <span className="italic">"{resource.note}"</span>}
                </div>
              </div>

              {/* Right */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <span
                  className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    RESOURCE_STATUS_CLASSES[resource.status]
                  }`}
                >
                  {RESOURCE_STATUS_LABELS[resource.status]}
                </span>
                <select
                  value={resource.status}
                  onChange={(e) => handleStatusChange(resource.id, e.target.value)}
                  disabled={isPending}
                  aria-label="Update resource status"
                  className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-xs text-ink focus:outline-none disabled:opacity-50"
                >
                  {(Object.keys(RESOURCE_STATUS_LABELS) as ResourceStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {RESOURCE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(resource.id)}
                  disabled={isPending}
                  aria-label="Delete resource"
                  className="rounded p-1 text-ink-light hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
