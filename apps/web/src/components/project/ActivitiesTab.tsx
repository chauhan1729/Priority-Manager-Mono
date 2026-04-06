"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useState } from "react";

import { todayISO } from "@pm/domain";
import type { Activity, ActivityStatus, Contact, Project } from "@pm/types";
import {
  createProjectActivity,
  deleteProjectActivity,
  updateActivityStatus,
  type ActionResult,
} from "@/app/(app)/project-planner/actions";
import { archiveActivity, updateActivity } from "@/app/(app)/activities/actions";
import { EditActivityModal } from "@/components/activities/EditActivityModal";
import { showToast } from "@/components/ui/Toaster";

const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  not_started: "Not Started",
  working: "Working",
  completed: "Completed",
  postponed: "Postponed",
  delegated: "Delegated",
  cancelled: "Cancelled",
};

const ACTIVITY_STATUS_CLASSES: Record<ActivityStatus, string> = {
  not_started: "bg-gray-100 text-gray-600",
  working: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  postponed: "bg-amber-100 text-amber-700",
  delegated: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-600",
};

const SECTION_LABELS: Record<string, string> = {
  work: "Work",
  outside: "Outside",
  unplanned: "Unplanned",
};

const ARCHIVED_STATUSES: ActivityStatus[] = ["completed", "cancelled"];

