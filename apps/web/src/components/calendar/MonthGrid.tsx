"use client";

import type { Contact, YearEntry } from "@pm/types";
import { isDateInAwayPeriod } from "@pm/domain";
import type { CalendarDayEvent } from "./CalendarView";

// ---------------------------------------------------------------------------
// Day-of-week labels
// ---------------------------------------------------------------------------

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Event chip styles by kind/type
// ---------------------------------------------------------------------------

function getEventChipStyle(event: CalendarDayEvent): {
  bg: string;
  text: string;
  dot: string;
} {
  if (event.kind === "birthday") {
    return { bg: "bg-pink-50 border-pink-100", text: "text-pink-700", dot: "bg-pink-400" };
  }
  if (event.kind === "away") {
    return { bg: "bg-purple-50 border-purple-100", text: "text-purple-700", dot: "bg-purple-400" };
  }
  if (event.kind === "orphan_meeting") {
    return { bg: "bg-blue-50 border-blue-100", text: "text-blue-700", dot: "bg-blue-500" };
  }
  // calendar_event
  const type = event.data.event_type;
  switch (type) {
    case "meeting":
      return { bg: "bg-indigo-50 border-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" };
    case "appointment":
      return { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "renewal":
      return { bg: "bg-amber-50 border-amber-100", text: "text-amber-700", dot: "bg-amber-500" };
    default:
      return { bg: "bg-gray-50 border-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  selectedMonth: string; // "YYYY-MM"
  eventsByDate: Map<string, CalendarDayEvent[]>;
  awayEntries: YearEntry[];
  contactMap: Map<string, Contact>;
  todayISO: string;
  selectedDay?: string;
  // Clicking a day opens the day-events modal (handled by the parent).
  onDayClick: (date: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonthGrid({
  selectedMonth,
  eventsByDate,
  awayEntries,
  todayISO,
  selectedDay,
  onDayClick,
}: Props) {
  const [year, month] = selectedMonth.split("-").map(Number);

  // First day of the month (0=Sun, 6=Sat)
  const firstDayOfWeek = new Date(year!, month! - 1, 1).getDay();
  // Total days in the month
  const daysInMonth = new Date(year!, month!, 0).getDate();
  // Total cells needed (pad to complete weeks)
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDayOfWeek + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ date: null, day: null });
    } else {
      const date = `${selectedMonth}-${String(dayNum).padStart(2, "0")}`;
      cells.push({ date, day: dayNum });
    }
  }

  const todayMonth = todayISO.slice(0, 7);
  const isCurrentMonth = selectedMonth === todayMonth;

  return (
    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-blue-50">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-light"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell.date || !cell.day) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[80px] md:min-h-[100px] border-b border-r border-blue-50 bg-gray-50/40"
              />
            );
          }

          const isToday = cell.date === todayISO;
          const isPast = cell.date < todayISO;
          const isAway = isDateInAwayPeriod(cell.date, awayEntries);
          const isSelected = selectedDay === cell.date;
          const events = eventsByDate.get(cell.date) ?? [];

          return (
            <div
              key={cell.date}
              onClick={() => onDayClick(cell.date!)}
              className={[
                "min-h-[48px] sm:min-h-[80px] md:min-h-[100px] border-b border-r border-blue-50 p-1 cursor-pointer transition",
                isSelected && !isToday ? "bg-blue-50/60" : isAway ? "bg-purple-50/30" : "hover:bg-blue-50/30",
                isPast && !isToday ? "opacity-70" : "",
              ].join(" ")}
            >
              {/* Day number */}
              <div className="flex items-start justify-between mb-0.5">
                <span
                  className={[
                    "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium leading-none",
                    isToday
                      ? "bg-blue-600 text-white"
                      : "text-ink",
                  ].join(" ")}
                >
                  {cell.day}
                </span>
                {isAway && (
                  <span className="hidden sm:block text-[9px] text-purple-500 font-medium">Away</span>
                )}
              </div>

              {/* Dots — mobile (tap the day to see the list below the grid). */}
              {events.length > 0 && (
                <div className="sm:hidden flex gap-0.5 flex-wrap mt-0.5">
                  {events.slice(0, 4).map((event, i) => {
                    const style = getEventChipStyle(event);
                    return <span key={i} className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />;
                  })}
                </div>
              )}

              {/* Dots — desktop (hover the day to reveal the popover below). */}
              {events.length > 0 && (
                <div className="hidden sm:flex flex-wrap items-center gap-1 mt-1">
                  {events.slice(0, 6).map((event, i) => {
                    const style = getEventChipStyle(event);
                    return <span key={i} className={`w-2 h-2 rounded-full ${style.dot}`} />;
                  })}
                  {events.length > 6 && (
                    <span className="text-[9px] leading-none text-ink-light">+{events.length - 6}</span>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}
