"use client";

import type { MonthlyPriority } from "@pm/types";
import {
  formatMonthLabel,
  isEligibleForCarryForward,
  MP_SECTION_LABELS,
  MP_STATUS_LABELS,
} from "@pm/domain";

// ---------------------------------------------------------------------------

interface Props {
  priority: MonthlyPriority;
  monthKey: string;
  nextMonthKey: string;
  onClose: () => void;
  onComplete: () => void;
  onDrop: () => void;
  onCarryForward: () => void;
  onRewrite: () => void;
}

// ---------------------------------------------------------------------------

export function MonthEndReviewModal({
  priority,
  monthKey,
  nextMonthKey,
  onClose,
  onComplete,
  onDrop,
  onCarryForward,
  onRewrite,
}: Props) {
  const eligible = isEligibleForCarryForward(priority);
  const currentMonthLabel = formatMonthLabel(monthKey);
  const nextMonthLabel = formatMonthLabel(nextMonthKey);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-100 px-6 py-4">
          <div>
            <h2 className="font-handwriting text-xl text-ink">Month-End Review</h2>
            <p className="text-xs text-ink-light mt-0.5">{currentMonthLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-light hover:bg-blue-50 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Priority summary */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 px-4 py-3">
            <p className="text-xs text-ink-light mb-0.5">
              {MP_SECTION_LABELS[priority.section]} · {MP_STATUS_LABELS[priority.status]}
            </p>
            <p className="text-sm font-medium text-ink">{priority.title}</p>
            {priority.note && (
              <p className="text-xs text-ink-light italic mt-1 line-clamp-2">
                "{priority.note}"
              </p>
            )}
          </div>

          {/* Review actions */}
          <p className="text-sm font-medium text-ink">
            What would you like to do with this priority?
          </p>

          <div className="space-y-2">
            {/* Complete */}
            <button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="flex w-full items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-left hover:border-emerald-400 hover:bg-emerald-50 transition"
            >
              <span className="text-emerald-600 text-lg leading-none mt-0.5">✓</span>
              <div>
                <p className="text-sm font-medium text-emerald-700">Mark as completed</p>
                <p className="text-xs text-ink-light mt-0.5">
                  This priority is done. Close it out for {currentMonthLabel}.
                </p>
              </div>
            </button>

            {/* Carry forward */}
            <button
              onClick={eligible ? onCarryForward : undefined}
              disabled={!eligible}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                eligible
                  ? "border-blue-200 bg-blue-50/40 hover:border-blue-400 hover:bg-blue-50"
                  : "border-gray-100 bg-gray-50/40 opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="text-blue-600 text-lg leading-none mt-0.5">↩</span>
              <div>
                <p
                  className={`text-sm font-medium ${eligible ? "text-blue-700" : "text-gray-500"}`}
                >
                  Carry forward to {nextMonthLabel}
                </p>
                <p className="text-xs text-ink-light mt-0.5">
                  {eligible
                    ? `Move this priority to ${nextMonthLabel}. History is preserved.`
                    : "Requires a linked project that is still in progress."}
                </p>
              </div>
            </button>

            {/* Rewrite */}
            <button
              onClick={onRewrite}
              className="flex w-full items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3 text-left hover:border-violet-400 hover:bg-violet-50 transition"
            >
              <span className="text-violet-600 text-lg leading-none mt-0.5">✎</span>
              <div>
                <p className="text-sm font-medium text-violet-700">Rewrite for next month</p>
                <p className="text-xs text-ink-light mt-0.5">
                  Create a revised version in {nextMonthLabel}. Opens the edit form.
                </p>
              </div>
            </button>

            {/* Drop */}
            <button
              onClick={onDrop}
              className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/40 px-4 py-3 text-left hover:border-red-200 hover:bg-red-50/40 transition"
            >
              <span className="text-gray-400 text-lg leading-none mt-0.5">✕</span>
              <div>
                <p className="text-sm font-medium text-gray-600 hover:text-red-600">
                  Drop this priority
                </p>
                <p className="text-xs text-ink-light mt-0.5">
                  Mark as dropped. The record stays in {currentMonthLabel} for history.
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="border-t border-blue-100 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-blue-200 py-2 text-sm text-ink-light hover:border-blue-400 hover:text-ink transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
