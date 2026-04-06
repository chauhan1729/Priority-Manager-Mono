"use client";

import { useState } from "react";

import type { YearEntry } from "@pm/types";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatFullDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(entry: YearEntry): string {
  const start = formatFullDate(entry.start_date);
  if (!entry.end_date || entry.end_date === entry.start_date) return start;
  return `${start} → ${formatFullDate(entry.end_date)}`;
}

const TYPE_STYLES: Record<YearEntry["type"], { badge: string; label: string }> = {
  birthday: { badge: "bg-pink-100 text-pink-700 border-pink-200", label: "Birthday" },
  travel: { badge: "bg-amber-100 text-amber-700 border-amber-200", label: "Travel" },
  away: { badge: "bg-purple-100 text-purple-700 border-purple-200", label: "Away" },
};

const AVAILABILITY_LABELS: Record<string, string> = {
  away: "Away — fully unavailable",
  partial: "Partial — limited availability",
  available: "Available — just noting the trip",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  entry: YearEntry;
  projectName: string | null;
  isPending: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YearEntryDetailPanel({
  entry,
  projectName,
  isPending,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const typeStyle = TYPE_STYLES[entry.type];
  const isBirthday = entry.type === "birthday";
  const hasLinkedProject = entry.linked_project_id !== null && projectName !== null;

  function handleDelete() {
    onDelete(entry.id);
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
              <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${typeStyle.badge}`}>
                {typeStyle.label}
              </span>
              {entry.availability_status && (
                <span className="text-[10px] text-ink-light">
                  {AVAILABILITY_LABELS[entry.availability_status]}
                </span>
              )}
            </div>
            <h2 className="font-medium text-base text-ink leading-snug truncate">{entry.title}</h2>
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
          {/* Date */}
          <div>
            <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
              {isBirthday ? "Birthday" : "Date / Period"}
            </p>
            <p className="text-sm text-ink">
              {isBirthday
                ? formatDateRange(entry) + " (repeats annually)"
                : formatDateRange(entry)}
            </p>
          </div>

          {/* Location */}
          {entry.location && (
            <div>
              <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                Location
              </p>
              <p className="text-sm text-ink">{entry.location}</p>
            </div>
          )}

          {/* Note */}
          {entry.note && (
            <div>
              <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                Note
              </p>
              <p className="text-sm text-ink whitespace-pre-wrap">{entry.note}</p>
            </div>
          )}

          {/* Linked trip project */}
          {hasLinkedProject && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3">
              <p className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                Linked Trip Project
              </p>
              <p className="text-sm text-amber-800 font-medium">{projectName}</p>
              <a
                href="/project-planner"
                className="mt-1 block text-xs text-amber-700 hover:underline"
              >
                Open in Project Planner →
              </a>
            </div>
          )}

          {/* Calendar sync note */}
          <div className="rounded-lg border border-blue-50 bg-blue-50/40 px-3 py-2">
            <p className="text-xs text-ink-light">
              {isBirthday
                ? "This birthday appears in Calendar every year automatically."
                : "This period is visible in Calendar and triggers meeting scheduling warnings."}
            </p>
          </div>

          {/* Safe delete notice when linked project exists */}
          {hasLinkedProject && showDeleteConfirm && (
            <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2">
              <p className="text-xs text-orange-700">
                <strong>Note:</strong> Deleting this entry will keep the linked trip project
                "{projectName}" in Project Planner. Delete it separately if needed.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-blue-50 px-5 py-3 flex items-center justify-between gap-2">
          {!showDeleteConfirm ? (
            <>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
              >
                Delete entry
              </button>
              <button
                type="button"
                onClick={onEdit}
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Edit
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <span className="text-xs text-ink-light flex-1">
                {hasLinkedProject
                  ? "Delete entry? (trip project kept)"
                  : "Delete this entry?"}
              </span>
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
        </div>
      </div>
    </>
  );
}
