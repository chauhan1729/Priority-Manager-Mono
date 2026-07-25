"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { addDays, suggestRedate, todayISO } from "@pm/domain";
import type { Activity, ActivityStatus, Contact } from "@pm/types";
import { rescheduleActivityToDate } from "@/app/(app)/activities/actions";
import { showToast } from "@/components/ui/Toaster";
import { ActivityCyclesModal } from "./ActivityCyclesModal";

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
  /** Phase 0A: one-tap promote/demote (A↔B) by clicking the priority badge. */
  onTogglePriority?: ((activity: Activity) => void) | undefined;
  /** Phase 1B: park this activity on the Someday list. */
  onMoveToSomeday?: ((activity: Activity) => void) | undefined;
  /** Pending backlog: an overdue badge label, e.g. "3 days overdue". */
  overdueLabel?: string | undefined;
  /** Pending backlog: re-date this overdue activity to today. */
  onBringToToday?: ((activity: Activity) => void) | undefined;
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
  onEdit,
  onArchive,
  onTogglePriority,
  onMoveToSomeday,
  overdueLabel,
  onBringToToday,
}: Props) {
  const [delegatePickerOpen, setDelegatePickerOpen] = useState(false);
  const [delegateContactId, setDelegateContactId] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [isRescheduling, startReschedule] = useTransition();
  const [cyclesOpen, setCyclesOpen] = useState(false);

  function doReschedule(toDate: string) {
    startReschedule(async () => {
      const res = await rescheduleActivityToDate(activity.id, toDate);
      if (res?.error) showToast(res.error, "error");
      else {
        showToast("Rescheduled");
        setRescheduleOpen(false);
      }
    });
  }
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
      onClick={bulkMode ? () => onToggleSelect?.(activity.id) : undefined}
      style={bulkMode ? { cursor: "pointer" } : undefined}
    >
      {/* Bulk checkbox — all activities selectable */}
      {bulkMode && (
        <div className="flex-shrink-0 self-start sm:self-auto">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.(activity.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
            aria-label={`Select ${activity.title}`}
          />
        </div>
      )}

      {/* Left: priority + title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority badge — one-tap promote/demote (A↔B) */}
          {onTogglePriority && !isDone && !bulkMode ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePriority(activity);
              }}
              disabled={isPending}
              title={activity.priority === "A" ? "Make B (demote)" : "Make A (promote)"}
              aria-label={activity.priority === "A" ? "Demote to B" : "Promote to A"}
              className={`rounded px-1.5 py-0.5 text-xs font-bold transition disabled:opacity-50 ${
                activity.priority === "A"
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
            >
              {activity.priority}
            </button>
          ) : (
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
          {overdueLabel && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
              ⏳ {overdueLabel}
            </span>
          )}
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
              ★ Monthly Priority
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
        {/* Bring to today — pending backlog primary action */}
        {onBringToToday && !isDone && (
          <button
            onClick={() => onBringToToday(activity)}
            disabled={isPending}
            title="Bring to today"
            className="whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
          >
            → Today
          </button>
        )}

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

        {/* Cycle history — opens a popup of every focus block for this activity */}
        <button
          onClick={() => setCyclesOpen(true)}
          aria-label="View cycles"
          title="Cycles — focus blocks worked on this activity"
          className="rounded p-1 text-ink-light transition hover:bg-indigo-50 hover:text-indigo-600"
        >
          ↻
        </button>

        {/* Reschedule to a chosen day (intentional re-dating) */}
        {!isDone && (
          <button
            onClick={() => {
              setRescheduleDate(suggestRedate(activity, todayISO()));
              setRescheduleOpen((s) => !s);
            }}
            disabled={isPending || isRescheduling}
            aria-label="Reschedule to a chosen day"
            title="Reschedule to a chosen day"
            className="rounded p-1 text-ink-light hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition"
          >
            📅
          </button>
        )}

        {/* Move to Someday */}
        {!isDone && !activity.is_someday && onMoveToSomeday && (
          <button
            onClick={() => onMoveToSomeday(activity)}
            disabled={isPending}
            aria-label="Move to Someday"
            title="Move to Someday (park outside the 30-day horizon)"
            className="rounded p-1 text-ink-light hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50 transition"
          >
            ☾
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

      {/* Inline reschedule picker — intentional re-dating (not a blind "tomorrow") */}
      {rescheduleOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <span className="text-xs font-medium text-ink-light">Reschedule to:</span>
          <button
            onClick={() => doReschedule(addDays(todayISO(), 1))}
            disabled={isRescheduling}
            className="rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            +1 day
          </button>
          <button
            onClick={() => doReschedule(addDays(todayISO(), 7))}
            disabled={isRescheduling}
            className="rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            +1 week
          </button>
          <input
            type="date"
            value={rescheduleDate}
            min={todayISO()}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-xs text-ink focus:border-blue-400 focus:outline-none"
          />
          <button
            onClick={() => doReschedule(rescheduleDate)}
            disabled={!rescheduleDate || isRescheduling}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Go
          </button>
          <button onClick={() => setRescheduleOpen(false)} className="text-xs text-ink-light hover:text-ink">
            Cancel
          </button>
        </div>
      )}

      {/* Cycle history popup */}
      {cyclesOpen && (
        <ActivityCyclesModal
          activity={activity}
          onClose={() => setCyclesOpen(false)}
        />
      )}
    </div>
  );
}
