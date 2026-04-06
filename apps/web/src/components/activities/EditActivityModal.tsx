"use client";

import { useActionState, useEffect, useState } from "react";

import { todayISO } from "@pm/domain";
import type { Activity, ActivitySection, ActivityStatus, Project } from "@pm/types";
import { updateActivity, type ActionResult } from "@/app/(app)/activities/actions";
import { showToast } from "@/components/ui/Toaster";

const SECTION_OPTIONS: { value: ActivitySection; label: string }[] = [
  { value: "work", label: "Work" },
  { value: "outside", label: "Outside" },
  { value: "unplanned", label: "Unplanned / Sudden" },
];

const STATUS_LABELS: Record<ActivityStatus, string> = {
  not_started: "Not Started",
  working: "Working",
  completed: "Completed",
  postponed: "Postponed",
  delegated: "Delegated",
  cancelled: "Cancelled",
};

interface Props {
  activity: Activity;
  projects: Pick<Project, "id" | "name" | "status">[];
  onClose: () => void;
}

export function EditActivityModal({ activity, projects, onClose }: Props) {
  const boundAction = updateActivity.bind(null, activity.id);
  const [state, formAction] = useActionState<ActionResult, FormData>(boundAction, null);

  // Track current section to conditionally require project
  const [section, setSection] = useState<ActivitySection>(
    activity.section_type === "delegated" ? "delegated" : activity.section_type,
  );

  useEffect(() => {
    if (state && "success" in state) {
      showToast("Activity updated");
      onClose();
    }
  }, [state, onClose]);

  const isCompleted = activity.status === "completed";
  const isDelegated = activity.section_type === "delegated";
  const isWork = section === "work";
  const estimatedHours = (activity.estimated_minutes / 60).toFixed(2).replace(/\.?0+$/, "");

  // Completed activities are locked — show read-only view
  if (isCompleted) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="font-handwriting text-xl text-ink mb-3">Activity</h2>
          <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800 mb-4">
            This activity is completed and cannot be edited.
          </div>
          <p className="text-sm text-ink font-medium">{activity.title}</p>
          {activity.note && <p className="mt-1 text-xs text-ink-light italic">{activity.note}</p>}
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-handwriting text-xl text-ink mb-5">Edit Activity</h2>

        <form action={formAction} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              defaultValue={activity.title}
              className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Section */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Section</label>
              {isDelegated ? (
                <>
                  {/* Delegated section is read-only — contact managed via Communication Planner */}
                  <div className="w-full rounded-lg border border-blue-50 bg-gray-50 px-3 py-2 text-sm text-ink-light">
                    Delegated
                  </div>
                  <input type="hidden" name="section_type" value="delegated" />
                </>
              ) : (
                <select
                  name="section_type"
                  value={section}
                  onChange={(e) => setSection(e.target.value as ActivitySection)}
                  className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                >
                  {SECTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Priority</label>
              <select
                name="priority"
                defaultValue={activity.priority ?? ""}
                className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              >
                <option value="">None</option>
                <option value="A">A — Must do today</option>
                <option value="B">B — Should do today</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Date</label>
              <input
                name="activity_date"
                type="date"
                required
                min={todayISO()}
                defaultValue={activity.activity_date}
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Estimated hours */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Est. hours</label>
              <input
                name="estimated_hours"
                type="number"
                min="0.25"
                step="0.25"
                required
                defaultValue={estimatedHours}
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Project */}
          {!isDelegated && (
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">
                Project {isWork && <span className="text-red-500">*</span>}
              </label>
              <select
                name="linked_project_id"
                required={isWork}
                defaultValue={activity.linked_project_id ?? ""}
                className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              >
                <option value="">{isWork ? "Select project…" : "No project"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">Note</label>
            <input
              name="note"
              type="text"
              defaultValue={activity.note ?? ""}
              placeholder="Optional note"
              className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Move history info */}
          {activity.moved_from_date && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
              Originally planned for {activity.moved_from_date}
            </p>
          )}

          {/* Delegated contact info */}
          {isDelegated && (
            <p className="text-xs text-ink-light bg-gray-50 rounded-lg px-3 py-1.5">
              Delegated contact is managed from Communication Planner.
            </p>
          )}

          {state && "error" in state && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
