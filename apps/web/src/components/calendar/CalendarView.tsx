"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { nextMonth, prevMonth } from "@pm/domain";
import type {
  CalendarEvent,
  CalendarMonthNote,
  Contact,
  Meeting,
  YearEntry,
} from "@pm/types";

import { showToast } from "@/components/ui/Toaster";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  upsertMonthNote,
} from "@/app/(app)/calendar/actions";

import { CalendarEventFormModal } from "./CalendarEventFormModal";
import { EventPopup } from "./EventPopup";
import { MonthGrid } from "./MonthGrid";

// ---------------------------------------------------------------------------
// Unified event shape used throughout the Calendar UI
// ---------------------------------------------------------------------------

export type CalendarDayEvent =
  | { kind: "calendar_event"; data: CalendarEvent }
  | { kind: "orphan_meeting"; data: Meeting }
  | { kind: "birthday"; data: YearEntry }
  | { kind: "away"; data: YearEntry; spansFrom: string; spansTo: string };

// ---------------------------------------------------------------------------
// Month display helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthTitle(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month! - 1]} ${year}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  calendarEvents: CalendarEvent[];
  orphanMeetings: Meeting[];
  yearEntries: YearEntry[];
  contacts: Contact[];
  monthNote: CalendarMonthNote | null;
  selectedMonth: string; // "YYYY-MM"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarView({
  calendarEvents,
  orphanMeetings,
  yearEntries,
  contacts,
  monthNote,
  selectedMonth,
}: Props) {
  const todayISO = new Date().toISOString().slice(0, 10);

  const [selectedEvent, setSelectedEvent] = useState<CalendarDayEvent | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null); // day clicked for new event
  const [selectedDay, setSelectedDay] = useState<string>(todayISO);
  const [noteText, setNoteText] = useState(monthNote?.notes ?? "");
  const [noteSaved, setNoteSaved] = useState(false);

  const [isPending, startTransition] = useTransition();

  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  // Away entries only (for warning + overlay)
  const awayEntries = yearEntries.filter(
    (e) => e.type === "travel" || e.type === "away",
  );

  // Build per-day event map
  const eventsByDate = buildEventsByDate(
    selectedMonth,
    calendarEvents,
    orphanMeetings,
    yearEntries,
    awayEntries,
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleDayClick(date: string) {
    setSelectedDay(date);
  }

  function handleEventClick(event: CalendarDayEvent) {
    setSelectedEvent(event);
  }

  function handleCreate(data: Parameters<typeof createCalendarEvent>[0]) {
    startTransition(async () => {
      const result = await createCalendarEvent(data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Event created");
        setCreateDate(null);
      }
    });
  }

  function handleUpdate(id: string, data: Parameters<typeof updateCalendarEvent>[1]) {
    startTransition(async () => {
      const result = await updateCalendarEvent(id, data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Event updated");
        setSelectedEvent(null);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCalendarEvent(id);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Event deleted");
        setSelectedEvent(null);
      }
    });
  }

  function handleSaveNote() {
    startTransition(async () => {
      const result = await upsertMonthNote(selectedMonth, noteText);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const prev = prevMonth(selectedMonth);
  const next = nextMonth(selectedMonth);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-blue-100 px-4 py-3 md:px-8 md:py-4">
        {/* Row 1: Page title */}
        <h1 className="hidden md:block font-handwriting text-2xl text-ink mb-2">Calendar</h1>

        {/* Row 2: Month nav + Add Event */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Month navigation */}
            <div className="flex items-center gap-0.5 rounded-lg border border-blue-100 bg-white px-1 py-0.5">
              <Link
                href={`/calendar?month=${prev}`}
                className="rounded px-2 py-1 text-sm text-ink-light hover:bg-blue-50 hover:text-blue-700 transition"
                aria-label="Previous month"
              >
                ←
              </Link>
              <span className="min-w-[140px] text-center text-sm font-medium text-ink px-1">
                {formatMonthTitle(selectedMonth)}
              </span>
              <Link
                href={`/calendar?month=${next}`}
                className="rounded px-2 py-1 text-sm text-ink-light hover:bg-blue-50 hover:text-blue-700 transition"
                aria-label="Next month"
              >
                →
              </Link>
            </div>

            {selectedMonth !== todayISO.slice(0, 7) && (
              <Link href="/calendar" className="text-xs text-blue-600 hover:underline">
                This month
              </Link>
            )}
          </div>

          <button
            onClick={() => setCreateDate(todayISO)}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <span className="hidden sm:inline">+ Add Event</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </header>

      {/* Content: month grid on all screen sizes, day events panel on mobile */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 space-y-4">
        {/* Month grid — always visible */}
        <MonthGrid
          selectedMonth={selectedMonth}
          eventsByDate={eventsByDate}
          awayEntries={awayEntries}
          contactMap={contactMap}
          todayISO={todayISO}
          selectedDay={selectedDay}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />

        {/* Mobile day events panel: shown below the grid on small screens */}
        <div className="md:hidden">
          <DayEventsPanel
            date={selectedDay}
            events={eventsByDate.get(selectedDay) ?? []}
            todayISO={todayISO}
            onEventClick={handleEventClick}
            onAddEvent={() => setCreateDate(selectedDay)}
          />
        </div>

        {/* Monthly notes area — spec §10.2 */}
        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <h3 className="text-[11px] font-semibold text-ink-light uppercase tracking-wide mb-2">
            Monthly Notes
          </h3>
          <textarea
            value={noteText}
            onChange={(e) => {
              setNoteText(e.target.value);
              setNoteSaved(false);
            }}
            placeholder={`Notes for ${formatMonthTitle(selectedMonth)}…`}
            rows={4}
            className="w-full resize-none rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs transition-opacity ${noteSaved ? "text-green-600 opacity-100" : "opacity-0"}`}>
              Saved
            </span>
            <button
              onClick={handleSaveNote}
              disabled={isPending}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
            >
              Save notes
            </button>
          </div>
        </div>
      </div>

      {/* Event detail popup */}
      {selectedEvent && (
        <EventPopup
          event={selectedEvent}
          contactMap={contactMap}
          isPending={isPending}
          onClose={() => setSelectedEvent(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          yearEntries={awayEntries}
        />
      )}

      {/* Create event modal */}
      {createDate !== null && (
        <CalendarEventFormModal
          defaultDate={createDate}
          contacts={contacts}
          yearEntries={awayEntries}
          isPending={isPending}
          onSave={handleCreate}
          onClose={() => setCreateDate(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day events panel (shown below the grid on mobile when a day is selected)
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function formatDayTitle(iso: string, todayISO: string): string {
  if (iso === todayISO) return "Today";
  const d = parseLocalDate(iso);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function getEventLabel(event: CalendarDayEvent): string {
  if (event.kind === "birthday") return `🎂 ${event.data.title}`;
  if (event.kind === "away") return `✈ ${event.data.title}`;
  return event.data.title;
}

function getEventTime(event: CalendarDayEvent): string | null {
  if (event.kind === "birthday" || event.kind === "away") return null;
  const startAt = event.data.start_at;
  if (!startAt) return null;
  const d = new Date(startAt);
  const h = d.getHours();
  const min = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${h12}${ampm}` : `${h12}:${String(min).padStart(2, "0")}${ampm}`;
}

interface DayEventsPanelProps {
  date: string;
  events: CalendarDayEvent[];
  todayISO: string;
  onEventClick: (event: CalendarDayEvent) => void;
  onAddEvent: () => void;
}

function DayEventsPanel({ date, events, todayISO, onEventClick, onAddEvent }: DayEventsPanelProps) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden">
      {/* Day header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-50">
        <span className="text-sm font-semibold text-ink">{formatDayTitle(date, todayISO)}</span>
        <button
          onClick={onAddEvent}
          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 transition"
        >
          + Add Event
        </button>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-ink-light">No events on this day.</div>
      ) : (
        <ul className="divide-y divide-blue-50">
          {events.map((event, evIdx) => {
            const label = getEventLabel(event);
            const time = getEventTime(event);
            const key = event.kind === "birthday" || event.kind === "away"
              ? `${event.kind}-${event.data.id}-${evIdx}`
              : `${event.kind}-${event.data.id}`;

            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onEventClick(event)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{label}</p>
                    {time && <p className="text-xs text-ink-light mt-0.5">{time}</p>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build per-day event map for the selected month
// ---------------------------------------------------------------------------

function buildEventsByDate(
  selectedMonth: string,
  calendarEvents: CalendarEvent[],
  orphanMeetings: Meeting[],
  yearEntries: YearEntry[],
  awayEntries: YearEntry[],
): Map<string, CalendarDayEvent[]> {
  const map = new Map<string, CalendarDayEvent[]>();

  function push(date: string, event: CalendarDayEvent) {
    const list = map.get(date) ?? [];
    list.push(event);
    map.set(date, list);
  }

  // CalendarEvents (meeting, appointment, other)
  for (const ev of calendarEvents) {
    push(ev.date, { kind: "calendar_event", data: ev });
  }

  // Orphan meetings (no linked_calendar_event_id)
  for (const m of orphanMeetings) {
    push(m.date, { kind: "orphan_meeting", data: m });
  }

  // Birthdays from year_entries
  for (const entry of yearEntries) {
    if (entry.type !== "birthday") continue;
    // Birthday repeats annually — show if month matches
    const birthdayMonth = entry.start_date.slice(5, 7);
    const selectedMonthNum = selectedMonth.slice(5, 7);
    if (birthdayMonth !== selectedMonthNum) continue;

    // Use the birthday date but with the selected year
    const selectedYear = selectedMonth.slice(0, 4);
    const birthdayThisYear = `${selectedYear}-${entry.start_date.slice(5)}`;
    push(birthdayThisYear, { kind: "birthday", data: entry });
  }

  // Away/travel entries — show indicator on each covered day within the month
  const [year, month] = selectedMonth.split("-").map(Number);
  const lastDay = new Date(year!, month!, 0).getDate();

  for (const entry of awayEntries) {
    const entryEnd = entry.end_date ?? entry.start_date;
    const monthEnd = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
    const monthStart = `${selectedMonth}-01`;

    // Only show if the entry overlaps this month
    if (entry.start_date > monthEnd || entryEnd < monthStart) continue;

    const displayStart = entry.start_date > monthStart ? entry.start_date : monthStart;
    const displayEnd = entryEnd < monthEnd ? entryEnd : monthEnd;

    // Add away indicator to first day of the period in this month
    push(displayStart, {
      kind: "away",
      data: entry,
      spansFrom: displayStart,
      spansTo: displayEnd,
    });
  }

  return map;
}
