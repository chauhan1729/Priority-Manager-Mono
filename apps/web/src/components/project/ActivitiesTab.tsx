"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useState } from "react";

import { todayISO } from "@pm/domain";
import type { Activity, ActivityStatus, Contact, Project } from "@pm/types";
import {
  bulkCreateProjectActivities,
  createProjectActivity,
  deleteProjectActivity,
  updateActivityStatus,
  type ActionResult,
} from "@/app/(app)/project-planner/actions";
import { archiveActivity, bulkDeleteActivities, bulkMoveActivities, updateActivity } from "@/app/(app)/activities/actions";
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

      {/* Recurrence */}
      <div>
        <label className="block text-xs text-ink-light mb-1">Repeat</label>
        <select
          name="recurrence_rule"
          defaultValue=""
          className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
        >
          <option value="">Does not repeat</option>
          <option value="daily">Daily (next 3 days)</option>
          <option value="weekly">Weekly (next 3 weeks)</option>
          <option value="monthly">Monthly (next 3 months)</option>
        </select>
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
  linkedPriorityTitle: string | null;
}

// ---------------------------------------------------------------------------
// Bulk-create form
// ---------------------------------------------------------------------------

interface BulkCreateFormProps {
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function BulkCreateForm({ projectId, onSuccess, onCancel }: BulkCreateFormProps) {
  const boundAction = bulkCreateProjectActivities.bind(null, projectId);
  const [state, formAction] = useActionState<ActionResult, FormData>(boundAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
      showToast("Activities created");
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
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-ink-light uppercase tracking-wide">Bulk Add Activities</h4>
        <button type="button" onClick={onCancel} className="text-xs text-ink-light hover:text-ink">✕ Cancel</button>
      </div>

      <div>
        <label className="block text-xs text-ink-light mb-1">
          Activity names <span className="text-red-500">*</span>
          <span className="ml-1 text-ink-light/60">(one per line)</span>
        </label>
        <textarea
          name="titles"
          required
          rows={5}
          autoFocus
          placeholder={"Write report\nPrepare slides\nReview feedback"}
          className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-ink-light mb-1">Date <span className="text-red-500">*</span></label>
          <input
            name="activity_date"
            type="date"
            required
            min={todayISO()}
            defaultValue={todayISO()}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-light mb-1">Est. hours each <span className="text-red-500">*</span></label>
          <input
            name="estimated_hours"
            type="number"
            min="0.25"
            step="0.25"
            required
            placeholder="e.g. 1"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-ink-light mb-1">Priority (common for all)</label>
        <select
          name="priority"
          defaultValue=""
          className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
        >
          <option value="">None</option>
          <option value="A">A — Must do</option>
          <option value="B">B — Should do</option>
        </select>
      </div>

      {state && "error" in state && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-1.5 text-sm font-medium text-ink-light hover:bg-blue-50">Cancel</button>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Create All</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

/** Adds N days to an ISO date string (local-time, no UTC shift). */
function addDays(iso: string, n: number): string {
  const p = iso.split("-");
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ActivitiesTab({ projectId, activities, projects, contacts, linkedPriorityTitle }: Props) {
  const [showForm, setShowForm] = useState<"single" | "bulk" | null>(null);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "delegated" | "archived">("active");
  const [isPending, startTransition] = useTransition();

  // Bulk edit state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetDate, setBulkTargetDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  function toggleSelect(id: string) {
    // Only non-completed/cancelled activities can be bulk-selected
    const activity = activities.find((a) => a.id === id);
    if (!activity || ARCHIVED_STATUSES.includes(activity.status)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkMove(toDate: string) {
    if (!toDate || selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await bulkMoveActivities([...selectedIds], toDate, todayISO());
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast(`${selectedIds.size} ${selectedIds.size === 1 ? "activity" : "activities"} moved`);
        setSelectedIds(new Set());
        setBulkMode(false);
        setBulkTargetDate("");
      }
    });
  }

  function handleBulkDelete() {
    const count = selectedIds.size;
    startTransition(async () => {
      const result = await bulkDeleteActivities([...selectedIds]);
      setConfirmDelete(false);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast(`${count} ${count === 1 ? "activity" : "activities"} deleted`);
        setSelectedIds(new Set());
        setBulkMode(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Linked monthly priority context */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-violet-400">📌</span>
        {linkedPriorityTitle ? (
          <span className="text-violet-700 max-w-[20rem] truncate">{linkedPriorityTitle}</span>
        ) : (
          <span className="italic text-ink-light/60">Not a monthly priority</span>
        )}
      </div>

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
            onClick={() => { setActiveTab(key); setShowForm(null); setBulkMode(false); setSelectedIds(new Set()); setConfirmDelete(false); }}
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

      {/* Bulk action bar — only in Active tab when bulk mode on */}
      {activeTab === "active" && bulkMode && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-indigo-700">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-indigo-700 font-medium">Move to:</label>
              <input
                type="date"
                value={bulkTargetDate}
                min={addDays(todayISO(), 1)}
                onChange={(e) => setBulkTargetDate(e.target.value)}
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs text-ink focus:border-indigo-400 focus:outline-none"
              />
              <button
                onClick={() => handleBulkMove(bulkTargetDate)}
                disabled={!bulkTargetDate || selectedIds.size === 0 || isPending}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Move Selected
              </button>
              <button
                onClick={() => handleBulkMove(addDays(todayISO(), 1))}
                disabled={selectedIds.size === 0 || isPending}
                className="rounded-lg border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
              >
                Postpone to Tomorrow
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1">
                  <span className="text-xs text-red-700">
                    Delete {selectedIds.size} {selectedIds.size === 1 ? "activity" : "activities"}?
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isPending}
                    className="rounded px-2 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-ink-light hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={selectedIds.size === 0 || isPending}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Delete Selected
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add activity buttons + Bulk Edit toggle — only in Active tab */}
      {activeTab === "active" && showForm === null && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowForm("single")}
            disabled={bulkMode}
            className="flex items-center gap-2 rounded-lg border border-dashed border-blue-200 px-4 py-2.5 text-sm text-ink-light hover:border-blue-400 hover:text-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-lg leading-none">+</span> Add Activity
          </button>
          <button
            onClick={() => setShowForm("bulk")}
            disabled={bulkMode}
            className="flex items-center gap-2 rounded-lg border border-dashed border-indigo-200 px-4 py-2.5 text-sm text-ink-light hover:border-indigo-400 hover:text-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-lg leading-none">⊞</span> Bulk Add
          </button>
          <button
            onClick={() => {
              setBulkMode((v) => !v);
              setSelectedIds(new Set());
              setBulkTargetDate("");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition border ${
              bulkMode
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "border-blue-100 bg-white text-ink-light hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            {bulkMode ? "✕ Cancel Bulk" : "Bulk Edit"}
          </button>
        </div>
      )}

      {/* Single add form */}
      {activeTab === "active" && showForm === "single" && (
        <AddActivityForm
          projectId={projectId}
          contacts={contacts}
          onSuccess={() => setShowForm(null)}
          onCancel={() => setShowForm(null)}
        />
      )}

      {/* Bulk add form */}
      {activeTab === "active" && showForm === "bulk" && (
        <BulkCreateForm
          projectId={projectId}
          onSuccess={() => setShowForm(null)}
          onCancel={() => setShowForm(null)}
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
          {visible.map((activity) => {
            const isSelectable = bulkMode && !ARCHIVED_STATUSES.includes(activity.status);
            const isSelected = selectedIds.has(activity.id);
            return (
            <div
              key={activity.id}
              className={`flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between transition ${
                isSelected ? "border-indigo-300 bg-indigo-50/30" : "border-blue-50"
              }`}
              onClick={isSelectable ? () => toggleSelect(activity.id) : undefined}
              style={isSelectable ? { cursor: "pointer" } : undefined}
            >
              {/* Bulk checkbox */}
              {bulkMode && (
                <div className="flex-shrink-0 self-start sm:self-auto">
                  {isSelectable ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(activity.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                      aria-label={`Select ${activity.title}`}
                    />
                  ) : (
                    <div className="h-4 w-4" aria-hidden />
                  )}
                </div>
              )}

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
          ); })}
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
