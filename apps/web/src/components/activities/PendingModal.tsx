"use client";

import type { Activity, Contact } from "@pm/types";
import { ActivityCard } from "./ActivityCard";

/** "Yesterday" or "N days overdue" from an ISO date relative to today (local). */
function overdueLabel(activityDate: string, today: string): string {
  const [ay, am, ad] = activityDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const a = new Date(ay!, am! - 1, ad!);
  const t = new Date(ty!, tm! - 1, td!);
  const days = Math.round((t.getTime() - a.getTime()) / 86_400_000);
  return days <= 1 ? "Yesterday" : `${days} days overdue`;
}

interface Props {
  activities: Activity[];
  today: string;
  /** Screen label for the modal title, e.g. "A Activities". */
  title: string;
  projectMap: Map<string, string>;
  contactMap: Map<string, string>;
  contacts: Pick<Contact, "id" | "full_name">[];
  projectPriorityMap?: Map<string, string | null>;
  isPending: boolean;
  onStatusChange: (
    id: string,
    status: string,
    projectId: string | null,
  ) => void;
  onDelegate: (id: string, contactId: string, projectId: string | null) => void;
  onDelete: (id: string, projectId: string | null) => void;
  onPostpone: (id: string, projectId: string | null) => void;
  onEdit: (activity: Activity) => void;
  onArchive: (id: string, projectId: string | null) => void;
  onTogglePriority?: ((activity: Activity) => void) | undefined;
  onMoveToSomeday?: ((activity: Activity) => void) | undefined;
  onMoveToWeek?: ((activity: Activity) => void) | undefined;
  onBringToToday: (activity: Activity) => void;
  onBringAll: () => void;
  onClose: () => void;
}

/**
 * The Pending backlog as a focused dialog: overdue-but-still-open activities that
 * slipped past their day. Opened from the header count-pill on the Today view.
 */
export function PendingModal({
  activities,
  today,
  title,
  projectMap,
  contactMap,
  contacts,
  projectPriorityMap = new Map(),
  isPending,
  onStatusChange,
  onDelegate,
  onDelete,
  onPostpone,
  onEdit,
  onArchive,
  onTogglePriority,
  onMoveToSomeday,
  onMoveToWeek,
  onBringToToday,
  onBringAll,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-amber-100 bg-amber-50/50 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-handwriting text-xl text-ink">
              <span>⏳</span> Pending
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {activities.length}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-ink-light">
              {title} · overdue and still open — bring them to today or clear
              them.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-light transition hover:bg-amber-100 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {activities.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-ink-light">
              All caught up 🎉
            </div>
          ) : (
            activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                projectMap={projectMap}
                contactMap={contactMap}
                contacts={contacts}
                isPending={isPending}
                projectPriorityMap={projectPriorityMap}
                overdueLabel={overdueLabel(activity.activity_date, today)}
                onBringToToday={onBringToToday}
                compactActions
                onStatusChange={onStatusChange}
                onDelegate={onDelegate}
                onDelete={onDelete}
                onPostpone={onPostpone}
                onEdit={onEdit}
                onArchive={onArchive}
                onTogglePriority={onTogglePriority}
                onMoveToSomeday={onMoveToSomeday}
                onMoveToWeek={onMoveToWeek}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-blue-50 px-5 py-3">
          {activities.length > 0 && (
            <button
              onClick={onBringAll}
              disabled={isPending}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
            >
              Bring all to today
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm font-medium text-ink-light hover:bg-blue-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
