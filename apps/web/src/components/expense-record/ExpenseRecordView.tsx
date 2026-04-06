"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Contact, Expense, Project, YearEntry } from "@pm/types";
import {
  applyExpenseFilters,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  formatMonthLabel,
  getNextMonthKey,
  getPrevMonthKey,
  groupExpensesByDate,
  type ExpenseFilters,
} from "@pm/domain";

import {
  createExpense,
  createOneTimeOccurrence,
  deleteExpense,
  updateExpense,
  type CreateExpenseData,
  type UpdateExpenseData,
} from "@/app/(app)/expense-record/actions";
import { showToast } from "@/components/ui/Toaster";
import { ExpenseCard } from "./ExpenseCard";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { SummaryStrip } from "./SummaryStrip";
import { UpcomingRecurringPanel } from "./UpcomingRecurringPanel";

// ---------------------------------------------------------------------------

type ProjectSummary = Pick<Project, "id" | "name" | "status">;
type ContactSummary = Pick<Contact, "id" | "full_name" | "company">;
type YearEntrySummary = Pick<YearEntry, "id" | "title" | "type" | "start_date" | "end_date">;

interface Props {
  viewingMonthKey: string;
  today: string;
  expenses: Expense[];
  recurringExpenses: Expense[];
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  projects: ProjectSummary[];
  contacts: ContactSummary[];
  yearEntries: YearEntrySummary[];
}

// ---------------------------------------------------------------------------

