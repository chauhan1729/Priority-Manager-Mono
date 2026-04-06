"use client";

import { isMeetingPast, isMeetingRunning, needsStatusUpdatePrompt, needsTakeawayPrompt } from "@pm/domain";
import type { Contact, Meeting } from "@pm/types";

function formatDate(isoDate: string): string {
  const parts = isoDate.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]!) - 1, Number(parts[2]));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const STATUS_STYLES: Record<string, string> = {
  upcoming:  "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  missed:    "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  upcoming:  "Upcoming",
  completed: "Completed",
  missed:    "Missed",
  cancelled: "Cancelled",
};

interface Props {
  meeting: Meeting;
  contact: Contact | null;
  onClick: () => void;
}

export function MeetingCard({ meeting, contact, onClick }: Props) {
  const isPast = isMeetingPast(meeting);
  const isRunning = isMeetingRunning(meeting);
  const needsUpdate = needsStatusUpdatePrompt(meeting);
  const needsTakeaway = needsTakeawayPrompt(meeting);

  const statusStyle = STATUS_STYLES[meeting.status] ?? STATUS_STYLES["upcoming"]!;
  const statusLabel = STATUS_LABELS[meeting.status] ?? meeting.status;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-blue-100 bg-white px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      {/* Top row: title + status */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-ink leading-snug flex-1 min-w-0 truncate">
          {meeting.title}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isRunning && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 uppercase tracking-wide animate-pulse">
              Now
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyle}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Contact snippet */}
      {contact && (
        <p className="text-xs text-ink-light mb-1.5 truncate">
          {contact.full_name}
          {(contact.role || contact.company) && (
            <span className="text-ink-light/60">
              {" "}· {[contact.role, contact.company].filter(Boolean).join(", ")}
            </span>
          )}
        </p>
      )}

      {/* Date + time + duration */}
      <p className="text-xs text-ink-light">
        {formatDate(meeting.date)} · {formatTime(meeting.start_at)} · {formatDuration(meeting.duration_minutes)}
        {meeting.recurrence_rule && (
          <span className="ml-1.5 text-[10px] text-blue-500">↻ {meeting.recurrence_rule}</span>
        )}
      </p>

      {/* Indicator pills */}
      {(needsUpdate || needsTakeaway) && (
        <div className="flex gap-1.5 mt-2">
          {needsUpdate && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              Needs status update
            </span>
          )}
          {needsTakeaway && !needsUpdate && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              Add takeaways
            </span>
          )}
        </div>
      )}

      {/* Agenda preview (if set) */}
      {meeting.agenda && !isPast && (
        <p className="text-[10px] text-ink-light/60 mt-1.5 truncate">
          {meeting.agenda}
        </p>
      )}
    </button>
  );
}
