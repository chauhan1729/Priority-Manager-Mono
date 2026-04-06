"use client";

import { birthdayDateForYear, entryOverlapsYear } from "@pm/domain";
import type { YearEntry, YearEntryType } from "@pm/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const ENTRY_COLORS: Record<YearEntryType, {
  bg: string;
  light: string;
  text: string;
  dot: string;
  badge: string;
}> = {
  birthday: {
    bg: "bg-pink-100",
    light: "bg-pink-50",
    text: "text-pink-800",
    dot: "bg-pink-400",
    badge: "bg-pink-100 text-pink-700 border-pink-200",
  },
  travel: {
    bg: "bg-amber-100",
    light: "bg-amber-50",
    text: "text-amber-800",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  away: {
    bg: "bg-purple-100",
    light: "bg-purple-50",
    text: "text-purple-800",
    dot: "bg-purple-400",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
  },
};

// ---------------------------------------------------------------------------
// Date computation helpers
// ---------------------------------------------------------------------------

/** Returns the ISO date string for a specific day in a given month/year. */
function isoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Returns the number of days in a given month (0-indexed). */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Returns the weekday (0=Sun) of the first day of the month. */
function firstDayOfWeek(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

/**
 * Builds a map from ISO date string → list of YearEntry items that cover that date.
 * This is computed once for the full year and used by all 12 month cards.
 *
 * Birthday entries use annual recurrence (month+day match, year substituted).
 * Travel/away entries use their actual date range, clipped to the displayed year.
 */
function buildDateMap(entries: YearEntry[], year: number): Map<string, YearEntry[]> {
  const map = new Map<string, YearEntry[]>();

  function addToDate(date: string, entry: YearEntry) {
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(entry);
  }

  for (const entry of entries) {
    if (!entryOverlapsYear(entry, year)) continue;

    if (entry.type === "birthday") {
      const date = birthdayDateForYear(entry, year);
      if (date) addToDate(date, entry);
    } else {
      // Clip to the displayed year
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const start = entry.start_date < yearStart ? yearStart : entry.start_date;
      const end = (entry.end_date ?? entry.start_date) > yearEnd
        ? yearEnd
        : (entry.end_date ?? entry.start_date);

      // Walk every date in the range
      let current = start;
      while (current <= end) {
        addToDate(current, entry);
        const d = new Date(`${current}T12:00:00`);
        d.setDate(d.getDate() + 1);
        current = d.toISOString().slice(0, 10);
      }
    }
  }

  return map;
}

/** Returns the dominant entry for a date (travel > away > birthday for visual priority). */
function dominantEntry(entries: YearEntry[]): YearEntry {
  const priority: YearEntryType[] = ["travel", "away", "birthday"];
  for (const type of priority) {
    const found = entries.find((e) => e.type === type);
    if (found) return found;
  }
  return entries[0]!;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatDateRange(entry: YearEntry): string {
  const start = formatShortDate(entry.start_date);
  if (!entry.end_date || entry.end_date === entry.start_date) return start;
  return `${start} – ${formatShortDate(entry.end_date)}`;
}

function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return new Date(2000, month! - 1, day!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  entries: YearEntry[];
  year: number;
  onEntryClick: (entry: YearEntry) => void;
  onDayClick: (isoDate: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YearGrid({ entries, year, onEntryClick, onDayClick }: Props) {
  const dateMap = buildDateMap(entries, year);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {MONTH_NAMES.map((monthName, monthIndex) => (
        <MonthCard
          key={monthIndex}
          monthName={monthName}
          monthIndex={monthIndex}
          year={year}
          dateMap={dateMap}
          onEntryClick={onEntryClick}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month card
// ---------------------------------------------------------------------------

interface MonthCardProps {
  monthName: string;
  monthIndex: number;
  year: number;
  dateMap: Map<string, YearEntry[]>;
  onEntryClick: (entry: YearEntry) => void;
  onDayClick: (isoDate: string) => void;
}

function MonthCard({
  monthName,
  monthIndex,
  year,
  dateMap,
  onEntryClick,
  onDayClick,
}: MonthCardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const days = daysInMonth(year, monthIndex);
  const firstWeekday = firstDayOfWeek(year, monthIndex);

  // Collect entries that appear in this month
  const monthEntries = new Map<string, YearEntry>(); // deduplicated by id
  for (let d = 1; d <= days; d++) {
    const date = isoDate(year, monthIndex, d);
    const entriesForDate = dateMap.get(date) ?? [];
    for (const entry of entriesForDate) {
      monthEntries.set(entry.id, entry);
    }
  }
  const monthEntryList = Array.from(monthEntries.values());

  // Build grid cells: leading blanks + day cells
  const leadingBlanks = Array.from({ length: firstWeekday }, (_, i) => i);

  return (
    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden">
      {/* Month header */}
      <div className="px-3 py-2 border-b border-blue-50 bg-blue-50/30">
        <h3 className="text-sm font-semibold text-ink">{monthName}</h3>
      </div>

      {/* Mini calendar */}
      <div className="p-2">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d, i) => (
            <div
              key={i}
              className="text-center text-[9px] font-semibold text-ink-light uppercase"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {/* Leading blanks */}
          {leadingBlanks.map((_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
            const date = isoDate(year, monthIndex, day);
            const entriesForDay = dateMap.get(date) ?? [];
            const isToday = date === today;
            const dominant = entriesForDay.length > 0 ? dominantEntry(entriesForDay) : null;
            const colors = dominant ? ENTRY_COLORS[dominant.type] : null;

            // Click: if there are entries, open the first entry; otherwise open new entry form
            function handleClick() {
              if (dominant) {
                onEntryClick(dominant);
              } else {
                onDayClick(date);
              }
            }

            return (
              <button
                key={day}
                type="button"
                onClick={handleClick}
                title={dominant ? dominant.title : `Add entry for ${date}`}
                className={[
                  "relative w-full aspect-square flex flex-col items-center justify-center rounded text-[11px] leading-none transition",
                  colors ? colors.bg : "hover:bg-blue-50",
                  "focus:outline-none focus:ring-1 focus:ring-blue-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "font-medium",
                    isToday
                      ? "w-5 h-5 flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px]"
                      : colors
                        ? colors.text
                        : "text-ink",
                  ].join(" ")}
                >
                  {day}
                </span>

                {/* Birthday dot indicator (shown when birthday in colored cell for travel+birthday overlap) */}
                {entriesForDay.some((e) => e.type === "birthday") && dominant?.type !== "birthday" && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-pink-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entry list for this month */}
      {monthEntryList.length > 0 && (
        <div className="border-t border-blue-50 px-2 py-2 space-y-1">
          {monthEntryList.slice(0, 4).map((entry) => {
            const colors = ENTRY_COLORS[entry.type];
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onEntryClick(entry)}
                className="w-full flex items-start gap-1.5 text-left hover:bg-blue-50 rounded px-1 py-0.5 transition group"
              >
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] text-ink truncate leading-tight group-hover:text-blue-700">
                    {entry.title}
                  </span>
                  <span className="block text-[10px] text-ink-light leading-tight">
                    {entry.type === "birthday"
                      ? formatShortDate(entry.start_date)
                      : formatDateRange(entry)}
                  </span>
                </span>
              </button>
            );
          })}
          {monthEntryList.length > 4 && (
            <p className="text-[10px] text-ink-light px-1">
              +{monthEntryList.length - 4} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