export function ExpenseRecordView({
  viewingMonthKey,
  today,
  expenses,
  recurringExpenses,
  todayTotal,
  weekTotal,
  monthTotal,
  projects,
  contacts,
  yearEntries,
}: Props) {
  const router = useRouter();
  const [_isPending, startTransition] = useTransition();

  const [formTarget, setFormTarget] = useState<null | "new" | Expense>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ExpenseFilters>({});

  // Apply filters to the viewing month's expenses
  const filtered = applyExpenseFilters(expenses, filters);
  const grouped = groupExpensesByDate(filtered);

  const monthLabel = formatMonthLabel(viewingMonthKey);
  const prevKey = getPrevMonthKey(viewingMonthKey);
  const nextKey = getNextMonthKey(viewingMonthKey);

  function goToMonth(key: string) {
    router.push(`/expense-record?month=${key}`);
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleCreate(data: CreateExpenseData) {
    startTransition(async () => {
      const result = await createExpense(data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Expense added");
        setFormTarget(null);
      }
    });
  }

  function handleUpdate(id: string, data: UpdateExpenseData) {
    startTransition(async () => {
      const result = await updateExpense(id, data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Expense updated");
        setFormTarget(null);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteExpense(id);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Expense deleted");
      }
    });
  }

  function handleCreateOccurrence(sourceId: string, data: CreateExpenseData) {
    startTransition(async () => {
      const result = await createOneTimeOccurrence(sourceId, data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("One-time expense recorded");
        setFormTarget(null);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Derived filter options from current data
  // -------------------------------------------------------------------------
  const usedPaymentMethods = Array.from(
    new Set(expenses.map((e) => e.payment_method).filter(Boolean) as string[]),
  ).sort();

  // -------------------------------------------------------------------------
  // Active filter count (for badge)
  // -------------------------------------------------------------------------
  const activeFilterCount = [
    filters.category,
    filters.linkedProjectId,
    filters.linkedYearEntryId,
    filters.paymentMethod,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  return (
    <div className="relative min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 md:px-8 border-b border-blue-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToMonth(prevKey)}
            className="rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-ink-light hover:border-blue-400 hover:text-ink transition"
          >
            ← {formatMonthLabel(prevKey).split(" ")[0]}
          </button>
          <h2 className="font-handwriting text-xl text-ink px-2">{monthLabel}</h2>
          <button
            onClick={() => goToMonth(nextKey)}
            className="rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-ink-light hover:border-blue-400 hover:text-ink transition"
          >
            {formatMonthLabel(nextKey).split(" ")[0]} →
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Export CSV */}
          <a
            href={`/expense-record/export?month=${viewingMonthKey}`}
            download
            className="flex items-center gap-1 rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-ink-light hover:border-blue-400 hover:text-ink transition"
          >
            ↓ CSV
          </a>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
              showFilters || activeFilterCount > 0
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-blue-200 text-ink-light hover:border-blue-400 hover:text-ink"
            }`}
          >
            ⚙ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <button
            onClick={() => setFormTarget("new")}
            className="flex items-center gap-1 rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition"
          >
            + Add expense
          </button>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8 space-y-6">
        {/* Summary strip — always shows current day/week/month totals */}
        <SummaryStrip
          todayTotal={todayTotal}
          weekTotal={weekTotal}
          monthTotal={monthTotal}
        />

        {/* Quick add bar */}
        <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/30 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-ink-light">Track an expense from today</p>
          <button
            onClick={() => setFormTarget("new")}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
          >
            + Quick add
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="rounded-xl border border-blue-100 bg-white shadow-sm px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Filters</p>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({})}
                  className="text-xs text-ink-light hover:text-red-500 transition"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Category filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-ink">Category</label>
                <select
                  value={filters.category ?? ""}
                  onChange={(e) => {
                    const v = e.target.value as typeof filters.category;
                    setFilters((f) => ({ ...f, category: v }));
                  }}
                  className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                >
                  <option value="">All categories</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {EXPENSE_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project filter */}
              {projects.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink">Project</label>
                  <select
                    value={filters.linkedProjectId ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, linkedProjectId: e.target.value }))
                    }
                    className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Trip filter */}
              {yearEntries.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink">Trip</label>
                  <select
                    value={filters.linkedYearEntryId ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, linkedYearEntryId: e.target.value }))
                    }
                    className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  >
                    <option value="">All trips</option>
                    {yearEntries.map((ye) => (
                      <option key={ye.id} value={ye.id}>
                        {ye.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment method filter */}
              {usedPaymentMethods.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink">
                    Payment method
                  </label>
                  <select
                    value={filters.paymentMethod ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, paymentMethod: e.target.value }))
                    }
                    className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  >
                    <option value="">All methods</option>
                    {usedPaymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date range */}
              <div>
                <label className="mb-1 block text-xs font-medium text-ink">From</label>
                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters((f) => ({ ...f, dateFrom: v || undefined }));
                  }}
                  className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink">To</label>
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters((f) => ({ ...f, dateTo: v || undefined }));
                  }}
                  className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Expense list — grouped by date */}
        <div className="space-y-6">
          {grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-blue-100 bg-blue-50/30 px-6 py-10 text-center">
              <p className="text-sm text-ink-light">
                {activeFilterCount > 0
                  ? "No expenses match your filters."
                  : `No expenses for ${monthLabel}. Add one above.`}
              </p>
            </div>
          ) : (
            grouped.map(([date, dayExpenses]) => (
              <div key={date}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-medium text-ink-light">
                    {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <div className="flex-1 h-px bg-blue-50" />
                  <p className="text-xs text-ink-light">
                    {dayExpenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString(
                      "en-US",
                      { style: "currency", currency: "USD" },
                    )}
                  </p>
                </div>

                {/* Cards */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {dayExpenses.map((expense) => {
                    const linkedProject = projects.find(
                      (p) => p.id === expense.linked_project_id,
                    );
                    const linkedContact = contacts.find(
                      (c) => c.id === expense.linked_contact_id,
                    );
                    const linkedYearEntry = yearEntries.find(
                      (ye) => ye.id === expense.linked_year_entry_id,
                    );

                    return (
                      <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        linkedProject={linkedProject ?? null}
                        linkedContact={linkedContact ?? null}
                        linkedYearEntry={linkedYearEntry ?? null}
                        onEdit={() => setFormTarget(expense)}
                        onDelete={() => handleDelete(expense.id)}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upcoming recurring panel */}
        {recurringExpenses.length > 0 && (
          <UpcomingRecurringPanel
            recurringExpenses={recurringExpenses}
            today={today}
            onEdit={(expense) => setFormTarget(expense)}
          />
        )}
      </div>

      {/* Create / edit modal */}
      {formTarget !== null && (
        <ExpenseFormModal
          mode={formTarget === "new" ? "create" : "edit"}
          defaultDate={today}
          {...(formTarget !== "new" ? { existing: formTarget as Expense } : {})}
          projects={projects}
          contacts={contacts}
          yearEntries={yearEntries}
          onClose={() => setFormTarget(null)}
          onCreate={handleCreate}
          onUpdate={(data) => handleUpdate((formTarget as Expense).id, data)}
          onCreateOccurrence={(data) =>
            handleCreateOccurrence((formTarget as Expense).id, data)
          }
        />
      )}
    </div>
  );
}
