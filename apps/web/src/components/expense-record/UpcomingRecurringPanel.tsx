"use client";

import type { Expense } from "@pm/types";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCE_LABELS,
  formatExpenseAmount,
  getUpcomingOccurrences,
  type ExpenseRecurrenceRule,
} from "@pm/domain";

// ---------------------------------------------------------------------------

interface Props {
  recurringExpenses: Expense[];
  today: string;
  currency: string;
  onEdit: (expense: Expense) => void;
}

// ---------------------------------------------------------------------------

export function UpcomingRecurringPanel({
  recurringExpenses,
  today,
  currency,
  onEdit,
}: Props) {
  // For each recurring expense, compute up to 2 upcoming dates
  const items = recurringExpenses
    .map((expense) => ({
      expense,
      upcoming: getUpcomingOccurrences(expense, today, 2),
    }))
    .filter(({ upcoming }) => upcoming.length > 0);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-ink">
          Upcoming recurring payments
        </p>
        <div className="flex-1 h-px bg-blue-50" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ expense, upcoming }) => (
          <div
            key={expense.id}
            className="flex flex-col rounded-xl border border-violet-100 bg-violet-50/20 px-4 py-3"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">
                  {expense.title}
                </p>
                {expense.merchant_payee && (
                  <p className="text-xs text-ink-light">
                    {expense.merchant_payee}
                  </p>
                )}
              </div>
              <button
                onClick={() => onEdit(expense)}
                className="flex-shrink-0 rounded-full p-1 text-ink-light hover:text-ink hover:bg-violet-100 transition text-xs"
                title="Edit recurring expense"
              >
                ✎
              </button>
            </div>

            {/* Amount + recurrence */}
            <div className="flex items-center gap-2 mb-3">
              <p className="font-handwriting text-lg text-ink">
                {formatExpenseAmount(expense.amount, currency)}
              </p>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                ↻{" "}
                {
                  EXPENSE_RECURRENCE_LABELS[
                    expense.recurrence_rule as ExpenseRecurrenceRule
                  ]
                }
              </span>
              <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                {EXPENSE_CATEGORY_LABELS[expense.category]}
              </span>
            </div>

            {/* Upcoming dates */}
            <div className="space-y-1">
              {upcoming.map((date) => (
                <div key={date} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  <p className="text-xs text-ink-light">
                    {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
