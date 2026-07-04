"use client";

import type { Contact } from "@pm/types";

import type { CalendarDayEvent } from "./CalendarView";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatFullDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function eventTimeRange(event: CalendarDayEvent): string | null {
  if (event.kind === "birthday" || event.kind === "away") return null;
  const { start_at, end_at } = event.data;
  if (!start_at) return null;
  return end_at ? `${formatTime(start_at)} – ${formatTime(end_at)}` : formatTime(start_at);
}

function typeMeta(event: CalendarDayEvent): { label: string; dot: string; text: string } {
  if (event.kind === "birthday") return { label: "Birthday", dot: "bg-pink-400", text: "text-pink-700" };
  if (event.kind === "away") return { label: "Away / Travel", dot: "bg-purple-400", text: "text-purple-700" };
  if (event.kind === "orphan_meeting") return { label: "Meeting", dot: "bg-blue-500", text: "text-blue-700" };
  switch (event.data.event_type) {
    case "meeting": return { label: "Meeting", dot: "bg-indigo-500", text: "text-indigo-700" };
    case "appointment": return { label: "Appointment", dot: "bg-emerald-500", text: "text-emerald-700" };
    case "renewal": return { label: "Renewal", dot: "bg-amber-500", text: "text-amber-700" };
    default: return { label: "Event", dot: "bg-gray-400", text: "text-gray-600" };
  }
}

function eventTitle(event: CalendarDayEvent): string {
  if (event.kind === "birthday") return `🎂 ${event.data.title}`;
  if (event.kind === "away") return `✈ ${event.data.title}`;
  return event.data.title;
}

function eventKey(event: CalendarDayEvent, idx: number): string {
  return event.kind === "birthday" || event.kind === "away"
    ? `${event.kind}-${event.data.id}-${idx}`
    : `${event.kind}-${event.data.id}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  date: string; // ISO date
  events: CalendarDayEvent[];
  contactMap: Map<string, Contact>;
  onClose: () => void;
  onEventClick: (event: CalendarDayEvent) => void;
  onAddEvent: (date: string) => void;
}

// ---------------------------------------------------------------------------
// Component — a centered modal listing a day's events with full descriptions
// ---------------------------------------------------------------------------

export function DayEventsModal({ date, events, contactMap, onClose, onEventClick, onAddEvent }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />

      {/* Centered panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-blue-50">
            <div>
              <h2 className="font-handwriting text-xl text-ink leading-tight">{formatFullDate(date)}</h2>
              <p className="text-xs text-ink-light">
                {events.length === 0 ? "No events" : `${events.length} event${events.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-ink-light hover:text-ink transition text-2xl leading-none flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Body — event cards with full descriptions */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {events.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-light">Nothing scheduled for this day.</p>
            ) : (
              events.map((event, idx) => {
                const meta = typeMeta(event);
                const time = eventTimeRange(event);
                const isCal = event.kind === "calendar_event";
                const isOrphan = event.kind === "orphan_meeting";
                const isAway = event.kind === "away";
                const contactId =
                  isCal || isOrphan ? event.data.linked_contact_id : null;
                const contact = contactId ? contactMap.get(contactId) ?? null : null;
                const location =
                  (isCal && event.data.location) || (isAway && event.data.location) || null;
                const notes = isCal ? event.data.notes : null;
                const agenda = isOrphan ? event.data.agenda : null;
                const takeaways = isOrphan ? event.data.key_takeaways : null;
                const status = isCal ? event.data.status : null;
                const canOpen = !isAway && event.kind !== "birthday";

                return (
                  <div key={eventKey(event, idx)} className="rounded-xl border border-blue-100 p-4">
                    {/* Type + status + time */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${meta.text}`}>
                          {meta.label}
                        </span>
                        {status && status !== "upcoming" && (
                          <span className="text-[10px] font-medium rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            {status}
                          </span>
                        )}
                      </span>
                      {time && <span className="text-xs text-ink-light flex-shrink-0">{time}</span>}
                    </div>

                    {/* Title */}
                    <p className="text-sm font-medium text-ink">{eventTitle(event)}</p>

                    {/* Meta */}
                    {location && <p className="mt-1 text-xs text-ink-light">📍 {location}</p>}
                    {contact && (
                      <p className="mt-0.5 text-xs text-ink-light">
                        👤 {contact.full_name}
                        {(contact.role || contact.company) && (
                          <span> · {[contact.role, contact.company].filter(Boolean).join(" · ")}</span>
                        )}
                      </p>
                    )}

                    {/* Full descriptions */}
                    {notes && (
                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-light">
                          {isCal && event.data.event_type === "meeting" ? "Agenda" : "Notes"}
                        </p>
                        <p className="text-sm text-ink whitespace-pre-wrap">{notes}</p>
                      </div>
                    )}
                    {agenda && (
                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-light">Agenda</p>
                        <p className="text-sm text-ink whitespace-pre-wrap">{agenda}</p>
                      </div>
                    )}
                    {takeaways && (
                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-light">Key takeaways</p>
                        <p className="text-sm text-ink whitespace-pre-wrap">{takeaways}</p>
                      </div>
                    )}
                    {isAway && (
                      <p className="mt-2 text-xs text-ink-light">Manage this entry in Year at a Glance.</p>
                    )}
                    {event.kind === "birthday" && (
                      <p className="mt-2 text-xs text-ink-light">Birthday entries are managed in Year at a Glance.</p>
                    )}

                    {/* Open full detail / edit */}
                    {canOpen && (
                      <button
                        type="button"
                        onClick={() => onEventClick(event)}
                        className="mt-3 text-xs font-medium text-blue-600 hover:underline"
                      >
                        Details &amp; edit →
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-blue-50 px-6 py-3 flex justify-end">
            <button
              type="button"
              onClick={() => onAddEvent(date)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              + Add event
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
