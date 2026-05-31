"use client";

import { useState } from "react";

import type { Contact, Expense, Project, YearEntry } from "@pm/types";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCE_LABELS,
  formatExpenseAmount,
  type ExpenseRecurrenceRule,
} from "@pm/domain";

// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  personal: { bg: "bg-blue-50", text: "text-blue-700" },
  business: { bg: "bg-indigo-50", text: "text-indigo-700" },
  travel: { bg: "bg-amber-50", text: "text-amber-700" },
  food: { bg: "bg-orange-50", text: "text-orange-700" },
  transport: { bg: "bg-sky-50", text: "text-sky-700" },
  subscriptions: { bg: "bg-violet-50", text: "text-violet-700" },
  household: { bg: "bg-emerald-50", text: "text-emerald-700" },
  other: { bg: "bg-gray-50", text: "text-gray-600" },
};

type ProjectSummary = Pick<Project, "id" | "name" | "status">;
type ContactSummary = Pick<Contact, "id" | "full_name" | "company">;
type YearEntrySummary = Pick<YearEntry, "id" | "title" | "type" | "start_date" | "end_date">;

interface Props {
  expense: Expense;
  currency: string;
  linkedProject: ProjectSummary | null;
  linkedContact: ContactSummary | null;
  linkedYearEntry: YearEntrySummary | null;
  onEdit: () => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------

export function ExpenseCard({
  expense,
  currency,
  linkedProject,
  linkedContact,
  linkedYearEntry,
  onEdit,
  onDelete,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const catColors = CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS.other!;

  return (
    <div className="flex flex-col rounded-xl border border-blue-100 bg-white shadow-sm hover:shadow-md transition">
      {/* Main content */}
      <div className="px-4 pt-4 pb-3 flex-1">
        {/* Top row: amount + actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-handwriting text-2xl text-ink leading-none">
            {formatExpenseAmount(expense.amount, currency)}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="rounded-full p-1 text-ink-light hover:text-ink hover:bg-blue-50 transition text-xs"
              title="Edit"
            >
              ✎
            </button>
          </div>
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-ink mb-1">{expense.title}</p>

        {/* Merchant / payee */}
        {expense.merchant_payee && (
          <p className="text-xs text-ink-light mb-1">{expense.merchant_payee}</p>
        )}

        {/* Note preview */}
        {expense.note && (
          <p className="text-xs text-ink-light italic line-clamp-1 mb-2">
            &ldquo;{expense.note}&rdquo;
          </p>
        )}

        {/* Category + recurring badge row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${catColors.bg} ${catColors.text}`}
          >
            {EXPENSE_CATEGORY_LABELS[expense.category]}
          </span>

          {expense.recurrence_rule && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              ↻{" "}
              {EXPENSE_RECURRENCE_LABELS[expense.recurrence_rule as ExpenseRecurrenceRule]}
            </span>
          )}

          {expense.payment_method && (
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
              {expense.payment_method}
            </span>
          )}
        </div>
      </div>

      {/* Linkage chips */}
      {(linkedProject || linkedContact || linkedYearEntry) && (
        <div className="border-t border-blue-50 px-4 py-2 flex flex-wrap gap-1.5">
          {linkedProject && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
              📁 {linkedProject.name}
            </span>
          )}
          {linkedContact && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
              👤 {linkedContact.full_name}
            </span>
          )}
          {linkedYearEntry && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              ✈ {linkedYearEntry.title}
            </span>
          )}
        </div>
      )}

      {/* Delete */}
      <div className="border-t border-blue-50 px-4 py-2.5">
        {confirmDelete ? (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-lg border border-blue-200 py-1 text-xs text-ink-light hover:border-blue-400 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
              className="flex-1 rounded-lg bg-red-600 py-1 text-xs font-medium text-white hover:bg-red-700 transition"
            >
              Delete
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-ink-light hover:text-red-500 transition"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
