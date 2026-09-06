"use client";

import { useEffect, useState } from "react";

import { isMeetingPast } from "@pm/domain";
import type { Activity, ActivityStatus, Contact, Meeting } from "@pm/types";

const CATEGORY_STYLES: Record<string, string> = {
  personal: "bg-violet-100 text-violet-700",
  professional: "bg-blue-100 text-blue-700",
  family: "bg-rose-100 text-rose-700",
  client: "bg-amber-100 text-amber-700",
  vendor: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-600",
};

function formatMeetingDate(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMeetingTime(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

const MEETING_STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  missed: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

const ACTIVITY_STATUS_STYLES: Record<ActivityStatus, string> = {
  not_started: "bg-gray-100 text-gray-600",
  working: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  postponed: "bg-amber-100 text-amber-700",
  delegated: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-600",
};

const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  not_started: "Not started",
  working: "Working",
  completed: "Completed",
  postponed: "Postponed",
  delegated: "Delegated",
  cancelled: "Cancelled",
};

function formatActivityDate(iso: string): string {
  const p = iso.split("-");
  return new Date(
    Number(p[0]),
    Number(p[1]) - 1,
    Number(p[2]),
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface Props {
  contact: Contact;
  meetings: Meeting[];
  delegatedActivities: Activity[];
  isPending: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveNote: (note: string) => void;
}

export function ContactDrawer({
  contact,
  meetings,
  delegatedActivities,
  isPending,
  onClose,
  onEdit,
  onDelete,
  onSaveNote,
}: Props) {
  const [note, setNote] = useState(contact.note ?? "");
  const [noteDirty, setNoteDirty] = useState(false);

  // Sync note when contact changes (e.g. user opens a different contact)
  useEffect(() => {
    setNote(contact.note ?? "");
    setNoteDirty(false);
  }, [contact.id, contact.note]);

  const upcomingMeetings = meetings
    .filter((m) => !isMeetingPast(m) && m.status === "upcoming")
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const pastMeetings = meetings
    .filter((m) => isMeetingPast(m))
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
  const nextMeeting = upcomingMeetings[0] ?? null;
  const recentMeetings = pastMeetings.slice(0, 3);

  const categoryStyle =
    CATEGORY_STYLES[contact.category] ?? CATEGORY_STYLES["other"]!;

  function handleSaveNote() {
    onSaveNote(note);
    setNoteDirty(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer panel */}
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-blue-100">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-handwriting text-2xl text-ink">
                {contact.full_name}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryStyle}`}
              >
                {contact.category}
              </span>
            </div>
            {(contact.role || contact.company) && (
              <p className="text-sm text-ink-light mt-0.5 truncate">
                {[contact.role, contact.company].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-ink-light hover:text-ink transition text-lg leading-none mt-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Contact info */}
          <section className="space-y-1">
            {contact.email && (
              <div className="flex items-center gap-2 text-sm text-ink-light">
                <span className="text-[10px] font-semibold uppercase tracking-wide w-12 flex-shrink-0">
                  Email
                </span>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-blue-600 hover:underline truncate"
                >
                  {contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm text-ink-light">
                <span className="text-[10px] font-semibold uppercase tracking-wide w-12 flex-shrink-0">
                  Phone
                </span>
                <span>{contact.phone}</span>
              </div>
            )}
            {!contact.email && !contact.phone && (
              <p className="text-xs text-ink-light/60 italic">
                No contact details added.
              </p>
            )}
          </section>

          {/* Next meeting — from shared Meeting model (spec §10.7 + §11.1) */}
          <section>
            <h3 className="text-[10px] font-semibold text-ink-light uppercase tracking-wide mb-2">
              Next Meeting
            </h3>
            {nextMeeting ? (
              <a
                href="/meeting-planner"
                className="block rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5 hover:border-blue-300 transition-colors"
              >
                <p className="text-xs font-medium text-ink truncate">
                  {nextMeeting.title}
                </p>
                <p className="text-[10px] text-ink-light mt-0.5">
                  {formatMeetingDate(nextMeeting.start_at)} ·{" "}
                  {formatMeetingTime(nextMeeting.start_at)}
                </p>
              </a>
            ) : (
              <div className="rounded-lg border border-blue-50 bg-blue-50/40 px-3 py-2.5 text-xs text-ink-light">
                No upcoming meetings.{" "}
                <a
                  href="/meeting-planner"
                  className="text-blue-600 hover:underline"
                >
                  Schedule one.
                </a>
              </div>
            )}
          </section>

          {/* Last 3 past meetings — from shared Meeting model */}
          <section>
            <h3 className="text-[10px] font-semibold text-ink-light uppercase tracking-wide mb-2">
              Recent Meetings
            </h3>
            {recentMeetings.length > 0 ? (
              <div className="space-y-1.5">
                {recentMeetings.map((m) => (
                  <a
                    key={m.id}
                    href="/meeting-planner"
                    className="flex items-center justify-between gap-2 rounded-lg border border-blue-50 bg-white px-3 py-2 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-ink truncate">
                        {m.title}
                      </p>
                      <p className="text-[10px] text-ink-light">
                        {formatMeetingDate(m.start_at)}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${MEETING_STATUS_STYLES[m.status] ?? MEETING_STATUS_STYLES["upcoming"]!}`}
                    >
                      {m.status}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-blue-50 bg-blue-50/40 px-3 py-2.5 text-xs text-ink-light">
                No past meetings recorded.
              </div>
            )}
          </section>

          {/* Delegated activities */}
          <section>
            <h3 className="text-[10px] font-semibold text-ink-light uppercase tracking-wide mb-2">
              Delegated Tasks
              {delegatedActivities.length > 0 && (
                <span className="ml-1.5 font-normal opacity-60">
                  {delegatedActivities.length}
                </span>
              )}
            </h3>
            {delegatedActivities.length > 0 ? (
              <div className="space-y-1.5">
                {delegatedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-blue-50 bg-white px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[11px] font-medium text-ink truncate ${activity.status === "completed" ? "line-through text-ink-light" : ""}`}
                      >
                        {activity.title}
                      </p>
                      <p className="text-[10px] text-ink-light mt-0.5">
                        {formatActivityDate(activity.activity_date)}
                        {activity.note && (
                          <span className="ml-1.5 italic">
                            · {activity.note}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${ACTIVITY_STATUS_STYLES[activity.status]}`}
                    >
                      {ACTIVITY_STATUS_LABELS[activity.status]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-blue-50 bg-blue-50/40 px-3 py-2.5 text-xs text-ink-light">
                No tasks delegated to this person.
              </div>
            )}
          </section>

          {/* Rolling note */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-semibold text-ink-light uppercase tracking-wide">
                Note
              </h3>
              {noteDirty && (
                <button
                  onClick={handleSaveNote}
                  disabled={isPending}
                  className="text-[10px] font-medium text-blue-600 hover:underline disabled:opacity-50"
                >
                  Save note
                </button>
              )}
            </div>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteDirty(true);
              }}
              placeholder="Add a rolling note about this contact…"
              rows={4}
              className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/40 focus:border-blue-400 focus:outline-none resize-none"
            />
            {noteDirty && (
              <p className="text-[10px] text-ink-light/60 mt-1">
                Unsaved changes — click Save note above.
              </p>
            )}
          </section>
        </div>

        {/* Footer actions */}
        <div className="border-t border-blue-100 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onDelete}
            disabled={isPending}
            className="text-sm text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
          >
            Delete contact
          </button>
          <button
            onClick={onEdit}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Edit contact
          </button>
        </div>
      </aside>
    </>
  );
}