function formatDate(iso: string): string {
  const p = iso.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Add activity form
// ---------------------------------------------------------------------------

interface AddActivityFormProps {
  projectId: string;
  contacts: Pick<Contact, "id" | "full_name">[];
  onSuccess: () => void;
  onCancel: () => void;
}

function AddActivityForm({ projectId, contacts, onSuccess, onCancel }: AddActivityFormProps) {
  const boundAction = createProjectActivity.bind(null, projectId);
  const [state, formAction] = useActionState<ActionResult, FormData>(boundAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [section, setSection] = useState("work");
  const isDelegated = section === "delegated";

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
      showToast("Activity added");
      onSuccess();
    } else if (state && "error" in state) {
      showToast(state.error, "error");
    }
  }, [state, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-ink-light uppercase tracking-wide">Add Activity</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-ink-light hover:text-ink"
        >
          ✕ Cancel
        </button>
      </div>

      {/* Title */}
      <input
        name="title"
        type="text"
        required
        autoFocus
        placeholder="Activity title"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Date */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Date</label>
          <input
            name="activity_date"
            type="date"
            required
            min={todayISO()}
            defaultValue={todayISO()}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Estimated hours */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Estimated hours</label>
          <input
            name="estimated_hours"
            type="number"
            min="0.25"
            step="0.25"
            required
            placeholder="e.g. 2"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Section */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Section</label>
          <select
            name="section_type"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          >
            <option value="work">Work</option>
            <option value="outside">Outside</option>
            <option value="unplanned">Unplanned</option>
            <option value="delegated">Delegated</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Priority</label>
          <select
            name="priority"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          >
            <option value="">None</option>
            <option value="A">A — Must do</option>
            <option value="B">B — Should do</option>
          </select>
        </div>
      </div>

      {/* Contact picker — only when Delegated */}
      {isDelegated && (
        <div>
          <label className="block text-xs text-ink-light mb-1">
            Delegate to <span className="text-red-500">*</span>
          </label>
          {contacts.length === 0 ? (
            <p className="text-xs text-ink-light">
              No contacts yet.{" "}
              <a href="/communication-planner" className="text-blue-600 hover:underline">
                Add one first.
              </a>
            </p>
          ) : (
            <select
              name="delegated_contact_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
            >
              <option value="">Select person…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

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
          Add Activity
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
  activities: Activity[];
  projects: Pick<Project, "id" | "name" | "status">[];
  contacts: Pick<Contact, "id" | "full_name">[];
}

export function ActivitiesTab({ projectId, activities, projects, contacts }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "delegated" | "archived">("active");
  const [isPending, startTransition] = useTransition();

  const contactMap = new Map(contacts.map((c) => [c.id, c.full_name]));

  const active = activities.filter(
    (a) => !a.archived && a.section_type !== "delegated",
  );
  const delegated = activities.filter(
    (a) => !a.archived && a.section_type === "delegated",
  );
  const archived = activities.filter((a) => a.archived);
  const visible = activeTab === "active" ? active : activeTab === "delegated" ? delegated : archived;

  function handleStatusChange(activityId: string, status: string) {
    startTransition(async () => {
      await updateActivityStatus(activityId, projectId, status);
      showToast("Status updated");
    });
  }

  function handleDelete(activityId: string) {
    startTransition(async () => {
      await deleteProjectActivity(activityId, projectId);
      showToast("Activity deleted");
    });
  }

  function handleArchive(activityId: string) {
    startTransition(async () => {
      await archiveActivity(activityId, projectId);
      showToast("Activity archived");
    });
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-blue-100">
        {(
          [
            { key: "active",    label: "Active",    count: active.length },
            { key: "delegated", label: "Delegated", count: delegated.length },
            { key: "archived",  label: "Archived",  count: archived.length },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setShowForm(false); }}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-ink-light hover:text-ink"
            }`}
          >
            {label}
            {count > 0 && <span className="ml-1.5 text-xs opacity-60">{count}</span>}
          </button>
        ))}
      </div>

      {/* Add activity button — only in Active tab */}
      {activeTab === "active" && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-blue-200 px-4 py-2.5 text-sm text-ink-light hover:border-blue-400 hover:text-blue-700 transition"
        >
          <span className="text-lg leading-none">+</span> Add Activity
        </button>
      )}

      {/* Add form — only shown in Active tab */}
      {activeTab === "active" && showForm && (
        <AddActivityForm
          projectId={projectId}
          contacts={contacts}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Activity list */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-100 bg-white px-6 py-10 text-center text-sm text-ink-light">
          {activeTab === "archived"
            ? "No archived activities."
            : activeTab === "delegated"
            ? "No delegated activities for this project."
            : "No active activities. Add one above."}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((activity) => (
            <div
              key={activity.id}
              className="flex flex-col gap-2 rounded-xl border border-blue-50 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Left: info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {activity.priority && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                        activity.priority === "A"
                          ? "bg-red-100 text-red-600"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {activity.priority}
                    </span>
                  )}
                  <span className={`text-sm font-medium text-ink truncate ${
                    ARCHIVED_STATUSES.includes(activity.status) ? "line-through text-ink-light" : ""
                  }`}>
                    {activity.title}
                  </span>
                  <span className="text-xs text-ink-light">
                    {SECTION_LABELS[activity.section_type] ?? activity.section_type}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-light">
                  <span>{formatDate(activity.activity_date)}</span>
                  <span>{(activity.estimated_minutes / 60).toFixed(1)}h estimated</span>
                  {activity.delegated_contact_id && (
                    <span className="text-purple-600">
                      → {contactMap.get(activity.delegated_contact_id) ?? "Unknown"}
                    </span>
                  )}
                  {activity.note && <span className="italic">"{activity.note}"</span>}
                </div>
              </div>

              {/* Right: status + archive + edit + delete */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <span
                  className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    ACTIVITY_STATUS_CLASSES[activity.status]
                  }`}
                >
                  {ACTIVITY_STATUS_LABELS[activity.status]}
                </span>
                <select
                  value={activity.status}
                  onChange={(e) => handleStatusChange(activity.id, e.target.value)}
                  disabled={isPending}
                  aria-label="Update status"
                  className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-xs text-ink focus:outline-none disabled:opacity-50"
                >
                  {(Object.keys(ACTIVITY_STATUS_LABELS) as ActivityStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {ACTIVITY_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                {ARCHIVED_STATUSES.includes(activity.status) && (
                  <button
                    onClick={() => handleArchive(activity.id)}
                    disabled={isPending}
                    aria-label="Archive activity"
                    title="Move to archive"
                    className="rounded px-2 py-1 text-xs text-ink-light hover:bg-gray-100 hover:text-ink disabled:opacity-50"
                  >
                    Archive
                  </button>
                )}
                <button
                  onClick={() => setEditActivity(activity)}
                  disabled={isPending}
                  aria-label="Edit activity"
                  title="Edit"
                  className="rounded p-1 text-ink-light hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDelete(activity.id)}
                  disabled={isPending}
                  aria-label="Delete activity"
                  className="rounded p-1 text-ink-light hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal — uses the shared EditActivityModal from activities components */}
      {editActivity && (
        <EditActivityModal
          activity={editActivity}
          projects={projects}
          onClose={() => {
            setEditActivity(null);
            showToast("Activity updated");
          }}
        />
      )}
    </div>
  );
}
