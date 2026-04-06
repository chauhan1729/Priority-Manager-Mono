import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  filterExpensesForDate,
  filterExpensesForWeek,
  filterExpensesForMonth,
  sumExpenses,
} from "@pm/domain";
import type { Contact, Expense, Project, YearEntry } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpenseRecordView } from "@/components/expense-record/ExpenseRecordView";

export const metadata: Metadata = { title: "Expense Record" };

// ---------------------------------------------------------------------------

function lastDayOfMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year!, month!, 0); // day 0 of next month = last day of this month
  return `${monthKey}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekBoundsFor(isoDate: string): { start: string; end: string } {
  const d = new Date(isoDate + "T12:00:00");
  const dow = d.getDay(); // 0=Sun
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------

export default async function ExpenseRecordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthKey = todayStr.slice(0, 7);

  // Validate and resolve the viewing month key
  const rawMonth = params.month;
  const viewingMonthKey =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : currentMonthKey;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // -------------------------------------------------------------------------
  // 1. Fetch expenses for viewing month (primary list)
  // -------------------------------------------------------------------------
  const viewingStart = `${viewingMonthKey}-01`;
  const viewingEnd = lastDayOfMonth(viewingMonthKey);

  const { data: viewingExpenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .gte("expense_date", viewingStart)
    .lte("expense_date", viewingEnd)
    .order("expense_date", { ascending: false });

  // -------------------------------------------------------------------------
  // 2. Summary expenses (always current day/week/month — not the viewed month)
  //    Fetch from week start to today so we cover today + this week + this month.
  // -------------------------------------------------------------------------
  const { start: weekStart } = weekBoundsFor(todayStr);
  const summaryFetchStart =
    weekStart < `${currentMonthKey}-01` ? weekStart : `${currentMonthKey}-01`;

  const { data: summaryExpenses } = await supabase
    .from("expenses")
    .select("id, amount, expense_date")
    .eq("user_id", user.id)
    .gte("expense_date", summaryFetchStart)
    .lte("expense_date", todayStr);

  const todayExpenses = filterExpensesForDate(
    (summaryExpenses ?? []) as Pick<Expense, "id" | "amount" | "expense_date">[],
    todayStr,
  );
  const weekExpenses = filterExpensesForWeek(
    (summaryExpenses ?? []) as Pick<Expense, "id" | "amount" | "expense_date">[],
    todayStr,
  );
  const monthExpenses = filterExpensesForMonth(
    (summaryExpenses ?? []) as Pick<Expense, "id" | "amount" | "expense_date">[],
    currentMonthKey,
  );

  const todayTotal = sumExpenses(todayExpenses);
  const weekTotal = sumExpenses(weekExpenses);
  const monthTotal = sumExpenses(monthExpenses);

  // -------------------------------------------------------------------------
  // 3. Recurring expenses (for upcoming panel — all, not month-scoped)
  // -------------------------------------------------------------------------
  const { data: recurringExpenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .not("recurrence_rule", "is", null)
    .order("expense_date", { ascending: true });

  // -------------------------------------------------------------------------
  // 4. Reference data for dropdowns
  // -------------------------------------------------------------------------
  const [projectsResult, contactsResult, yearEntriesResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("contacts")
      .select("id, full_name, company")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("full_name"),
    supabase
      .from("year_entries")
      .select("id, title, type, start_date, end_date")
      .eq("user_id", user.id)
      .in("type", ["travel", "away"])
      .order("start_date", { ascending: false }),
  ]);

  return (
    <ExpenseRecordView
      viewingMonthKey={viewingMonthKey}
      today={todayStr}
      expenses={(viewingExpenses ?? []) as Expense[]}
      recurringExpenses={(recurringExpenses ?? []) as Expense[]}
      todayTotal={todayTotal}
      weekTotal={weekTotal}
      monthTotal={monthTotal}
      projects={(projectsResult.data ?? []) as Pick<Project, "id" | "name" | "status">[]}
      contacts={(contactsResult.data ?? []) as Pick<Contact, "id" | "full_name" | "company">[]}
      yearEntries={
        (yearEntriesResult.data ?? []) as Pick<
          YearEntry,
          "id" | "title" | "type" | "start_date" | "end_date"
        >[]
      }
    />
  );
}
