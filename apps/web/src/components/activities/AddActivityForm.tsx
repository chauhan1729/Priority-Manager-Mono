"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { todayISO } from "@pm/domain";
import type { ActivitySection, Contact, Project } from "@pm/types";
import { createActivity, type ActionResult } from "@/app/(app)/activities/actions";
import { showToast } from "@/components/ui/Toaster";

const SECTION_OPTIONS: { value: ActivitySection; label: string }[] = [
  { value: "work", label: "Work" },
  { value: "outside", label: "Outside" },
  { value: "unplanned", label: "Unplanned / Sudden" },
  { value: "delegated", label: "Delegated" },
];

interface Props {
  selectedDate: string;
  projects: Pick<Project, "id" | "name" | "status">[];
  contacts: Pick<Contact, "id" | "full_name">[];
  onSuccess: () => void;
  onCancel: () => void;
  /** Phase 0A: default priority for new activities — "A" on the A screen, "B" on the B screen. */
  defaultPriority?: "A" | "B";
  /** Phase 1B: when true, leaving the date blank parks the item on Someday (B screen / projects). */
  defaultToSomeday?: boolean;
}

export function AddActivityForm({
  selectedDate,
  projects,
  contacts,
  onSuccess,
  onCancel,
  defaultPriority = "B",
  defaultToSomeday = false,
}: Props) {
  const [state, formAction] = useActionState<ActionResult, FormData>(createActivity, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [section, setSection] = useState<ActivitySection>("work");
  const [showMore, setShowMore] = useState(false);
  const [recurring, setRecurring] = useState(false);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
      setSection("work");
      setShowMore(false);
      showToast("Activity added");
      onSuccess();
    }
  }, [state, onSuccess]);

  const isWork = section === "work";
  const isDelegated = section === "delegated";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-ink-light uppercase tracking-wide">
          Add Activity
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-ink-light hover:text-ink"
        >
          ✕ Cancel
        </button>
      </div>

      {/* Title — always shown */}
      <input
        name="title"
        type="text"
        required
        autoFocus
        placeholder="Activity title"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Section */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Section</label>
          <select
            name="section_type"
            value={section}
            onChange={(e) => setSection(e.target.value as ActivitySection)}
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
          >
            {SECTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Estimated hours — always shown */}
        <div>
          <label className="block text-xs text-ink-light mb-1">Est. hours</label>
          <input
            name="estimated_hours"
            type="number"
            min="0.25"
            step="0.25"
            required
            placeholder="e.g. 1.5"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Contact picker — required when Delegated */}
      {isDelegated && (
        <div>
          <label className="block text-xs text-ink-light mb-1">
            Delegate to <span className="text-red-500">*</span>
          </label>
          {contacts.length === 0 ? (
            <p className="text-xs text-ink-light">
              No contacts yet.{" "}
              <a href="/communication-planner" className="text-blue-600 hover:underline">
                Add one first.
              </a>
            </p>
          ) : (
            <select
              name="delegated_contact_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
            >
              <option value="">Select person…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Project — required for Work, optional for all other sections */}
      {(isWork || showMore || isDelegated) && (
        <div>
          <label className="block text-xs text-ink-light mb-1">
            Project {isWork && <span className="text-red-500">*</span>}
          </label>
          {projects.length === 0 ? (
            <p className="text-xs text-ink-light">
              No active projects.{" "}
              <a href="/project-planner" className="text-blue-600 hover:underline">
                Create one first.
              </a>
            </p>
          ) : (
            <select
              name="linked_project_id"
              required={isWork}
              defaultValue=""
              className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
            >
              <option value="">{isWork ? "Select project…" : "No project"}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Expand / collapse additional fields */}
      {!showMore && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          + More options (date, priority, note)
        </button>
      )}

      {showMore && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Date — optional when defaulting to Someday (blank = parked) */}
            <div>
              <label className="block text-xs text-ink-light mb-1">
                Date {defaultToSomeday && <span className="text-ink-light/60">(blank → Someday)</span>}
              </label>
              <input
                name="activity_date"
                type="date"
                required={!defaultToSomeday}
                min={todayISO()}
                defaultValue={defaultToSomeday ? "" : selectedDate}
                className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs text-ink-light mb-1">Priority</label>
              <select
                name="priority"
                defaultValue={defaultPriority}
                className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              >
                <option value="A">A — Must do today</option>
                <option value="B">B — Should do today</option>
              </select>
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-xs text-ink-light mb-1">Repeat</label>
            <select
              name="recurrence_rule"
              defaultValue=""
              onChange={(e) => setRecurring(e.target.value !== "")}
              className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
            >
              <option value="">Does not repeat</option>
              <option value="daily">Daily (next 3 days)</option>
              <option value="weekly">Weekly (next 3 weeks)</option>
              <option value="monthly">Monthly (next 3 months)</option>
            </select>
            {/* Phase 3B: nudge recurring commitments toward a self-appointment, not an A task. */}
            {recurring && (
              <p className="mt-1 text-xs text-violet-700 bg-violet-50 rounded-lg px-3 py-1.5">
                A recurring commitment (like “read every day”) works better as a{" "}
                <a href="/calendar" className="font-medium underline">
                  calendar appointment with yourself
                </a>{" "}
                — a time block, not an A task.
              </p>
            )}
          </div>

          {/* Note */}
          <input
            name="note"
            type="text"
            placeholder="Note (optional)"
            className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setShowMore(false)}
            className="text-xs text-ink-light hover:underline"
          >
            – Fewer options
          </button>
        </div>
      )}

      {/* Hidden fields for quick-add (when showMore is false) */}
      {!showMore && (
        <>
          {/* No date hidden field when defaulting to Someday → action parks it. */}
          {!defaultToSomeday && <input type="hidden" name="activity_date" value={selectedDate} />}
          <input type="hidden" name="priority" value={defaultPriority} />
        </>
      )}

      {state && "error" in state && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Activity
        </button>
      </div>
    </form>
  );
}
