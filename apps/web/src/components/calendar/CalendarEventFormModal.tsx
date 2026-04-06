"use client";

import { useState } from "react";

import { canCreateCalendarEventOnDate, isDateInAwayPeriod } from "@pm/domain";
import type {
  CalendarEventType,
  Contact,
  YearEntry,
} from "@pm/types";

import type { createCalendarEvent } from "@/app/(app)/calendar/actions";

type CreateData = Parameters<typeof createCalendarEvent>[0];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const EVENT_TYPE_OPTIONS: { value: CalendarEventType; label: string }[] = [
  { value: "meeting", label: "Meeting" },
  { value: "appointment", label: "Appointment" },
  { value: "other", label: "Other" },
];

const RECURRENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  defaultDate: string;
  contacts: Contact[];
  yearEntries: YearEntry[];
  isPending: boolean;
  onSave: (data: CreateData) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarEventFormModal({
  defaultDate,
  contacts,
  yearEntries,
  isPending,
  onSave,
  onClose,
}: Props) {
  const todayISO = new Date().toISOString().slice(0, 10);

  const [eventType, setEventType] = useState<CalendarEventType>("appointment");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate >= todayISO ? defaultDate : todayISO);
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [linkedContactId, setLinkedContactId] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [agenda, setAgenda] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const isPastDate = !canCreateCalendarEventOnDate(date);
  const isAwayDate = isDateInAwayPeriod(date, yearEntries);
  const isMeetingType = eventType === "meeting";

  const effectiveDuration = customDuration
    ? parseInt(customDuration, 10)
    : durationMinutes;

  function validate(): boolean {
    const errs: string[] = [];
    if (!title.trim()) errs.push("Title is required.");
    if (isPastDate) errs.push("Cannot create an event in the past.");
    if (isMeetingType && !linkedContactId) errs.push("A contact is required for meetings.");
    if (customDuration && (!Number.isInteger(+customDuration) || +customDuration <= 0)) {
      errs.push("Duration must be a positive number.");
    }
    setErrors(errs);
    return errs.length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      event_type: eventType,
      title: title.trim(),
      date,
      start_time: startTime,
      duration_minutes: effectiveDuration,
      linked_contact_id: linkedContactId || null,
      location: location.trim() || null,
      notes: eventType !== "meeting" ? notes.trim() || null : null,
      agenda: isMeetingType ? agenda.trim() || null : null,
      recurrence_rule: (recurrence || null) as "daily" | "weekly" | "monthly" | null,
    });
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
            <h2 className="font-handwriting text-xl text-ink">New Event</h2>
            <button
              onClick={onClose}
              className="text-ink-light hover:text-ink text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[70vh]">
            <div className="px-5 py-4 space-y-4">

              {/* Event type */}
              <div>
                <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1.5">
                  Type
                </label>
                <div className="flex gap-2">
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEventType(opt.value)}
                      className={[
                        "flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                        eventType === opt.value
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-blue-100 text-ink-light hover:border-blue-300",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isMeetingType ? "Meeting title…" : "Event title…"}
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Contact (required for meetings) */}
              {isMeetingType ? (
                <div>
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                    Contact *
                  </label>
                  <select
                    value={linkedContactId}
                    onChange={(e) => setLinkedContactId(e.target.value)}
                    className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Select a contact…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}{c.company ? ` — ${c.company}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                    Contact
                  </label>
                  <select
                    value={linkedContactId}
                    onChange={(e) => setLinkedContactId(e.target.value)}
                    className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">None</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}{c.company ? ` — ${c.company}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={date}
                  min={todayISO}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                />
                {isAwayDate && (
                  <p className="mt-1 text-xs text-amber-600">
                    ⚠ You have an away/travel entry on this date. You can still schedule — just a heads up.
                  </p>
                )}
              </div>

              {/* Time + Duration */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                    Duration
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setDurationMinutes(d); setCustomDuration(""); }}
                        className={[
                          "rounded border px-2 py-1 text-xs font-medium transition",
                          !customDuration && durationMinutes === d
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-blue-100 text-ink-light hover:border-blue-300",
                        ].join(" ")}
                      >
                        {d < 60 ? `${d}m` : `${d / 60}h`}
                      </button>
                    ))}
                    <input
                      type="number"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      placeholder="min"
                      min={1}
                      className="w-14 rounded border border-blue-100 px-2 py-1 text-xs text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Agenda (meetings) / Notes (others) */}
              {isMeetingType ? (
                <div>
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                    Agenda
                  </label>
                  <textarea
                    value={agenda}
                    onChange={(e) => setAgenda(e.target.value)}
                    placeholder="What will you discuss?"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes for this event…"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
                  />
                </div>
              )}

              {/* Location */}
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

              {/* Recurrence */}
              <div>
                <label className="block text-xs font-semibold text-ink-light uppercase tracking-wide mb-1">
                  Recurrence
                </label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

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
                {isPending ? "Saving…" : isMeetingType ? "Schedule Meeting" : "Create Event"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
