"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import type { Project, YearEntry } from "@pm/types";

import {
  createYearEntry,
  deleteYearEntry,
  updateYearEntry,
} from "@/app/(app)/year-at-a-glance/actions";
import { showToast } from "@/components/ui/Toaster";
import { YearEntryDetailPanel } from "./YearEntryDetailPanel";
import { YearEntryFormModal } from "./YearEntryFormModal";
import { YearGrid } from "./YearGrid";

// ---------------------------------------------------------------------------

interface Props {
  yearEntries: YearEntry[];
  projects: Pick<Project, "id" | "name" | "status">[];
  year: number;
  currentYear: number;
}

export function YearAtAGlanceView({ yearEntries, projects, year, currentYear }: Props) {
  const [selectedEntry, setSelectedEntry] = useState<YearEntry | null>(null);
  const [formTarget, setFormTarget] = useState<null | "new" | YearEntry>(null);
  const [defaultFormDate, setDefaultFormDate] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const prevYear = year - 1;
  const nextYear = year + 1;

  function handleDayClick(isoDate: string) {
    setDefaultFormDate(isoDate);
    setFormTarget("new");
  }

  function handleEntryClick(entry: YearEntry) {
    setSelectedEntry(entry);
  }

  function handleCreate(data: Parameters<typeof createYearEntry>[0]) {
    startTransition(async () => {
      const result = await createYearEntry(data);
      if ("error" in result) {
        showToast(result.error, "error");
      } else {
        showToast(
          data.create_linked_trip_plan
            ? "Entry created with linked trip project"
            : "Entry created",
        );
        setFormTarget(null);
        setDefaultFormDate("");
      }
    });
  }

  function handleUpdate(id: string, data: Parameters<typeof updateYearEntry>[1]) {
    startTransition(async () => {
      const result = await updateYearEntry(id, data);
      if ("error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Entry updated");
        setSelectedEntry(null);
        setFormTarget(null);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteYearEntry(id);
      if ("error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Entry deleted");
        setSelectedEntry(null);
      }
    });
  }

  // Counts for header summary
  const birthdays = yearEntries.filter((e) => e.type === "birthday").length;
  const travelAway = yearEntries.filter((e) => e.type !== "birthday").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-blue-100 px-4 py-3 md:px-8 md:py-4">
        {/* Row 1: Page title */}
        <h1 className="font-handwriting text-2xl text-ink mb-2">Year at a Glance</h1>

        {/* Row 2: Year nav + stats + Add Entry */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Year navigation */}
            <div className="flex items-center gap-0.5 rounded-lg border border-blue-100 bg-white px-1 py-0.5">
              <Link
                href={`/year-at-a-glance?year=${prevYear}`}
                className="rounded px-2 py-1 text-sm text-ink-light hover:bg-blue-50 hover:text-blue-700 transition"
                aria-label="Previous year"
              >
                ←
              </Link>
              <span className="min-w-[60px] text-center text-sm font-medium text-ink px-1">
                {year}
              </span>
              <Link
                href={`/year-at-a-glance?year=${nextYear}`}
                className="rounded px-2 py-1 text-sm text-ink-light hover:bg-blue-50 hover:text-blue-700 transition"
                aria-label="Next year"
              >
                →
              </Link>
            </div>

            {year !== currentYear && (
              <Link href="/year-at-a-glance" className="text-xs text-blue-600 hover:underline">
                This year
              </Link>
            )}

            <span className="hidden sm:inline text-xs text-ink-light">
              {birthdays} {birthdays === 1 ? "birthday" : "birthdays"} · {travelAway} travel/away
            </span>
          </div>

          <button
            type="button"
            onClick={() => { setDefaultFormDate(""); setFormTarget("new"); }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            <span className="hidden sm:inline">+ Add Entry</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </header>

      {/* Legend */}
      <div className="border-b border-blue-50 px-6 py-2 md:px-8 flex flex-wrap gap-4">
        {[
          { color: "bg-pink-400", label: "Birthday" },
          { color: "bg-amber-400", label: "Travel" },
          { color: "bg-purple-400", label: "Away" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-xs text-ink-light">{label}</span>
          </div>
        ))}
      </div>

      {/* 12-month grid */}
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
        {yearEntries.length === 0 && (
          <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/40 px-5 py-4 text-sm text-ink-light">
            No entries yet. Add birthdays, vacations, or away periods using the button above.
          </div>
        )}
        <YearGrid
          entries={yearEntries}
          year={year}
          onEntryClick={handleEntryClick}
          onDayClick={handleDayClick}
        />
      </div>

      {/* Entry detail panel */}
      {selectedEntry && (
        <YearEntryDetailPanel
          entry={selectedEntry}
          projectName={
            selectedEntry.linked_project_id
              ? (projectMap.get(selectedEntry.linked_project_id) ?? null)
              : null
          }
          isPending={isPending}
          onClose={() => setSelectedEntry(null)}
          onEdit={() => { setFormTarget(selectedEntry); setSelectedEntry(null); }}
          onDelete={handleDelete}
        />
      )}

      {/* Add / edit form modal */}
      {formTarget !== null && (
        <YearEntryFormModal
          entry={formTarget === "new" ? null : formTarget}
          defaultDate={defaultFormDate}
          isPending={isPending}
          onSave={(data) => {
            if (formTarget === "new") {
              handleCreate(data as Parameters<typeof createYearEntry>[0]);
            } else {
              handleUpdate(
                (formTarget as YearEntry).id,
                data as Parameters<typeof updateYearEntry>[1],
              );
            }
          }}
          onClose={() => { setFormTarget(null); setDefaultFormDate(""); }}
        />
      )}
    </div>
  );
}
