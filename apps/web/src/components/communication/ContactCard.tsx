"use client";

import { isMeetingPast } from "@pm/domain";
import type { Contact, Meeting } from "@pm/types";

function formatMeetingDate(startAt: string): string {
  const d = new Date(startAt);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CATEGORY_STYLES: Record<string, string> = {
  personal: "bg-violet-100 text-violet-700",
  professional: "bg-blue-100 text-blue-700",
  family: "bg-rose-100 text-rose-700",
  client: "bg-amber-100 text-amber-700",
  vendor: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-600",
};

interface Props {
  contact: Contact;
  meetings: Meeting[];
  onClick: () => void;
  onEdit: () => void;
}

export function ContactCard({ contact, meetings, onClick, onEdit }: Props) {
  const categoryStyle =
    CATEGORY_STYLES[contact.category] ?? CATEGORY_STYLES["other"]!;

  // Next upcoming meeting for this contact
  const nextMeeting =
    meetings
      .filter((m) => !isMeetingPast(m) && m.status === "upcoming")
      .sort((a, b) => a.start_at.localeCompare(b.start_at))[0] ?? null;

  const noteSnippet = contact.note
    ? contact.note.length > 80
      ? contact.note.slice(0, 80) + "…"
      : contact.note
    : null;

  return (
    <div
      className="group rounded-xl border border-blue-100 bg-white p-4 space-y-3 hover:border-blue-200 hover:shadow-sm transition cursor-pointer"
      onClick={onClick}
    >
      {/* Top row: name + category badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-handwriting text-lg text-ink truncate leading-tight">
            {contact.full_name}
          </h3>
          {(contact.company || contact.role) && (
            <p className="text-xs text-ink-light truncate mt-0.5">
              {[contact.role, contact.company].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryStyle}`}
        >
          {contact.category}
        </span>
      </div>

      {/* Contact info */}
      {(contact.email || contact.phone) && (
        <div className="space-y-0.5">
          {contact.email && (
            <p className="text-xs text-ink-light truncate">{contact.email}</p>
          )}
          {contact.phone && (
            <p className="text-xs text-ink-light">{contact.phone}</p>
          )}
        </div>
      )}

      {/* Next meeting */}
      <div className="rounded-lg bg-blue-50/60 px-2.5 py-1.5 text-[10px] text-ink-light">
        {nextMeeting ? (
          <span>
            Next meeting:{" "}
            <span className="font-medium text-ink">{nextMeeting.title}</span>
            {" · "}
            <span>{formatMeetingDate(nextMeeting.start_at)}</span>
          </span>
        ) : (
          <span>No upcoming meetings</span>
        )}
      </div>

      {/* Note snippet */}
      {noteSnippet && (
        <p className="text-xs text-ink-light italic line-clamp-2">
          {noteSnippet}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end pt-1 border-t border-blue-50">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] font-medium text-blue-600 hover:underline transition-opacity px-1"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
