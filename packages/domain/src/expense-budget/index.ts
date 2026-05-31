export interface BudgetStatus {
  budget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  isOver: boolean;
  hasBudget: boolean;
}

// Pure computation of monthly budget status from a spent total and an
// optional budget limit. A null/zero/undefined budget means "no budget set".
// Raw percentUsed is returned (not clamped) so the UI can decide how to display it.
export function computeBudgetStatus(
  spent: number,
  budget: number | null | undefined
): BudgetStatus {
  const hasBudget = budget != null && budget > 0;
  const budgetValue = budget ?? 0;
  const remaining = budgetValue - spent; // can be negative when overspent
  const percentUsed = budgetValue > 0 ? (spent / budgetValue) * 100 : 0;
  const isOver = hasBudget && spent > budgetValue;

  return {
    budget: budgetValue,
    spent,
    remaining,
    percentUsed,
    isOver,
    hasBudget,
  };
}
