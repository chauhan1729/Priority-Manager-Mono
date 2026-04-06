"use client";

import { useEffect, useRef, useState } from "react";

import type { AnnualGoal, AnnualGoalSection, AnnualGoalStatus } from "@pm/types";
import { ANNUAL_GOAL_SECTIONS, ANNUAL_GOAL_STATUSES, SECTION_LABELS, STATUS_LABELS } from "@pm/domain";

import type { CreateGoalData, UpdateGoalData } from "@/app/(app)/annual-strategies/actions";

// ---------------------------------------------------------------------------

interface Props {
  mode: "create" | "edit";
  defaultSection?: AnnualGoalSection;
  existing?: AnnualGoal;
  onClose: () => void;
  onCreate: (data: CreateGoalData) => void;
  onUpdate: (data: UpdateGoalData) => void;
}

const STATUS_OPTIONS: AnnualGoalStatus[] = ["not_started", "active", "on_track", "at_risk", "completed", "dropped"];

export function GoalFormModal({
  mode,
  defaultSection = "business",
  existing,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const titleRef = useRef<HTMLInputElement>(null);

  const [section, setSection] = useState<AnnualGoalSection>(existing?.section ?? defaultSection);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [whyItMatters, setWhyItMatters] = useState(existing?.why_it_matters ?? "");
  const [targetDate, setTargetDate] = useState(existing?.target_date ?? "");
  const [status, setStatus] = useState<AnnualGoalStatus>(existing?.status ?? "not_started");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError("");

    if (mode === "create") {
      onCreate({
        section,
        title: title.trim(),
        description: description.trim() || undefined,
        why_it_matters: whyItMatters.trim() || undefined,
        target_date: targetDate || null,
        notes: notes.trim() || null,
      });
    } else {
      const update: UpdateGoalData = {};
      if (title.trim() !== existing?.title) update.title = title.trim();
      if (description.trim() !== existing?.description) update.description = description.trim();
      if (whyItMatters.trim() !== existing?.why_it_matters) update.why_it_matters = whyItMatters.trim();
      if ((targetDate || null) !== existing?.target_date) update.target_date = targetDate || null;
      if (status !== existing?.status) update.status = status;
      if ((notes.trim() || null) !== existing?.notes) update.notes = notes.trim() || null;
      onUpdate(update);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-100 px-6 py-4">
          <h2 className="font-handwriting text-xl text-ink">
            {mode === "create" ? "New Annual Goal" : "Edit Goal"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-light hover:bg-blue-50 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Section selector (only for create; immutable on edit) */}
          {mode === "create" ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">Section</label>
              <div className="flex gap-2">
                {ANNUAL_GOAL_SECTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSection(s)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                      section === s
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-blue-100 text-ink-light hover:border-blue-300"
                    }`}
                  >
                    {SECTION_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">Section</label>
              <p className="text-sm text-ink">{SECTION_LABELS[existing!.section]}</p>
              <p className="text-xs text-ink-light mt-0.5">Section cannot be changed after creation.</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Grow revenue by 30%"
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Why it matters */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">Why it matters</label>
            <textarea
              value={whyItMatters}
              onChange={(e) => setWhyItMatters(e.target.value)}
              placeholder="The deeper reason behind this goal"
              rows={2}
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does success look like?"
              rows={3}
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Target date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">Target date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AnnualGoalStatus)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm text-ink-light hover:border-blue-400 hover:text-ink transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              {mode === "create" ? "Create goal" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
