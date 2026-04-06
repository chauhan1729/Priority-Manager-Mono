import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, recurrenceRuleSchema, uuidSchema } from "./common";

export const expenseCategorySchema = z.enum([
  "personal",
  "business",
  "travel",
  "food",
  "transport",
  "subscriptions",
  "household",
  "other",
]);

export const expenseSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  title: z.string().min(1).max(200),
  merchant_payee: z.string().nullable(),
  amount: z.number().min(0),
  expense_date: isoDateSchema,
  category: expenseCategorySchema.default("other"),
  payment_method: z.string().nullable(),
  note: z.string().nullable(),
  linked_project_id: uuidSchema.nullable(),
  linked_contact_id: uuidSchema.nullable(),
  linked_year_entry_id: uuidSchema.nullable(),
  recurrence_rule: recurrenceRuleSchema,
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertExpenseSchema = expenseSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateExpenseSchema = insertExpenseSchema
  .omit({ user_id: true })
  .partial();

export type Expense = z.infer<typeof expenseSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type UpdateExpense = z.infer<typeof updateExpenseSchema>;
