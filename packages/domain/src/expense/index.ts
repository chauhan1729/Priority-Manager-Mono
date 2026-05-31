import type { Expense, ExpenseCategory } from "@pm/types";

// ---------------------------------------------------------------------------
// Category constants — spec §10.8
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "personal",
  "business",
  "travel",
  "food",
  "transport",
  "subscriptions",
  "household",
  "other",
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  personal: "Personal",
  business: "Business",
  travel: "Travel",
  food: "Food",
  transport: "Transport",
  subscriptions: "Subscriptions",
  household: "Household",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Recurrence constants — spec §10.8: only subscriptions/renewals in v1
// ---------------------------------------------------------------------------

export const EXPENSE_RECURRENCE_RULES = ["daily", "weekly", "monthly"] as const;
export type ExpenseRecurrenceRule = (typeof EXPENSE_RECURRENCE_RULES)[number];

export const EXPENSE_RECURRENCE_LABELS: Record<ExpenseRecurrenceRule, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function isValidExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as string[]).includes(value);
}

export function isValidExpenseRecurrenceRule(value: string | null | undefined): boolean {
  if (!value) return true; // null is valid (non-recurring)
  return (EXPENSE_RECURRENCE_RULES as readonly string[]).includes(value);
}

/** Amount must be a finite non-negative number. */
export function isValidExpenseAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

// ---------------------------------------------------------------------------
// Summary / aggregation — spec §10.8: today / this week / this month totals
// ---------------------------------------------------------------------------

/** Sum amounts for an array of expenses. */
export function sumExpenses(expenses: Pick<Expense, "amount">[]): number {
  return expenses.reduce((acc, e) => acc + Number(e.amount), 0);
}

/** Expenses whose expense_date exactly matches the given ISO date (YYYY-MM-DD). */
export function filterExpensesForDate<T extends { expense_date: string }>(
  expenses: T[],
  date: string,
): T[] {
  return expenses.filter((e) => e.expense_date === date);
}

/**
 * Expenses within the calendar week (Mon–Sun) that contains the given ISO date.
 * Week starts Monday per ISO 8601.
 */
export function filterExpensesForWeek<T extends { expense_date: string }>(
  expenses: T[],
  date: string,
): T[] {
  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay(); // 0=Sun 1=Mon … 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const start = monday.toISOString().slice(0, 10);
  const end = sunday.toISOString().slice(0, 10);
  return expenses.filter((e) => e.expense_date >= start && e.expense_date <= end);
}

/** Expenses whose expense_date belongs to the given "YYYY-MM" month key. */
export function filterExpensesForMonth<T extends { expense_date: string }>(
  expenses: T[],
  monthKey: string,
): T[] {
  return expenses.filter(
    (e) => e.expense_date.startsWith(monthKey + "-") || e.expense_date.startsWith(monthKey),
  );
}


/** Return true when expense_date belongs to the YYYY-MM month key. */
export function expenseInMonth(expense: Expense, monthKey: string): boolean {
  return expense.expense_date.slice(0, 7) === monthKey;
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

export interface ExpenseFilters {
  category?: ExpenseCategory | "" | undefined;
  linkedProjectId?: string | "" | undefined;
  linkedYearEntryId?: string | "" | undefined;
  paymentMethod?: string | "" | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export function applyExpenseFilters(
  expenses: Expense[],
  filters: ExpenseFilters,
): Expense[] {
  return expenses.filter((e) => {
    if (filters.category && e.category !== filters.category) return false;
    if (filters.linkedProjectId && e.linked_project_id !== filters.linkedProjectId) return false;
    if (filters.linkedYearEntryId && e.linked_year_entry_id !== filters.linkedYearEntryId) return false;
    if (filters.paymentMethod && e.payment_method !== filters.paymentMethod) return false;
    if (filters.dateFrom && e.expense_date < filters.dateFrom) return false;
    if (filters.dateTo && e.expense_date > filters.dateTo) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Recurrence helpers — spec §10.8: subscriptions/renewals sync to Calendar
// ---------------------------------------------------------------------------

export function isRecurringExpense(expense: Expense): boolean {
  return expense.recurrence_rule !== null;
}

/**
 * Returns true if this expense should be mirrored as a CalendarEvent.
 * Only recurring expenses (subscriptions/renewals) sync to Calendar.
 */
export function shouldSyncToCalendar(expense: Expense): boolean {
  return isRecurringExpense(expense);
}

/**
 * Advances a date by one recurrence interval.
 * Returns an ISO date string.
 */
function advanceByRule(date: string, rule: ExpenseRecurrenceRule): string {
  const d = new Date(date + "T12:00:00");
  if (rule === "daily") {
    d.setDate(d.getDate() + 1);
  } else if (rule === "weekly") {
    d.setDate(d.getDate() + 7);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the ISO date of the first occurrence AFTER fromDate (exclusive).
 * Returns null if the expense is not recurring.
 */
export function getNextOccurrenceDate(
  expense: Expense,
  fromDate: string,
): string | null {
  if (!expense.recurrence_rule) return null;
  const rule = expense.recurrence_rule as ExpenseRecurrenceRule;
  let current = expense.expense_date;
  // Advance until we pass fromDate
  while (current <= fromDate) {
    current = advanceByRule(current, rule);
  }
  return current;
}

/**
 * Returns up to `count` upcoming occurrence dates, each AFTER the previous.
 * Starts from the first occurrence after fromDate.
 */
export function getUpcomingOccurrences(
  expense: Expense,
  fromDate: string,
  count = 3,
): string[] {
  if (!expense.recurrence_rule) return [];
  const results: string[] = [];
  let pivot = fromDate;
  for (let i = 0; i < count; i++) {
    const next = getNextOccurrenceDate(expense, pivot);
    if (!next) break;
    results.push(next);
    pivot = next;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Grouping — for daily card list
// ---------------------------------------------------------------------------

/**
 * Groups expenses by expense_date, returning an array of [date, expenses[]] pairs
 * sorted in descending date order (most recent first).
 */
export function groupExpensesByDate(
  expenses: Expense[],
): [string, Expense[]][] {
  const map: Record<string, Expense[]> = {};
  for (const e of expenses) {
    if (!map[e.expense_date]) map[e.expense_date] = [];
    map[e.expense_date]!.push(e);
  }
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function formatExpenseAmount(amount: number, currencyCode = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// App-wide supported display currencies. Amounts are re-labeled, never converted.
export const CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "CAD", label: "Canadian Dollar", symbol: "$" },
  { code: "AUD", label: "Australian Dollar", symbol: "$" },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]["code"];

// Returns the symbol for a known currency code, or the code itself if unknown.
export function currencySymbol(code: string): string {
  const match = CURRENCY_OPTIONS.find((c) => c.code === code);
  return match ? match.symbol : code;
}

export function formatExpenseDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
