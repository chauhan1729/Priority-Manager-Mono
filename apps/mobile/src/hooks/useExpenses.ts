import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense } from '@pm/types';
import { shouldSyncToCalendar } from '@pm/domain';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const expenseKeys = {
  all: ['expenses'] as const,
  forMonth: (monthKey: string) => ['expenses', 'month', monthKey] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useExpenses(monthKey: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: expenseKeys.forMonth(monthKey),
    queryFn: async () => {
      const startDate = `${monthKey}-01`;
      // Get last day of month
      const [year, month] = monthKey.split('-').map(Number);
      const endDate = new Date(year!, month!, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user!.id)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!user && !!monthKey,
  });
}

// ---------------------------------------------------------------------------
// Calendar sync helpers
// ---------------------------------------------------------------------------

async function syncExpenseToCalendar(expense: Expense, userId: string): Promise<void> {
  if (!shouldSyncToCalendar(expense)) return;

  const payload = {
    user_id: userId,
    event_type: 'renewal' as const,
    title: expense.title,
    date: expense.expense_date,
    recurrence_rule: expense.recurrence_rule,
    source_type: 'expense_recurring' as const,
    linked_expense_id: expense.id,
    linked_project_id: expense.linked_project_id,
    linked_contact_id: expense.linked_contact_id,
    status: 'upcoming' as const,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('linked_expense_id', expense.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('calendar_events').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('calendar_events').insert(payload);
  }
}

async function removeExpenseFromCalendar(expenseId: string): Promise<void> {
  await supabase.from('calendar_events').delete().eq('linked_expense_id', expenseId);
}

// ---------------------------------------------------------------------------
// Create
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

export function useCreateExpense() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateExpenseData) => {
      const { data: inserted, error } = await supabase
        .from('expenses')
        .insert({
          user_id: user!.id,
          title: data.title.trim(),
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
      if (error || !inserted) throw new Error(error?.message ?? 'Failed to create expense.');
      await syncExpenseToCalendar(inserted as Expense, user!.id);
      return inserted as Expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateExpenseData = Partial<CreateExpenseData>;

export function useUpdateExpense() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateExpenseData }) => {
      // Fetch existing to detect recurrence changes
      const { data: existing, error: fetchError } = await supabase
        .from('expenses')
        .select('recurrence_rule')
        .eq('id', id)
        .eq('user_id', user!.id)
        .single();
      if (fetchError || !existing) throw new Error('Expense not found.');

      const { data: updated, error } = await supabase
        .from('expenses')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user!.id)
        .select()
        .single();
      if (error || !updated) throw new Error(error?.message ?? 'Update failed.');

      const updatedExpense = updated as Expense;
      const hadRecurrence = existing.recurrence_rule !== null;
      const hasRecurrence = updatedExpense.recurrence_rule !== null;

      if (hasRecurrence) {
        await syncExpenseToCalendar(updatedExpense, user!.id);
      } else if (hadRecurrence && !hasRecurrence) {
        await removeExpenseFromCalendar(id);
      }
      return updatedExpense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Create one-time occurrence from a recurring expense (does NOT mutate the template)
// ---------------------------------------------------------------------------

export function useCreateOccurrence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourceExpenseId,
      overrides,
    }: {
      sourceExpenseId: string;
      overrides: CreateExpenseData;
    }) => {
      // Verify source exists and belongs to user (and is recurring)
      const { data: source, error: fetchErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', sourceExpenseId)
        .eq('user_id', user!.id)
        .single();
      if (fetchErr || !source) throw new Error('Source recurring expense not found.');

      // Insert one-time copy with forced recurrence_rule: null
      const { data: inserted, error } = await supabase
        .from('expenses')
        .insert({
          user_id: user!.id,
          title: overrides.title.trim(),
          merchant_payee: overrides.merchant_payee?.trim() || null,
          amount: overrides.amount,
          expense_date: overrides.expense_date,
          category: overrides.category,
          payment_method: overrides.payment_method?.trim() || null,
          note: overrides.note?.trim() || null,
          linked_project_id: overrides.linked_project_id ?? null,
          linked_contact_id: overrides.linked_contact_id ?? null,
          linked_year_entry_id: overrides.linked_year_entry_id ?? null,
          recurrence_rule: null, // HARD-SET: one-time only
        })
        .select()
        .single();
      if (error || !inserted) throw new Error(error?.message ?? 'Failed to create occurrence.');
      // No calendar sync — this is a one-time expense, not recurring
      return inserted as Expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export function useDeleteExpense() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // CalendarEvent auto-cascades via linked_expense_id FK
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}
