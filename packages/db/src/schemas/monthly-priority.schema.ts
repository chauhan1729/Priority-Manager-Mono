import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, monthKeySchema, uuidSchema } from "./common";

export const monthlyPrioritySectionSchema = z.enum(["business_career", "personal"]);
export const monthlyPriorityStatusSchema = z.enum([
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "dropped",
]);
export const progressModeSchema = z.enum(["manual", "auto_project"]);

const monthlyPriorityBaseSchema = z
  .object({
    id: uuidSchema,
    user_id: uuidSchema,
    section: monthlyPrioritySectionSchema,
    title: z.string().min(1).max(200),
    category: z.string().nullable(),
    started_date: isoDateSchema.nullable(),
    assigned_date: isoDateSchema.nullable(),
    target_date: isoDateSchema.nullable(),
    linked_annual_goal_id: uuidSchema.nullable(),
    linked_project_id: uuidSchema.nullable(),
    progress_mode: progressModeSchema.default("manual"),
    manual_progress_percent: z.number().int().min(0).max(100).nullable(),
    status: monthlyPriorityStatusSchema.default("planned"),
    note: z.string().nullable(),
    pinned: z.boolean().default(false),
    month_key: monthKeySchema,
    created_at: isoDatetimeSchema,
    updated_at: isoDatetimeSchema,
  });

export const monthlyPrioritySchema = monthlyPriorityBaseSchema
  .superRefine((data, ctx) => {
    // auto_project mode requires a linked project
    if (data.progress_mode === "auto_project" && !data.linked_project_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "auto_project progress mode requires a linked_project_id",
        path: ["linked_project_id"],
      });
    }
  });

export const insertMonthlyPrioritySchema = monthlyPriorityBaseSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateMonthlyPrioritySchema = insertMonthlyPrioritySchema
  .omit({ user_id: true })
  .partial()
  .superRefine((data, ctx) => {
    if (data.progress_mode === "auto_project" && data.linked_project_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "auto_project progress mode requires a linked_project_id",
        path: ["linked_project_id"],
      });
    }
  });

export type MonthlyPriority = z.infer<typeof monthlyPrioritySchema>;
export type InsertMonthlyPriority = z.infer<typeof insertMonthlyPrioritySchema>;
export type UpdateMonthlyPriority = z.infer<typeof updateMonthlyPrioritySchema>;
