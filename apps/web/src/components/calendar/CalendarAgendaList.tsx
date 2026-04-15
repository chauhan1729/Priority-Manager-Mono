"use client";

import type { Contact, YearEntry } from "@pm/types";
import type { CalendarDayEvent } from "./CalendarView";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function formatDayHeader(iso: string, todayISO: string): string {
  if (iso === todayISO) return "Today";
  const d = parseLocalDate(iso);
  return `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function getEventLabel(event: CalendarDayEvent): string {
  if (event.kind === "birthday") return `🎂 ${event.data.title}`;
  if (event.kind === "away") return `✈ ${event.data.title}`;
  if (event.kind === "orphan_meeting") return event.data.title;
  return event.data.title;
}

function getEventTime(event: CalendarDayEvent): string | null {
  if (event.kind === "birthday" || event.kind === "away") return null;
  const startAt = event.kind === "orphan_meeting" ? event.data.start_at : event.data.start_at;
  if (!startAt) return null;
  const d = new Date(startAt);
  const h = d.getHours();
  const min = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${h12}${ampm}` : `${h12}:${String(min).padStart(2, "0")}${ampm}`;
}

function getEventDot(event: CalendarDayEvent): string {
  if (event.kind === "birthday") return "bg-pink-400";
  if (event.kind === "away") return "bg-purple-400";
  if (event.kind === "orphan_meeting") return "bg-blue-500";
  switch (event.data.event_type) {
    case "meeting": return "bg-indigo-500";
    case "appointment": return "bg-emerald-500";
    case "renewal": return "bg-amber-500";
    default: return "bg-gray-400";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  selectedMonth: string; // "YYYY-MM"
  eventsByDate: Map<string, CalendarDayEvent[]>;
  todayISO: string;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarDayEvent) => void;
}

/**
 * Mobile-only agenda list: shows upcoming days in the selected month
 * that have events, plus the first few empty days. Hidden on md+.
 */
export function CalendarAgendaList({
  selectedMonth,
  eventsByDate,
  todayISO,
  onDayClick,
  onEventClick,
}: Props) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year!, month!, 0).getDate();

  // Build day list for the month
  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${selectedMonth}-${String(d).padStart(2, "0")}`);
  }

  // Show all days that have events + today
  const daysToShow = days.filter(
    (d) => (eventsByDate.get(d)?.length ?? 0) > 0 || d === todayISO,
  );

  if (daysToShow.length === 0) {
    return (
      <div className="rounded-xl border border-blue-100 bg-white p-6 text-center text-sm text-ink-light">
        No events this month.
        <br />
        <button
          onClick={() => onDayClick(todayISO)}
          className="mt-2 text-blue-600 hover:underline text-sm"
        >
          Add an event
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden divide-y divide-blue-50">
      {daysToShow.map((date) => {
        const events = eventsByDate.get(date) ?? [];
        const isToday = date === todayISO;
        const isPast = date < todayISO;

        return (
          <div key={date} className={isPast && !isToday ? "opacity-70" : ""}>
            {/* Day header */}
            <button
              type="button"
              onClick={() => onDayClick(date)}
              className={[
                "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50/50 transition",
                isToday ? "bg-blue-50" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0",
                  isToday ? "bg-blue-600 text-white" : "text-ink",
                ].join(" ")}
              >
                {parseLocalDate(date).getDate()}
              </span>
              <span className="text-sm font-medium text-ink">
                {formatDayHeader(date, todayISO)}
              </span>
              {events.length === 0 && (
                <span className="ml-auto text-xs text-blue-400">+ Add</span>
              )}
            </button>

            {/* Events for this day */}
            {events.length > 0 && (
              <ul className="px-4 pb-2 space-y-1">
                {events.map((event, evIdx) => {
                  const label = getEventLabel(event);
                  const time = getEventTime(event);
                  const dot = getEventDot(event);
                  const key = event.kind === "birthday" || event.kind === "away"
                    ? `${event.kind}-${event.data.id}-${evIdx}`
                    : `${event.kind}-${event.data.id}`;

                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => onEventClick(event)}
                        className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-blue-50 transition"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className="flex-1 text-sm text-ink truncate">{label}</span>
                        {time && (
                          <span className="text-xs text-ink-light shrink-0">{time}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
