"use client";

import { useState } from "react";

import { isMeetingPast, todayISO } from "@pm/domain";
import type { Contact, Meeting, MeetingRecurrenceRule, MeetingStatus } from "@pm/types";

const DURATION_OPTIONS = [
  { value: 15,  label: "15 min" },
  { value: 30,  label: "30 min" },
  { value: 45,  label: "45 min" },
  { value: 60,  label: "1 hour" },
  { value: 90,  label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
];

const RECURRENCE_OPTIONS: { value: MeetingRecurrenceRule; label: string }[] = [
  { value: null,      label: "No repeat" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const STATUS_OPTIONS: { value: MeetingStatus; label: string }[] = [
  { value: "upcoming",  label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "missed",    label: "Missed" },
  { value: "cancelled", label: "Cancelled" },
];

interface Props {
  /** When provided, the form is in edit mode. */
  meeting?: Meeting;
  contacts: Contact[];
  isPending: boolean;
  onSave: (data: {
    title?: string;
    linked_contact_id?: string;
    date?: string;
    start_time?: string;
    duration_minutes?: number;
    agenda?: string | null;
    recurrence_rule?: MeetingRecurrenceRule;
    key_takeaways?: string | null;
    status?: MeetingStatus;
  }) => void;
  onClose: () => void;
}

export function MeetingFormModal({ meeting, contacts, isPending, onSave, onClose }: Props) {
  const isEdit = meeting !== undefined;
  const isPast = isEdit && isMeetingPast(meeting);

  // Extract HH:MM from start_at ISO string for the time input
  const existingStartTime = meeting
    ? (() => {
        const d = new Date(meeting.start_at);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      })()
    : "";

  // ----------- Form state -----------
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [contactId, setContactId] = useState(meeting?.linked_contact_id ?? "");
  const [date, setDate] = useState(meeting?.date ?? todayISO());
  const [startTime, setStartTime] = useState(existingStartTime || "09:00");
  const [duration, setDuration] = useState(
    meeting?.duration_minutes ?? 60,
  );
  const [customDuration, setCustomDuration] = useState(
    !DURATION_OPTIONS.some((o) => o.value === meeting?.duration_minutes),
  );
  const [agenda, setAgenda] = useState(meeting?.agenda ?? "");
  const [recurrence, setRecurrence] = useState<MeetingRecurrenceRule>(
    meeting?.recurrence_rule ?? null,
  );
  const [keyTakeaways, setKeyTakeaways] = useState(meeting?.key_takeaways ?? "");
  const [status, setStatus] = useState<MeetingStatus>(meeting?.status ?? "upcoming");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);

    if (isPast) {
      // Past meeting: only key_takeaways + status allowed
      onSave({
        key_takeaways: keyTakeaways.trim() || null,
        status,
      });
      return;
    }

    // Future meeting: validate full form
    if (!title.trim()) { setError("Title is required."); return; }
    if (!contactId) { setError("A contact is required."); return; }
    if (!date) { setError("Date is required."); return; }
    if (!startTime) { setError("Start time is required."); return; }
    if (!duration || duration <= 0) { setError("Duration must be positive."); return; }

    onSave({
      title: title.trim(),
      linked_contact_id: contactId,
      date,
      start_time: startTime,
      duration_minutes: duration,
      agenda: agenda.trim() || null,
      recurrence_rule: recurrence,
      key_takeaways: keyTakeaways.trim() || null,
      status,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-handwriting text-xl text-ink">
          {isPast ? "Edit meeting notes" : isEdit ? "Edit Meeting" : "New Meeting"}
        </h2>

        {isPast && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This meeting is in the past. Only key takeaways and status can be edited.
          </div>
        )}

        <div className="space-y-3">
          {/* Title — future only */}
          {!isPast && (
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting title"
                autoFocus={!isPast}
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>
          )}

          {/* Contact — future only */}
          {!isPast && (
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">
                Contact <span className="text-red-500">*</span>
              </label>
              {contacts.length === 0 ? (
                <p className="text-xs text-ink-light rounded-lg bg-blue-50 px-3 py-2">
                  No contacts yet.{" "}
                  <a href="/communication-planner" className="text-blue-600 hover:underline">
                    Add a contact first.
                  </a>
                </p>
              ) : (
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                >
                  <option value="">Select contact…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                      {c.company ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Date + Start time — future only */}
          {!isPast && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  min={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">
                  Start time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Duration — future only */}
          {!isPast && (
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">
                Duration <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setDuration(opt.value); setCustomDuration(false); }}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      !customDuration && duration === opt.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-blue-100 text-ink-light hover:border-blue-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomDuration(true)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    customDuration
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-blue-100 text-ink-light hover:border-blue-300"
                  }`}
                >
                  Custom
                </button>
              </div>
              {customDuration && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-24 rounded-lg border border-blue-100 px-3 py-1.5 text-sm text-ink focus:border-blue-400 focus:outline-none"
                  />
                  <span className="text-xs text-ink-light">minutes</span>
                </div>
              )}
            </div>
          )}

          {/* Agenda — future only */}
          {!isPast && (
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Agenda</label>
              <textarea
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="What will you discuss?"
                rows={3}
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/40 focus:border-blue-400 focus:outline-none resize-none"
              />
            </div>
          )}

          {/* Recurrence — future only */}
          {!isPast && (
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Repeat</label>
              <select
                value={recurrence ?? ""}
                onChange={(e) => setRecurrence((e.target.value || null) as MeetingRecurrenceRule)}
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={String(opt.value)} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Key takeaways — always shown (past only in restricted mode) */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">
              Key takeaways
              {isPast && (
                <span className="ml-1 text-[10px] text-ink-light/60">(editable)</span>
              )}
            </label>
            <textarea
              value={keyTakeaways}
              onChange={(e) => setKeyTakeaways(e.target.value)}
              placeholder="What were the outcomes or next steps?"
              rows={isPast ? 4 : 3}
              autoFocus={isPast}
              className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink placeholder:text-ink-light/40 focus:border-blue-400 focus:outline-none resize-none"
            />
          </div>

          {/* Status — always shown */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">Status</label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    status === opt.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-blue-100 text-ink-light hover:border-blue-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-1 border-t border-blue-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-light hover:bg-blue-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}
