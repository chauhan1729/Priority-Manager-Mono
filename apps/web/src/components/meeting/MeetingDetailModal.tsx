"use client";

import { useState } from "react";

import {
  isMeetingPast,
  isMeetingRunning,
  needsStatusUpdatePrompt,
  needsTakeawayPrompt,
} from "@pm/domain";
import type { Contact, Meeting, MeetingStatus } from "@pm/types";

function formatDate(isoDate: string): string {
  const parts = isoDate.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]!) - 1, Number(parts[2]));
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const STATUS_UPDATE_OPTIONS: { value: MeetingStatus; label: string; description: string }[] = [
  { value: "completed", label: "Completed",  description: "Meeting happened as planned" },
  { value: "missed",    label: "Missed",     description: "Meeting did not happen" },
  { value: "cancelled", label: "Cancelled",  description: "Meeting was cancelled" },
];

const STATUS_STYLES: Record<string, string> = {
  upcoming:  "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  missed:    "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

interface Props {
  meeting: Meeting;
  contact: Contact | null;
  isPending: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onStatusUpdate: (status: MeetingStatus, keyTakeaways?: string | null) => void;
  onSaveTakeaways: (keyTakeaways: string) => void;
}

export function MeetingDetailModal({
  meeting,
  contact,
  isPending,
  onClose,
  onEdit,
  onDelete,
  onArchive,
  onStatusUpdate,
  onSaveTakeaways,
}: Props) {
  const isPast = isMeetingPast(meeting);
  const isRunning = isMeetingRunning(meeting);
  const needsUpdate = needsStatusUpdatePrompt(meeting);
  const needsTakeaway = needsTakeawayPrompt(meeting);

  const [selectedStatus, setSelectedStatus] = useState<MeetingStatus | null>(null);
  const [takeawayInput, setTakeawayInput] = useState(meeting.key_takeaways ?? "");
  const [showTakeawayForm, setShowTakeawayForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  function handleStatusSubmit() {
    if (!selectedStatus) return;
    const takeaways = takeawayInput.trim() || null;
    onStatusUpdate(selectedStatus, takeaways);
  }

  function handleSaveTakeaways() {
    onSaveTakeaways(takeawayInput.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-blue-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-handwriting text-2xl text-ink">{meeting.title}</h2>
                {isRunning && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 uppercase tracking-wide animate-pulse">
                    In progress
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[meeting.status] ?? STATUS_STYLES["upcoming"]!}`}>
                  {meeting.status}
                </span>
              </div>
              {contact && (
                <p className="text-sm text-ink-light">
                  {contact.full_name}
                  {(contact.role || contact.company) && (
                    <span className="text-ink-light/60">
                      {" "}· {[contact.role, contact.company].filter(Boolean).join(", ")}
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-ink-light hover:text-ink text-lg leading-none mt-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Date / time / duration */}
          <section className="space-y-1">
            <p className="text-xs text-ink-light/60 font-semibold uppercase tracking-wide">When</p>
            <p className="text-sm text-ink">
              {formatDate(meeting.date)}
            </p>
            <p className="text-sm text-ink-light">
              {formatTime(meeting.start_at)} – {formatTime(meeting.end_at)}{" "}
              <span className="text-ink-light/60">({formatDuration(meeting.duration_minutes)})</span>
              {meeting.recurrence_rule && (
                <span className="ml-2 text-[10px] text-blue-500 font-medium">
                  ↻ Repeats {meeting.recurrence_rule}
                </span>
              )}
            </p>
          </section>

          {/* ── STATUS UPDATE PROMPT (spec §10.9) ─────────────────────────── */}
          {needsUpdate && (
            <section className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-orange-800">
                This meeting's time has passed. How did it go?
              </p>
              <div className="space-y-2">
                {STATUS_UPDATE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status-update"
                      value={opt.value}
                      checked={selectedStatus === opt.value}
                      onChange={() => setSelectedStatus(opt.value)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-xs font-medium text-ink">{opt.label}</p>
                      <p className="text-[10px] text-ink-light">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              {selectedStatus === "completed" && (
                <textarea
                  value={takeawayInput}
                  onChange={(e) => setTakeawayInput(e.target.value)}
                  placeholder="Key takeaways or next steps… (optional)"
                  rows={3}
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-light/40 focus:border-orange-400 focus:outline-none resize-none"
                />
              )}

              <button
                type="button"
                onClick={handleStatusSubmit}
                disabled={!selectedStatus || isPending}
                className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-40"
              >
                {isPending ? "Saving…" : "Update status"}
              </button>
            </section>
          )}

          {/* ── TAKEAWAY PROMPT (completed, no takeaways) ─────────────────── */}
          {needsTakeaway && !needsUpdate && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-800">
                Add key takeaways for this meeting
              </p>
              {showTakeawayForm ? (
                <>
                  <textarea
                    value={takeawayInput}
                    onChange={(e) => setTakeawayInput(e.target.value)}
                    placeholder="What were the outcomes or next steps?"
                    rows={3}
                    autoFocus
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-light/40 focus:border-amber-400 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveTakeaways}
                      disabled={isPending}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40"
                    >
                      {isPending ? "Saving…" : "Save takeaways"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTakeawayForm(false)}
                      className="text-xs text-ink-light hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTakeawayForm(true)}
                  className="text-xs text-amber-700 hover:underline font-medium"
                >
                  + Add takeaways
                </button>
              )}
            </section>
          )}

          {/* Agenda */}
          {meeting.agenda && (
            <section>
              <p className="text-xs text-ink-light/60 font-semibold uppercase tracking-wide mb-1">Agenda</p>
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{meeting.agenda}</p>
            </section>
          )}

          {/* Key takeaways (display when not in prompt flow) */}
          {meeting.key_takeaways && (
            <section>
              <p className="text-xs text-ink-light/60 font-semibold uppercase tracking-wide mb-1">Key takeaways</p>
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{meeting.key_takeaways}</p>
            </section>
          )}

          {/* Contact info snippet */}
          {contact && (contact.email || contact.phone) && (
            <section>
              <p className="text-xs text-ink-light/60 font-semibold uppercase tracking-wide mb-1">Contact</p>
              <div className="space-y-0.5">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="block text-xs text-blue-600 hover:underline"
                  >
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <p className="text-xs text-ink-light">{contact.phone}</p>
                )}
              </div>
            </section>
          )}

          {/* Archive confirmation */}
          {confirmArchive && (
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
              <p className="text-xs font-medium text-gray-800">Archive this meeting? It will be hidden from the main view.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onArchive}
                  disabled={isPending}
                  className="rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {isPending ? "Archiving…" : "Archive"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(false)}
                  className="text-xs text-ink-light hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {/* Delete confirmation */}
          {confirmDelete && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-xs font-medium text-red-800">Delete this meeting permanently?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-ink-light hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-blue-50 px-6 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              className="text-sm text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
            {!meeting.archived && (
              <button
                onClick={() => setConfirmArchive(true)}
                disabled={isPending}
                className="text-sm text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-50"
              >
                Archive
              </button>
            )}
          </div>
          <button
            onClick={onEdit}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPast ? "Edit notes" : "Edit meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}
