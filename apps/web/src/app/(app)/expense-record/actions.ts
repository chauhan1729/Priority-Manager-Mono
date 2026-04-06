"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isValidExpenseCategory,
  isValidExpenseAmount,
  isValidExpenseRecurrenceRule,
  shouldSyncToCalendar,
} from "@pm/domain";
import type { Expense } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true } | null;

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateAll() {
  revalidatePath("/expense-record");
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Calendar sync helpers — spec §10.8: recurring → CalendarEvent (visibility layer)
// ---------------------------------------------------------------------------

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Upserts a CalendarEvent for a recurring expense.
 * If a CalendarEvent already exists for this expense (via linked_expense_id), updates it.
 * Creates a new one otherwise.
 * Spec §10.8: Expense is the source of truth. CalendarEvent is the timed visibility layer.
 */
async function syncExpenseToCalendar(
  supabase: SupabaseClient,
  expense: Expense,
  userId: string,
): Promise<void> {
  if (!shouldSyncToCalendar(expense)) return;

  const calendarPayload = {
    user_id: userId,
    event_type: "renewal" as const,
    title: expense.title,
    date: expense.expense_date,
    recurrence_rule: expense.recurrence_rule,
    source_type: "expense_recurring" as const,
    linked_expense_id: expense.id,
    linked_project_id: expense.linked_project_id,
    linked_contact_id: expense.linked_contact_id,
    status: "upcoming" as const,
    updated_at: new Date().toISOString(),
  };

  // Check if a CalendarEvent already exists for this expense
  const { data: existing } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("linked_expense_id", expense.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("calendar_events")
      .update(calendarPayload)
      .eq("id", existing.id);
  } else {
    await supabase.from("calendar_events").insert(calendarPayload);
  }
}

/**
 * Removes the CalendarEvent(s) linked to an expense when recurrence is removed.
 * Deletion of the expense itself auto-cascades via the FK — this is only needed
 * when the user removes recurrence_rule from an existing expense.
 */
async function removeExpenseFromCalendar(
  supabase: SupabaseClient,
  expenseId: string,
): Promise<void> {
  await supabase
    .from("calendar_events")
    .delete()
    .eq("linked_expense_id", expenseId);
}

// ---------------------------------------------------------------------------
// Create Expense
// ---------------------------------------------------------------------------

export type CreateExpenseData = {
  title: string;
  merchant_payee?: string | null;
  amount: number;
  expense_date: string;
  category: string;
  payment_method?: string | null;
  note?: string | null;
  linked_project_id?: string | null;
  linked_contact_id?: string | null;
  linked_year_entry_id?: string | null;
  recurrence_rule?: string | null;
};

export async function createExpense(data: CreateExpenseData): Promise<ActionResult> {
  const title = data.title.trim();
  if (!title) return { error: "Title is required." };

  if (!isValidExpenseCategory(data.category)) {
    return { error: "Invalid expense category." };
  }

  if (!isValidExpenseAmount(data.amount)) {
    return { error: "Amount must be a non-negative number." };
  }

  if (!data.expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.expense_date)) {
    return { error: "A valid expense date is required." };
  }

  if (!isValidExpenseRecurrenceRule(data.recurrence_rule)) {
    return { error: "Invalid recurrence rule." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { data: inserted, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      title,
      merchant_payee: data.merchant_payee?.trim() || null,
      amount: data.amount,
      expense_date: data.expense_date,
      category: data.category,
      payment_method: data.payment_method?.trim() || null,
      note: data.note?.trim() || null,
      linked_project_id: data.linked_project_id ?? null,
      linked_contact_id: data.linked_contact_id ?? null,
      linked_year_entry_id: data.linked_year_entry_id ?? null,
      recurrence_rule: data.recurrence_rule ?? null,
    })
    .select()
    .single();

  if (error || !inserted) return { error: error?.message ?? "Failed to create expense." };

  // Sync to Calendar if recurring
  await syncExpenseToCalendar(supabase, inserted as Expense, user.id);

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update Expense
// ---------------------------------------------------------------------------

export type UpdateExpenseData = {
  title?: string;
  merchant_payee?: string | null;
  amount?: number;
  expense_date?: string;
  category?: string;
  payment_method?: string | null;
  note?: string | null;
  linked_project_id?: string | null;
  linked_contact_id?: string | null;
  linked_year_entry_id?: string | null;
  recurrence_rule?: string | null;
};

export async function updateExpense(
  id: string,
  data: UpdateExpenseData,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from("expenses")
    .select("id, user_id, recurrence_rule")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) return { error: "Expense not found." };

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) return { error: "Title is required." };
    updatePayload.title = title;
  }
  if ("merchant_payee" in data)
    updatePayload.merchant_payee = data.merchant_payee?.trim() || null;
  if (data.amount !== undefined) {
    if (!isValidExpenseAmount(data.amount)) return { error: "Invalid amount." };
    updatePayload.amount = data.amount;
  }
  if (data.expense_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.expense_date))
      return { error: "Invalid date format." };
    updatePayload.expense_date = data.expense_date;
  }
  if (data.category !== undefined) {
    if (!isValidExpenseCategory(data.category)) return { error: "Invalid category." };
    updatePayload.category = data.category;
  }
  if ("payment_method" in data)
    updatePayload.payment_method = data.payment_method?.trim() || null;
  if ("note" in data) updatePayload.note = data.note?.trim() || null;
  if ("linked_project_id" in data)
    updatePayload.linked_project_id = data.linked_project_id ?? null;
  if ("linked_contact_id" in data)
    updatePayload.linked_contact_id = data.linked_contact_id ?? null;
  if ("linked_year_entry_id" in data)
    updatePayload.linked_year_entry_id = data.linked_year_entry_id ?? null;
  if ("recurrence_rule" in data) {
    if (!isValidExpenseRecurrenceRule(data.recurrence_rule))
      return { error: "Invalid recurrence rule." };
    updatePayload.recurrence_rule = data.recurrence_rule ?? null;
  }

  const { data: updated, error: updateError } = await supabase
    .from("expenses")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError || !updated) return { error: updateError?.message ?? "Update failed." };

  const updatedExpense = updated as Expense;

  // Handle calendar sync:
  // - If still recurring → upsert CalendarEvent
  // - If recurrence was removed → delete CalendarEvent
  const hadRecurrence = existing.recurrence_rule !== null;
  const hasRecurrence = updatedExpense.recurrence_rule !== null;

  if (hasRecurrence) {
    await syncExpenseToCalendar(supabase, updatedExpense, user.id);
  } else if (hadRecurrence && !hasRecurrence) {
    await removeExpenseFromCalendar(supabase, id);
  }

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete Expense
// ---------------------------------------------------------------------------

export async function deleteExpense(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Linked CalendarEvent will auto-cascade via linked_expense_id FK (migration 020)
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Create one-time occurrence — "edit this occurrence only" safe edit path
// ---------------------------------------------------------------------------

/**
 * Creates a new non-recurring expense record for a specific occurrence date.
 * The original recurring expense is NOT modified.
 * Spec §10.8: safe recurring edit flow — "this occurrence vs future occurrences".
 */
export async function createOneTimeOccurrence(
  sourceExpenseId: string,
  overrides: CreateExpenseData,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify source expense exists and belongs to user
  const { data: source, error: fetchError } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", sourceExpenseId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !source) return { error: "Source expense not found." };

  // Create a new one-time expense from the source, with overrides applied
  return createExpense({
    ...overrides,
    recurrence_rule: null, // one-time occurrence — no recurrence
  });
}
