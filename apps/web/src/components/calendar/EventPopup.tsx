"use client";

import { useState } from "react";

import {
  isCalendarEventPast,
  isDateInAwayPeriod,
  isMeetingPast,
  needsStatusUpdatePrompt,
} from "@pm/domain";
import type {
  CalendarEventStatus,
  Contact,
  YearEntry,
} from "@pm/types";

import type { CalendarDayEvent } from "./CalendarView";
import type { updateCalendarEvent } from "@/app/(app)/calendar/actions";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTimeRange(startAt: string, endAt: string): string {
  return `${formatTime(startAt)} – ${formatTime(endAt)}`;
}

const STATUS_STYLES: Record<CalendarEventStatus, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  missed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

// ---------------------------------------------------------------------------
// Type label helpers
// ---------------------------------------------------------------------------

function getTypeLabel(kind: CalendarDayEvent["kind"], eventType?: string): string {
  if (kind === "birthday") return "Birthday";
  if (kind === "away") return "Away / Travel";
  if (kind === "orphan_meeting") return "Meeting";
  switch (eventType) {
    case "meeting": return "Meeting";
    case "appointment": return "Appointment";
    case "renewal": return "Renewal";
    case "other": return "Other";
    default: return "Event";
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  event: CalendarDayEvent;
  contactMap: Map<string, Contact>;
  yearEntries: YearEntry[];
  isPending: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Parameters<typeof updateCalendarEvent>[1]) => void;
  onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventPopup({
  event,
  contactMap,
  yearEntries,
  isPending,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editStatus, setEditStatus] = useState<CalendarEventStatus | null>(null);

  // Derive event metadata
  const isBirthday = event.kind === "birthday";
  const isAway = event.kind === "away";
  const isOrphanMeeting = event.kind === "orphan_meeting";

  const title =
    isBirthday || isAway
      ? event.data.title
      : event.data.title;

  const date =
    isBirthday || isAway
      ? event.data.start_date
      : event.kind === "orphan_meeting"
      ? event.data.date
      : event.data.date;

  const isPast = (() => {
    if (isBirthday || isAway) return false;
    if (isOrphanMeeting) return isMeetingPast(event.data);
    return isCalendarEventPast(event.data);
  })();

  const needsUpdate = isOrphanMeeting && needsStatusUpdatePrompt(event.data);

  const contact = (() => {
    if (isBirthday || isAway) return null;
    const contactId =
      isOrphanMeeting
        ? event.data.linked_contact_id
        : event.data.linked_contact_id;
    return contactId ? (contactMap.get(contactId) ?? null) : null;
  })();

  // Can delete? Birthday/away entries are managed in Year at a Glance
  const canDelete = !isBirthday && !isAway;

  // Can update status? Only for calendar_event types (not orphan_meeting, birthday, away)
  const canUpdateStatus =
    event.kind === "calendar_event" &&
    event.data.event_type !== "birthday" &&
    event.data.event_type !== "renewal";

  // Current status for calendar events
  const currentStatus =
    event.kind === "calendar_event" ? event.data.status : null;

  function handleStatusSave() {
    if (!editStatus || event.kind !== "calendar_event") return;
    onUpdate(event.data.id, { status: editStatus });
  }

  function handleDelete() {
    if (event.kind === "calendar_event") {
      onDelete(event.data.id);
    } else if (isOrphanMeeting) {
      // Orphan meeting delete should call meeting-planner delete
      // For now, show info — user should delete from Meeting Planner
      // (we don't import meeting actions here to keep bundles clean)
      onClose();
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-xl flex flex-col sm:rounded-l-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-blue-50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-light">
                {getTypeLabel(event.kind, event.kind === "calendar_event" ? event.data.event_type : undefined)}
              </span>
              {currentStatus && (
                <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${STATUS_STYLES[currentStatus]}`}>
                  {currentStatus}
                </span>
              )}
              {needsUpdate && (
                <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-orange-100 text-orange-700">
                  Needs update
                </span>
              )}
            </div>
            <h2 className="font-medium text-base text-ink leading-snug truncate">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-light hover:text-ink transition text-lg leading-none flex-shrink-0 mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Date & time */}
          <div>
            <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">Date</p>
            <p className="text-sm text-ink">{formatDate(date)}</p>
            {!isBirthday && !isAway && (() => {
              const startAt = isOrphanMeeting ? event.data.start_at : event.data.start_at;
              const endAt = isOrphanMeeting ? event.data.end_at : event.data.end_at;
              if (!startAt || !endAt) return null;
              return <p className="text-sm text-ink-light mt-0.5">{formatTimeRange(startAt, endAt)}</p>;
            })()}
          </div>

          {/* Contact */}
          {contact && (
            <div>
              <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">Contact</p>
              <p className="text-sm text-ink">{contact.full_name}</p>
              {(contact.role || contact.company) && (
                <p className="text-xs text-ink-light">{[contact.role, contact.company].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          )}

          {/* Location */}
          {event.kind === "calendar_event" && event.data.location && (
            <div>
              <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">Location</p>
              <p className="text-sm text-ink">{event.data.location}</p>
            </div>
          )}

          {/* Notes / agenda */}
          {event.kind === "calendar_event" && event.data.notes && (
            <div>
              <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                {event.data.event_type === "meeting" ? "Agenda" : "Notes"}
              </p>
              <p className="text-sm text-ink whitespace-pre-wrap">{event.data.notes}</p>
            </div>
          )}

          {/* Orphan meeting: agenda + takeaways */}
          {isOrphanMeeting && (
            <>
              {event.data.agenda && (
                <div>
                  <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">Agenda</p>
                  <p className="text-sm text-ink whitespace-pre-wrap">{event.data.agenda}</p>
                </div>
              )}
              {event.data.key_takeaways && (
                <div>
                  <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">Key Takeaways</p>
                  <p className="text-sm text-ink whitespace-pre-wrap">{event.data.key_takeaways}</p>
                </div>
              )}
            </>
          )}

          {/* Status update prompt for past meeting events — spec §10.9 */}
          {needsUpdate && (
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">How did this meeting go?</p>
              <p className="text-xs text-orange-600 mb-2">
                This meeting&apos;s time has passed. Update the status in Meeting Planner.
              </p>
              <a
                href="/meeting-planner"
                className="text-xs font-medium text-orange-700 underline hover:no-underline"
              >
                Open Meeting Planner →
              </a>
            </div>
          )}

          {/* Away period: date range */}
          {isAway && (
            <div>
              <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">Period</p>
              <p className="text-sm text-ink">
                {formatDate(event.data.start_date)}
                {event.data.end_date && event.data.end_date !== event.data.start_date && (
                  <> → {formatDate(event.data.end_date)}</>
                )}
              </p>
              {event.data.location && (
                <p className="text-xs text-ink-light mt-0.5">{event.data.location}</p>
              )}
              <p className="text-xs text-ink-light mt-2">
                Manage this entry in Year at a Glance.
              </p>
            </div>
          )}

          {/* Birthday info */}
          {isBirthday && (
            <p className="text-xs text-ink-light">
              Birthday entries are managed in Year at a Glance.
            </p>
          )}

          {/* Status update for calendar events */}
          {canUpdateStatus && isPast && !needsUpdate && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs font-semibold text-ink-light mb-2">Update status</p>
              <div className="flex flex-wrap gap-1.5">
                {(["completed", "missed", "cancelled"] as CalendarEventStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditStatus(s)}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-medium border transition",
                      editStatus === s || (!editStatus && currentStatus === s)
                        ? STATUS_STYLES[s]
                        : "border-gray-200 text-ink-light hover:border-gray-300",
                    ].join(" ")}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              {editStatus && editStatus !== currentStatus && (
                <button
                  type="button"
                  onClick={handleStatusSave}
                  disabled={isPending}
                  className="mt-2 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                >
                  Save status
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {canDelete && (
          <div className="border-t border-blue-50 px-5 py-3 flex items-center justify-between">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
              >
                {isOrphanMeeting ? "Delete in Meeting Planner" : "Delete event"}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-light">Delete this event?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-ink-light hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}

            {!showDeleteConfirm && isOrphanMeeting && (
              <a
                href="/meeting-planner"
                className="text-xs text-blue-600 hover:underline"
              >
                Open in Meeting Planner →
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
