"use client";

import { useEffect, useRef, useState } from "react";

import type { Contact, Expense, Project, YearEntry } from "@pm/types";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCE_RULES,
  EXPENSE_RECURRENCE_LABELS,
  type ExpenseRecurrenceRule,
} from "@pm/domain";

import type {
  CreateExpenseData,
  UpdateExpenseData,
} from "@/app/(app)/expense-record/actions";

// ---------------------------------------------------------------------------

type ProjectSummary = Pick<Project, "id" | "name" | "status">;
type ContactSummary = Pick<Contact, "id" | "full_name" | "company">;
type YearEntrySummary = Pick<YearEntry, "id" | "title" | "type" | "start_date" | "end_date">;

interface Props {
  mode: "create" | "edit";
  defaultDate: string; // ISO YYYY-MM-DD — used as default for new expenses
  existing?: Expense;
  projects: ProjectSummary[];
  contacts: ContactSummary[];
  yearEntries: YearEntrySummary[];
  onClose: () => void;
  onCreate: (data: CreateExpenseData) => void;
  onUpdate: (data: UpdateExpenseData) => void;
  /** Called when user picks "record this occurrence only" for a recurring expense */
  onCreateOccurrence: (data: CreateExpenseData) => void;
}

// ---------------------------------------------------------------------------

