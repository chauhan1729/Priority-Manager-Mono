"use client";

import { useState } from "react";
import Link from "next/link";

import type { Activity, ActivityStatus, Contact } from "@pm/types";

const STATUS_LABELS: Record<ActivityStatus, string> = {
  not_started: "Not Started",
  working: "Working",
  completed: "Completed",
  postponed: "Postponed",
  delegated: "Delegated",
  cancelled: "Cancelled",
};

const STATUS_CLASSES: Record<ActivityStatus, string> = {
  not_started: "bg-gray-100 text-gray-600",
  working: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  postponed: "bg-amber-100 text-amber-700",
  delegated: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-600",
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
  activity: Activity;
  projectMap: Map<string, string>;
  contactMap: Map<string, string>;
  contacts: Pick<Contact, "id" | "full_name">[];
  isPending: boolean;
  projectPriorityMap?: Map<string, string | null>;
  bulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: ((id: string) => void) | undefined;
  onStatusChange: (id: string, status: string, projectId: string | null) => void;
  onDelegate: (id: string, contactId: string, projectId: string | null) => void;
  onDelete: (id: string, projectId: string | null) => void;
  onPostpone: (id: string, projectId: string | null) => void;
  onEdit: (activity: Activity) => void;
  onArchive: (id: string, projectId: string | null) => void;
}

