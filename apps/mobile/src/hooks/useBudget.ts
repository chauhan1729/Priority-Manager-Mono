import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Per-month expense budget (one row per user + "YYYY-MM")
// ---------------------------------------------------------------------------

export const budgetKeys = {
  all: ['expenseBudgets'] as const,
  forMonth: (monthKey: string) => ['expenseBudgets', 'month', monthKey] as const,
};

/** Returns the budget amount for the month, or null when none is set. */
export function useMonthlyBudget(monthKey: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: budgetKeys.forMonth(monthKey),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_budgets')
        .select('amount')
        .eq('user_id', user!.id)
        .eq('month', monthKey)
        .maybeSingle();
      if (error) throw error;
      return data ? Number(data.amount) : null;
    },
    enabled: !!user && !!monthKey,
  });
}

export function useSetMonthlyBudget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ monthKey, amount }: { monthKey: string; amount: number }) => {
      const { error } = await supabase.from('expense_budgets').upsert(
        {
          user_id: user!.id,
          month: monthKey,
          amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,month' },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useClearMonthlyBudget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (monthKey: string) => {
      const { error } = await supabase
        .from('expense_budgets')
        .delete()
        .eq('user_id', user!.id)
        .eq('month', monthKey);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