export function ExpenseFormModal({
  mode,
  defaultDate,
  existing,
  projects,
  contacts,
  yearEntries,
  onClose,
  onCreate,
  onUpdate,
  onCreateOccurrence,
}: Props) {
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [merchantPayee, setMerchantPayee] = useState(existing?.merchant_payee ?? "");
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : "",
  );
  const [expenseDate, setExpenseDate] = useState(existing?.expense_date ?? defaultDate);
  const [category, setCategory] = useState(existing?.category ?? "other");
  const [paymentMethod, setPaymentMethod] = useState(existing?.payment_method ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [linkedProjectId, setLinkedProjectId] = useState(
    existing?.linked_project_id ?? "",
  );
  const [linkedContactId, setLinkedContactId] = useState(
    existing?.linked_contact_id ?? "",
  );
  const [linkedYearEntryId, setLinkedYearEntryId] = useState(
    existing?.linked_year_entry_id ?? "",
  );
  const [recurrenceRule, setRecurrenceRule] = useState<string>(
    existing?.recurrence_rule ?? "",
  );

  /**
   * Recurring edit mode — only shown in edit mode when the existing expense is recurring.
   * "definition" = update the recurring expense record itself
   * "occurrence" = create a one-time record for this specific date, leave original intact
   */
  const isEditingRecurring = mode === "edit" && !!existing?.recurrence_rule;
  const [recurringEditMode, setRecurringEditMode] = useState<"definition" | "occurrence">(
    "definition",
  );

  const [error, setError] = useState("");

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function buildCreateData(): CreateExpenseData {
    return {
      title: title.trim(),
      merchant_payee: merchantPayee.trim() || null,
      amount: parseFloat(amount),
      expense_date: expenseDate,
      category,
      payment_method: paymentMethod.trim() || null,
      note: note.trim() || null,
      linked_project_id: linkedProjectId || null,
      linked_contact_id: linkedContactId || null,
      linked_year_entry_id: linkedYearEntryId || null,
      recurrence_rule: recurrenceRule || null,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError("Amount must be a non-negative number.");
      return;
    }

    if (!expenseDate) {
      setError("Date is required.");
      return;
    }

    setError("");

    if (mode === "create") {
      onCreate(buildCreateData());
      return;
    }

    // Edit mode
    if (isEditingRecurring && recurringEditMode === "occurrence") {
      // Create a one-time override for this specific date — original recurring expense untouched
      onCreateOccurrence({
        ...buildCreateData(),
        recurrence_rule: null, // force one-time
      });
      return;
    }

    // Edit definition
    const update: UpdateExpenseData = {};
    if (title.trim() !== existing?.title) update.title = title.trim();
    if ((merchantPayee.trim() || null) !== existing?.merchant_payee)
      update.merchant_payee = merchantPayee.trim() || null;
    if (parsedAmount !== Number(existing?.amount)) update.amount = parsedAmount;
    if (expenseDate !== existing?.expense_date) update.expense_date = expenseDate;
    if (category !== existing?.category) update.category = category;
    if ((paymentMethod.trim() || null) !== existing?.payment_method)
      update.payment_method = paymentMethod.trim() || null;
    if ((note.trim() || null) !== existing?.note) update.note = note.trim() || null;
    if ((linkedProjectId || null) !== existing?.linked_project_id)
      update.linked_project_id = linkedProjectId || null;
    if ((linkedContactId || null) !== existing?.linked_contact_id)
      update.linked_contact_id = linkedContactId || null;
    if ((linkedYearEntryId || null) !== existing?.linked_year_entry_id)
      update.linked_year_entry_id = linkedYearEntryId || null;
    if ((recurrenceRule || null) !== existing?.recurrence_rule)
      update.recurrence_rule = recurrenceRule || null;

    onUpdate(update);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-100 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="font-handwriting text-xl text-ink">
              {mode === "create" ? "New Expense" : "Edit Expense"}
            </h2>
            {isEditingRecurring && (
              <p className="text-xs text-violet-600 mt-0.5">Recurring expense</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-light hover:bg-blue-50 hover:text-ink transition"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 px-6 py-5 overflow-y-auto flex-1"
        >
          {/* Recurring edit mode selector */}
          {isEditingRecurring && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3">
              <p className="text-xs font-medium text-violet-700 mb-2">
                This is a recurring expense. What would you like to do?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecurringEditMode("definition")}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                    recurringEditMode === "definition"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-violet-100 text-ink-light hover:border-violet-300"
                  }`}
                >
                  Update recurring schedule
                </button>
                <button
                  type="button"
                  onClick={() => setRecurringEditMode("occurrence")}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                    recurringEditMode === "occurrence"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-violet-100 text-ink-light hover:border-violet-300"
                  }`}
                >
                  Record this occurrence only
                </button>
              </div>
              {recurringEditMode === "occurrence" && (
                <p className="text-xs text-ink-light mt-2">
                  A new one-time expense will be created. The recurring schedule stays
                  unchanged.
                </p>
              )}
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
              placeholder="e.g. Netflix subscription"
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Amount + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Amount <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light text-sm">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-blue-200 pl-7 pr-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition ${
                    category === cat
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-blue-100 text-ink-light hover:border-blue-300"
                  }`}
                >
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Merchant + payment method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Merchant / Payee
              </label>
              <input
                type="text"
                value={merchantPayee}
                onChange={(e) => setMerchantPayee(e.target.value)}
                placeholder="e.g. Amazon"
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Payment method
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="e.g. Credit card"
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional context"
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Recurrence — hidden in "occurrence" edit mode */}
          {!(isEditingRecurring && recurringEditMode === "occurrence") && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">Recurrence</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecurrenceRule("")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    !recurrenceRule
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-blue-100 text-ink-light hover:border-blue-300"
                  }`}
                >
                  One-time
                </button>
                {EXPENSE_RECURRENCE_RULES.map((rule) => (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => setRecurrenceRule(rule)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      recurrenceRule === rule
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-blue-100 text-ink-light hover:border-blue-300"
                    }`}
                  >
                    {EXPENSE_RECURRENCE_LABELS[rule as ExpenseRecurrenceRule]}
                  </button>
                ))}
              </div>
              {recurrenceRule && (
                <p className="mt-1.5 text-xs text-violet-600">
                  ↻ This expense will appear in Calendar as a recurring renewal.
                </p>
              )}
            </div>
          )}

          {/* Project link */}
          {projects.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Linked project
              </label>
              <select
                value={linkedProjectId}
                onChange={(e) => setLinkedProjectId(e.target.value)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">— None —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Contact link */}
          {contacts.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Linked contact
              </label>
              <select
                value={linkedContactId}
                onChange={(e) => setLinkedContactId(e.target.value)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">— None —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                    {c.company ? ` · ${c.company}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Trip / year entry link */}
          {yearEntries.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Linked trip
              </label>
              <select
                value={linkedYearEntryId}
                onChange={(e) => setLinkedYearEntryId(e.target.value)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">— None —</option>
                {yearEntries.map((ye) => (
                  <option key={ye.id} value={ye.id}>
                    {ye.title} ({ye.start_date}
                    {ye.end_date ? ` → ${ye.end_date}` : ""})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {mode === "create"
                ? "Add expense"
                : recurringEditMode === "occurrence"
                  ? "Record this occurrence"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
