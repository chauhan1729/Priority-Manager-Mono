import { z } from "zod";

export const expenseBudgetSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amount: z.number().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const expenseBudgetUpsertSchema = expenseBudgetSchema
  .omit({ id: true, created_at: true, updated_at: true });

export type ExpenseBudgetInput = z.infer<typeof expenseBudgetUpsertSchema>;