export function ActivityCard({
  activity,
  projectMap,
  contactMap,
  contacts,
  isPending,
  projectPriorityMap = new Map(),
  bulkMode = false,
  isSelected = false,
  onToggleSelect,
  onStatusChange,
  onDelegate,
  onDelete,
  onPostpone,
  onEdit,
  onArchive,
}: Props) {
  const [delegatePickerOpen, setDelegatePickerOpen] = useState(false);
  const [delegateContactId, setDelegateContactId] = useState("");
  const projectName = activity.linked_project_id
    ? (projectMap.get(activity.linked_project_id) ?? null)
    : null;
  const delegatedContactName = activity.delegated_contact_id
    ? (contactMap.get(activity.delegated_contact_id) ?? null)
    : null;
  const linkedPriorityTitle = activity.linked_project_id
    ? (projectPriorityMap.get(activity.linked_project_id) ?? null)
    : null;

  const isDone =
    activity.status === "completed" || activity.status === "cancelled";

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between transition ${
        isDone ? "border-gray-100 opacity-70" : isSelected ? "border-indigo-300 bg-indigo-50/30" : "border-blue-50 hover:border-blue-100"
      }`}
      onClick={bulkMode && !isDone ? () => onToggleSelect?.(activity.id) : undefined}
      style={bulkMode && !isDone ? { cursor: "pointer" } : undefined}
    >
      {/* Bulk checkbox — only for non-completed activities */}
      {bulkMode && (
        <div className="flex-shrink-0 self-start sm:self-auto">
          {!isDone ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(activity.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              aria-label={`Select ${activity.title}`}
            />
          ) : (
            <div className="h-4 w-4" aria-hidden />
          )}
        </div>
      )}

      {/* Left: priority + title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority badge */}
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

          {/* Title */}
          <span
            className={`text-sm font-medium truncate ${
              isDone ? "line-through text-ink-light" : "text-ink"
            }`}
          >
            {activity.title}
          </span>

          {/* Moved from indicator */}
          {activity.moved_from_date && (
            <span className="text-xs text-amber-600" title={`Originally planned for ${activity.moved_from_date}`}>
              ↷ moved
            </span>
          )}
        </div>

        {/* Secondary row: project/contact name + time */}
        <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-ink-light">
          {projectName && (
            <Link
              href={`/project-planner/${activity.linked_project_id}`}
              className="text-blue-600 hover:underline truncate"
            >
              {projectName}
            </Link>
          )}
          {linkedPriorityTitle && (
            <span
              title={`Linked to monthly priority: ${linkedPriorityTitle}`}
              className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
            >
              ★ {linkedPriorityTitle}
            </span>
          )}
          {delegatedContactName && (
            <span className="text-purple-600 truncate">→ {delegatedContactName}</span>
          )}
          <span>{formatMinutes(activity.estimated_minutes)}</span>
          {activity.hours_worked > 0 && (
            <span className="text-green-600" title="Hours worked">{formatMinutes(activity.hours_worked)} worked</span>
          )}
          {activity.note && (
            <span className="italic truncate max-w-[200px]">"{activity.note}"</span>
          )}
        </div>
      </div>

      {/* Right: status + actions */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {/* Status pill (hidden on mobile) */}
        <span
          className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_CLASSES[activity.status]
          }`}
        >
          {STATUS_LABELS[activity.status]}
        </span>

        {/* Status select */}
        <select
          value={activity.status}
          onChange={(e) => {
            const newStatus = e.target.value;
            if (newStatus === "delegated" && activity.status !== "delegated") {
              setDelegatePickerOpen(true);
            } else {
              onStatusChange(activity.id, newStatus, activity.linked_project_id);
            }
          }}
          disabled={isPending}
          aria-label="Update status"
          className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-xs text-ink focus:outline-none disabled:opacity-50"
        >
          {(Object.keys(STATUS_LABELS) as ActivityStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {/* Quick complete */}
        {!isDone && (
          <button
            onClick={() =>
              onStatusChange(activity.id, "completed", activity.linked_project_id)
            }
            disabled={isPending}
            aria-label="Mark complete"
            title="Mark complete"
            className="rounded p-1 text-ink-light hover:bg-green-50 hover:text-green-600 disabled:opacity-50 transition"
          >
            ✓
          </button>
        )}

        {/* Postpone to tomorrow */}
        {!isDone && (
          <button
            onClick={() => onPostpone(activity.id, activity.linked_project_id)}
            disabled={isPending}
            aria-label="Postpone to tomorrow"
            title="Postpone to tomorrow"
            className="rounded p-1 text-ink-light hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 transition"
          >
            ↷
          </button>
        )}

        {/* Edit — locked once completed */}
        {!isDone && (
          <button
            onClick={() => onEdit(activity)}
            disabled={isPending}
            aria-label="Edit activity"
            title="Edit"
            className="rounded p-1 text-ink-light hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition"
          >
            ✎
          </button>
        )}

        {/* Archive (for done activities) */}
        {isDone && (
          <button
            onClick={() => onArchive(activity.id, activity.linked_project_id)}
            disabled={isPending}
            aria-label="Archive activity"
            title="Archive"
            className="rounded p-1 text-ink-light hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 transition text-xs"
          >
            ⊘
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => onDelete(activity.id, activity.linked_project_id)}
          disabled={isPending}
          aria-label="Delete activity"
          title="Delete"
          className="rounded p-1 text-ink-light hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition"
        >
          ×
        </button>
      </div>

      {/* Inline delegate contact picker */}
      {delegatePickerOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
          <span className="text-xs font-medium text-purple-800">Delegate to:</span>
          {contacts.length === 0 ? (
            <a href="/communication-planner" className="text-xs text-blue-600 hover:underline">
              Add a contact first
            </a>
          ) : (
            <select
              value={delegateContactId}
              onChange={(e) => setDelegateContactId(e.target.value)}
              autoFocus
              className="rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs text-ink focus:outline-none"
            >
              <option value="">Select person…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              if (!delegateContactId) return;
              onDelegate(activity.id, delegateContactId, activity.linked_project_id);
              setDelegatePickerOpen(false);
              setDelegateContactId("");
            }}
            disabled={!delegateContactId || isPending}
            className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40"
          >
            Confirm
          </button>
          <button
            onClick={() => { setDelegatePickerOpen(false); setDelegateContactId(""); }}
            className="text-xs text-ink-light hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
