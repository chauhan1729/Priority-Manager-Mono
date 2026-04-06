"use client";

import { useState } from "react";

import { canCreateLinkedTripPlan } from "@pm/domain";
import type { AvailabilityStatus, YearEntry, YearEntryType } from "@pm/types";

import type {
  createYearEntry,
  updateYearEntry,
} from "@/app/(app)/year-at-a-glance/actions";

type CreateData = Parameters<typeof createYearEntry>[0];
type UpdateData = Parameters<typeof updateYearEntry>[1];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { value: YearEntryType; label: string; description: string }[] = [
  { value: "birthday", label: "Birthday", description: "Annual birthday reminder" },
  { value: "travel", label: "Travel", description: "Trip away from home" },
  { value: "away", label: "Away", description: "Busy / unavailable period" },
];

const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "away", label: "Away (fully unavailable)" },
  { value: "partial", label: "Partial (limited availability)" },
  { value: "available", label: "Available (just noting the trip)" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** null = new entry; YearEntry = edit existing */
  entry: YearEntry | null;
  defaultDate: string;
  isPending: boolean;
  onSave: (data: CreateData | UpdateData) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YearEntryFormModal({ entry, defaultDate, isPending, onSave, onClose }: Props) {
  const isEdit = entry !== null;

  const [type, setType] = useState<YearEntryType>(entry?.type ?? "travel");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [startDate, setStartDate] = useState(entry?.start_date ?? defaultDate);
  const [endDate, setEndDate] = useState(entry?.end_date ?? "");
  const [location, setLocation] = useState(entry?.location ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(
    entry?.availability_status ?? "away",
  );
  const [createLinkedPlan, setCreateLinkedPlan] = useState(
    isEdit ? false : false, // default off; user opts in
  );
  const [errors, setErrors] = useState<string[]>([]);

  const isBirthday = type === "birthday";
  const isTravelOrAway = type !== "birthday";

  // For edit mode: show existing linked project state
  const alreadyHasLinkedPlan = isEdit && (entry?.linked_project_id ?? null) !== null;
  const canOfferLinkedPlan = !alreadyHasLinkedPlan && isTravelOrAway && !isEdit;

  function validate(): boolean {
    const errs: string[] = [];
    if (!title.trim()) errs.push("Title is required.");
    if (!startDate) errs.push("Start date is required.");
    if (isBirthday && endDate) errs.push("Birthday entries cannot have an end date.");
    if (!isBirthday && !availabilityStatus) errs.push("Availability status is required.");
    if (endDate && startDate && endDate < startDate) {
      errs.push("End date must be on or after start date.");
    }
    setErrors(errs);
    return errs.length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (isEdit) {
      // Update: only send changed fields
      const updateData: UpdateData = {
        title: title.trim(),
        start_date: startDate,
        end_date: isBirthday ? null : (endDate || null),
        location: location.trim() || null,
        note: note.trim() || null,
        availability_status: isTravelOrAway ? availabilityStatus : null,
      };
      onSave(updateData);
    } else {
      // Create: full data
      const createData: CreateData = {
        type,
        title: title.trim(),
        start_date: startDate,
        end_date: isBirthday ? null : (endDate || null),
        location: location.trim() || null,
        note: note.trim() || null,
        availability_status: isTravelOrAway ? availabilityStatus : null,
        create_linked_trip_plan: canOfferLinkedPlan ? createLinkedPlan : false,
      };
      onSave(createData);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-blue-50">
            <h2 className="font-handwriting text-xl text-ink">
              {isEdit ? "Edit Entry" : "New Entry"}
            </h2>
            <button
              onClick={onClose}
              className="text-ink-light hover:text-ink text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[75vh]">
            <div className="px-5 py-4 space-y-4">

              {/* Type selector (immutable on edit) */}
              {!isEdit && (
                <div>
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1.5">
                    Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className={[
                          "rounded-lg border px-2 py-2 text-sm font-medium transition text-center",
                          type === opt.value
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-blue-100 text-ink-light hover:border-blue-300",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-ink-light">
                    {TYPE_OPTIONS.find((o) => o.value === type)?.description}
                  </p>
                </div>
              )}

              {/* Type badge on edit */}
              {isEdit && (
                <div>
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                    Type
                  </label>
                  <span className={[
                    "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium border",
                    type === "birthday"
                      ? "bg-pink-100 text-pink-700 border-pink-200"
                      : type === "travel"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-purple-100 text-purple-700 border-purple-200",
                  ].join(" ")}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </span>
                  <p className="mt-1 text-xs text-ink-light/70">Type cannot be changed after creation.</p>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isBirthday ? "e.g. Alice's Birthday" : "e.g. Italy Summer Trip"
                  }
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Start date */}
              <div>
                <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                  {isBirthday ? "Date *" : "Start Date *"}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                />
                {isBirthday && (
                  <p className="mt-1 text-xs text-ink-light">
                    The year doesn&apos;t matter — birthdays repeat annually.
                  </p>
                )}
              </div>

              {/* End date (travel/away only) */}
              {!isBirthday && (
                <div>
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-ink-light">
                    Leave blank for a single-day entry.
                  </p>
                </div>
              )}

              {/* Availability status (travel/away only) */}
              {!isBirthday && (
                <div>
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1.5">
                    Availability *
                  </label>
                  <div className="space-y-1.5">
                    {AVAILABILITY_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={[
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition",
                          availabilityStatus === opt.value
                            ? "border-blue-400 bg-blue-50"
                            : "border-blue-100 hover:border-blue-200",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="availability"
                          value={opt.value}
                          checked={availabilityStatus === opt.value}
                          onChange={() => setAvailabilityStatus(opt.value)}
                          className="accent-blue-600"
                        />
                        <span className="text-sm text-ink">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Location (optional for all types) */}
              <div>
                <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Optional location…"
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                  Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any notes…"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
                />
              </div>

              {/* Linked trip plan toggle (new travel/away entries only) */}
              {canOfferLinkedPlan && (
                <div className={[
                  "rounded-lg border px-3 py-3 transition",
                  createLinkedPlan ? "border-blue-300 bg-blue-50" : "border-blue-100",
                ].join(" ")}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createLinkedPlan}
                      onChange={(e) => setCreateLinkedPlan(e.target.checked)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-ink">Create linked trip plan</p>
                      <p className="text-xs text-ink-light mt-0.5">
                        Auto-creates a project for flight bookings, hotel, activities, and errands.
                        The project will appear in Project Planner.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Existing linked project notice (edit mode) */}
              {alreadyHasLinkedPlan && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-700">
                    This entry has a linked trip project. Manage it in Project Planner.
                  </p>
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  {errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-blue-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-blue-100 px-4 py-2 text-sm text-ink-light hover:bg-blue-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Entry"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
