/**
 * GET /expense-record/export
 * Returns all user expenses as a CSV file download.
 * Spec §15: CSV expenses export.
 *
 * Query params:
 *   ?month=YYYY-MM   — filter to a specific month (optional)
 *   ?from=YYYY-MM-DD — start date filter (optional)
 *   ?to=YYYY-MM-DD   — end date filter (optional)
 */

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// CSV column headers — matches Expense field order
const CSV_HEADERS = [
  "id",
  "date",
  "title",
  "merchant_payee",
  "amount",
  "category",
  "payment_method",
  "note",
  "recurrence_rule",
  "linked_project_id",
  "linked_contact_id",
  "linked_year_entry_id",
  "created_at",
] as const;

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if value contains comma, newline, or double-quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(expense: Record<string, unknown>): string {
  return CSV_HEADERS.map((col) => {
    if (col === "date") return escapeCSV(expense["expense_date"] as string);
    return escapeCSV(expense[col] as string | number | null);
  }).join(",");
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month"); // YYYY-MM
  const from = searchParams.get("from");   // YYYY-MM-DD
  const to = searchParams.get("to");       // YYYY-MM-DD

  let query = supabase
    .from("expenses")
    .select(
      "id, expense_date, title, merchant_payee, amount, category, payment_method, note, recurrence_rule, linked_project_id, linked_contact_id, linked_year_entry_id, created_at",
    )
    .eq("user_id", user.id)
    .order("expense_date", { ascending: false });

  if (month) {
    // Filter by YYYY-MM prefix
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const nextMonth = m === 12 ? `${y! + 1}-01-01` : `${y!}-${String(m! + 1).padStart(2, "0")}-01`;
    query = query.gte("expense_date", start).lt("expense_date", nextMonth);
  } else {
    if (from) query = query.gte("expense_date", from);
    if (to) query = query.lte("expense_date", to);
  }

  const { data: expenses, error } = await query;

  if (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  const headerLine = CSV_HEADERS.join(",");
  const rows = (expenses ?? []).map((e) => rowToCSV(e as Record<string, unknown>));
  const csv = [headerLine, ...rows].join("\n");

  const filename = month
    ? `expenses-${month}.csv`
    : from && to
    ? `expenses-${from}-to-${to}.csv`
    : "expenses-all.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
