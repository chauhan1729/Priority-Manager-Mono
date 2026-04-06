import { describe, it, expect } from "vitest";
import type { Expense } from "@pm/types";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCE_RULES,
  isValidExpenseCategory,
  isValidExpenseRecurrenceRule,
  isValidExpenseAmount,
  sumExpenses,
  filterExpensesForDate,
  filterExpensesForWeek,
  filterExpensesForMonth,
  expenseInMonth,
  applyExpenseFilters,
  isRecurringExpense,
  shouldSyncToCalendar,
  getNextOccurrenceDate,
  getUpcomingOccurrences,
  groupExpensesByDate,
  formatExpenseAmount,
} from "../expense";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "exp-1",
    user_id: "user-1",
    title: "Coffee",
    merchant_payee: "Blue Bottle",
    amount: 5.5,
    expense_date: "2026-04-10",
    category: "food",
    payment_method: "credit_card",
    note: null,
    linked_project_id: null,
    linked_contact_id: null,
    linked_year_entry_id: null,
    recurrence_rule: null,
    created_at: "2026-04-10T09:00:00Z",
    updated_at: "2026-04-10T09:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Category constants
// ---------------------------------------------------------------------------

describe("category constants", () => {
  it("has exactly 8 categories", () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(8);
  });

  it("includes all spec §10.8 categories", () => {
    const required = [
      "personal", "business", "travel", "food",
      "transport", "subscriptions", "household", "other",
    ];
    for (const cat of required) {
      expect(EXPENSE_CATEGORIES).toContain(cat);
    }
  });

  it("has a label for every category", () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(EXPENSE_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

describe("isValidExpenseCategory", () => {
  it("accepts known categories", () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(isValidExpenseCategory(cat)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isValidExpenseCategory("groceries")).toBe(false);
    expect(isValidExpenseCategory("")).toBe(false);
    expect(isValidExpenseCategory("FOOD")).toBe(false);
  });
});

describe("isValidExpenseRecurrenceRule", () => {
  it("accepts all valid rules", () => {
    for (const rule of EXPENSE_RECURRENCE_RULES) {
      expect(isValidExpenseRecurrenceRule(rule)).toBe(true);
    }
  });

  it("accepts null and undefined (non-recurring is valid)", () => {
    expect(isValidExpenseRecurrenceRule(null)).toBe(true);
    expect(isValidExpenseRecurrenceRule(undefined)).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isValidExpenseRecurrenceRule("annually")).toBe(false);
    expect(isValidExpenseRecurrenceRule("biweekly")).toBe(false);
  });
});

describe("isValidExpenseAmount", () => {
  it("accepts zero", () => {
    expect(isValidExpenseAmount(0)).toBe(true);
  });

  it("accepts positive decimals", () => {
    expect(isValidExpenseAmount(9.99)).toBe(true);
    expect(isValidExpenseAmount(1000)).toBe(true);
  });

  it("rejects negative amounts", () => {
    expect(isValidExpenseAmount(-1)).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    expect(isValidExpenseAmount(NaN)).toBe(false);
    expect(isValidExpenseAmount(Infinity)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Summary / aggregation
// ---------------------------------------------------------------------------

describe("sumExpenses", () => {
  it("sums amounts correctly", () => {
    const expenses = [
      makeExpense({ amount: 10 }),
      makeExpense({ amount: 5.5 }),
      makeExpense({ amount: 20.25 }),
    ];
    expect(sumExpenses(expenses)).toBeCloseTo(35.75);
  });

  it("returns 0 for empty array", () => {
    expect(sumExpenses([])).toBe(0);
  });
});

describe("filterExpensesForDate", () => {
  const expenses = [
    makeExpense({ expense_date: "2026-04-10" }),
    makeExpense({ expense_date: "2026-04-11" }),
    makeExpense({ expense_date: "2026-04-10", id: "exp-2" }),
  ];

  it("returns only expenses matching the date", () => {
    const result = filterExpensesForDate(expenses, "2026-04-10");
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.expense_date === "2026-04-10")).toBe(true);
  });

  it("returns empty array for date with no expenses", () => {
    expect(filterExpensesForDate(expenses, "2026-04-09")).toHaveLength(0);
  });
});

describe("filterExpensesForWeek", () => {
  // 2026-04-06 is a Monday; week is Mon Apr 6 – Sun Apr 12
  const expenses = [
    makeExpense({ expense_date: "2026-04-05" }), // previous Sunday — outside
    makeExpense({ expense_date: "2026-04-06" }), // Monday — inside
    makeExpense({ expense_date: "2026-04-10" }), // Friday — inside
    makeExpense({ expense_date: "2026-04-12" }), // Sunday — inside
    makeExpense({ expense_date: "2026-04-13" }), // next Monday — outside
  ];

  it("includes Monday through Sunday of the week", () => {
    const result = filterExpensesForWeek(expenses, "2026-04-08"); // Wednesday
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.expense_date)).toEqual(
      expect.arrayContaining(["2026-04-06", "2026-04-10", "2026-04-12"]),
    );
  });

  it("works when the reference date IS Monday", () => {
    const result = filterExpensesForWeek(expenses, "2026-04-06");
    expect(result).toHaveLength(3);
  });
});

describe("filterExpensesForMonth", () => {
  const expenses = [
    makeExpense({ expense_date: "2026-03-31" }),
    makeExpense({ expense_date: "2026-04-01" }),
    makeExpense({ expense_date: "2026-04-30" }),
    makeExpense({ expense_date: "2026-05-01" }),
  ];

  it("returns only April expenses for '2026-04'", () => {
    const result = filterExpensesForMonth(expenses, "2026-04");
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.expense_date.startsWith("2026-04"))).toBe(true);
  });
});

