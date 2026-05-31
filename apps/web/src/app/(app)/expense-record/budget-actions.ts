"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Per-month expense budgets (spec: budget for the viewed month)
// One row per (user, "YYYY-MM"); set/cleared from the Expense Record screen.
// ---------------------------------------------------------------------------

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Returns the budget amount for the month, or null when none is set. */
export async function getMonthlyBudget(monthKey: string): Promise<number | null> {
  if (!MONTH_RE.test(monthKey)) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("expense_budgets")
    .select("amount")
    .eq("user_id", user.id)
    .eq("month", monthKey)
    .maybeSingle();

  return data ? Number(data.amount) : null;
}

/** Upserts the budget for a month. */
export async function setMonthlyBudget(
  monthKey: string,
  amount: number,
): Promise<{ error: string } | void> {
  if (!MONTH_RE.test(monthKey)) return { error: "Invalid month" };
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Budget must be a non-negative number" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("expense_budgets").upsert(
    {
      user_id: user.id,
      month: monthKey,
      amount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month" },
  );

  if (error) return { error: error.message };
  revalidatePath("/expense-record");
}

/** Removes the budget for a month. */
export async function clearMonthlyBudget(
  monthKey: string,
): Promise<{ error: string } | void> {
  if (!MONTH_RE.test(monthKey)) return { error: "Invalid month" };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("expense_budgets")
    .delete()
    .eq("user_id", user.id)
    .eq("month", monthKey);

  if (error) return { error: error.message };
  revalidatePath("/expense-record");
}