describe("expenseInMonth", () => {
  it("returns true for matching month", () => {
    expect(expenseInMonth(makeExpense({ expense_date: "2026-04-15" }), "2026-04")).toBe(true);
  });

  it("returns false for non-matching month", () => {
    expect(expenseInMonth(makeExpense({ expense_date: "2026-03-31" }), "2026-04")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe("applyExpenseFilters", () => {
  const expenses = [
    makeExpense({ id: "e1", category: "food", payment_method: "cash", linked_project_id: "p1" }),
    makeExpense({ id: "e2", category: "transport", payment_method: "credit_card" }),
    makeExpense({ id: "e3", category: "food", payment_method: "cash", linked_year_entry_id: "ye1" }),
    makeExpense({ id: "e4", category: "subscriptions", expense_date: "2026-03-01" }),
  ];

  it("filters by category", () => {
    const result = applyExpenseFilters(expenses, { category: "food" });
    expect(result.map((e) => e.id)).toEqual(expect.arrayContaining(["e1", "e3"]));
    expect(result).toHaveLength(2);
  });

  it("filters by payment method", () => {
    const result = applyExpenseFilters(expenses, { paymentMethod: "cash" });
    expect(result).toHaveLength(2);
  });

  it("filters by linked project", () => {
    const result = applyExpenseFilters(expenses, { linkedProjectId: "p1" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e1");
  });

  it("filters by linked year entry (trip)", () => {
    const result = applyExpenseFilters(expenses, { linkedYearEntryId: "ye1" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e3");
  });

  it("filters by date range", () => {
    const result = applyExpenseFilters(expenses, {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });
    expect(result).not.toContain(expenses[3]); // Mar expense excluded
  });

  it("returns all when no filters are applied", () => {
    expect(applyExpenseFilters(expenses, {})).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Recurrence — spec §10.8
// ---------------------------------------------------------------------------

describe("isRecurringExpense", () => {
  it("returns true for expenses with a recurrence_rule", () => {
    expect(isRecurringExpense(makeExpense({ recurrence_rule: "monthly" }))).toBe(true);
    expect(isRecurringExpense(makeExpense({ recurrence_rule: "weekly" }))).toBe(true);
  });

  it("returns false for non-recurring expenses", () => {
    expect(isRecurringExpense(makeExpense({ recurrence_rule: null }))).toBe(false);
  });
});

describe("shouldSyncToCalendar", () => {
  it("returns true only for recurring expenses", () => {
    expect(shouldSyncToCalendar(makeExpense({ recurrence_rule: "monthly" }))).toBe(true);
    expect(shouldSyncToCalendar(makeExpense({ recurrence_rule: null }))).toBe(false);
  });
});

describe("getNextOccurrenceDate", () => {
  const monthly = makeExpense({
    expense_date: "2026-01-15",
    recurrence_rule: "monthly",
  });
  const weekly = makeExpense({
    expense_date: "2026-04-01",
    recurrence_rule: "weekly",
  });
  const daily = makeExpense({
    expense_date: "2026-04-10",
    recurrence_rule: "daily",
  });

  it("returns null for non-recurring expense", () => {
    expect(getNextOccurrenceDate(makeExpense(), "2026-04-10")).toBeNull();
  });

  it("advances monthly from base date", () => {
    // After 2026-01-15 (base), next after Jan 15 = Feb 15
    const result = getNextOccurrenceDate(monthly, "2026-01-15");
    expect(result).toBe("2026-02-15");
  });

  it("advances monthly when fromDate is well past the base", () => {
    // Expense recurs on the 15th. fromDate=Apr 10 → next occurrence is Apr 15 (still in the future)
    const result = getNextOccurrenceDate(monthly, "2026-04-10");
    expect(result).toBe("2026-04-15");
  });

  it("advances weekly correctly", () => {
    const result = getNextOccurrenceDate(weekly, "2026-04-01");
    expect(result).toBe("2026-04-08");
  });

  it("advances daily correctly", () => {
    const result = getNextOccurrenceDate(daily, "2026-04-10");
    expect(result).toBe("2026-04-11");
  });
});

describe("getUpcomingOccurrences", () => {
  const monthly = makeExpense({
    expense_date: "2026-04-01",
    recurrence_rule: "monthly",
  });

  it("returns empty array for non-recurring", () => {
    expect(getUpcomingOccurrences(makeExpense(), "2026-04-10")).toEqual([]);
  });

  it("returns the correct next N monthly occurrences", () => {
    const results = getUpcomingOccurrences(monthly, "2026-04-10", 3);
    expect(results).toHaveLength(3);
    expect(results[0]).toBe("2026-05-01");
    expect(results[1]).toBe("2026-06-01");
    expect(results[2]).toBe("2026-07-01");
  });

  it("defaults to 3 occurrences", () => {
    const results = getUpcomingOccurrences(monthly, "2026-04-10");
    expect(results).toHaveLength(3);
  });

  it("handles weekly occurrences correctly", () => {
    const weekly = makeExpense({ expense_date: "2026-04-07", recurrence_rule: "weekly" });
    const results = getUpcomingOccurrences(weekly, "2026-04-10", 2);
    expect(results[0]).toBe("2026-04-14");
    expect(results[1]).toBe("2026-04-21");
  });
});

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

describe("groupExpensesByDate", () => {
  const expenses = [
    makeExpense({ id: "e1", expense_date: "2026-04-10" }),
    makeExpense({ id: "e2", expense_date: "2026-04-08" }),
    makeExpense({ id: "e3", expense_date: "2026-04-10" }),
    makeExpense({ id: "e4", expense_date: "2026-04-09" }),
  ];

  it("groups by date and sorts descending", () => {
    const groups = groupExpensesByDate(expenses);
    expect(groups[0]![0]).toBe("2026-04-10");
    expect(groups[1]![0]).toBe("2026-04-09");
    expect(groups[2]![0]).toBe("2026-04-08");
  });

  it("collects all expenses for the same date in one group", () => {
    const groups = groupExpensesByDate(expenses);
    const aprilTen = groups.find(([d]) => d === "2026-04-10");
    expect(aprilTen![1]).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

describe("formatExpenseAmount", () => {
  it("formats positive amounts as USD currency", () => {
    expect(formatExpenseAmount(9.99)).toBe("$9.99");
    expect(formatExpenseAmount(1000)).toBe("$1,000.00");
    expect(formatExpenseAmount(0)).toBe("$0.00");
  });
});

// ---------------------------------------------------------------------------
// Architecture guard
// ---------------------------------------------------------------------------

describe("architecture guard", () => {
  it("Expense domain does not duplicate Project records", () => {
    // linkage is via FK only — no Expense field holds project data
    const expense = makeExpense({ linked_project_id: "proj-1" });
    expect(expense.linked_project_id).toBe("proj-1");
    // Only the ID is stored, not project name/status/etc
    const expenseKeys = Object.keys(expense);
    expect(expenseKeys).not.toContain("project_name");
    expect(expenseKeys).not.toContain("project_status");
  });

  it("Expense domain does not duplicate Contact records", () => {
    const expense = makeExpense({ linked_contact_id: "contact-1" });
    const expenseKeys = Object.keys(expense);
    expect(expenseKeys).not.toContain("contact_name");
    expect(expenseKeys).not.toContain("contact_email");
  });

  it("Expense domain does not duplicate YearEntry records", () => {
    const expense = makeExpense({ linked_year_entry_id: "ye-1" });
    const expenseKeys = Object.keys(expense);
    expect(expenseKeys).not.toContain("trip_title");
    expect(expenseKeys).not.toContain("trip_location");
  });

  it("Calendar sync is only for recurring expenses", () => {
    expect(shouldSyncToCalendar(makeExpense({ recurrence_rule: null }))).toBe(false);
    expect(shouldSyncToCalendar(makeExpense({ recurrence_rule: "monthly" }))).toBe(true);
  });
});
