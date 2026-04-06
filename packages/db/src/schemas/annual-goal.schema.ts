import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, uuidSchema } from "./common";

export const annualGoalSectionSchema = z.enum(["business", "career", "personal"]);
export const annualGoalStatusSchema = z.enum([
  "not_started",
  "active",
  "on_track",
  "at_risk",
  "completed",
  "dropped",
]);

export const annualGoalSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  section: annualGoalSectionSchema,
  title: z.string().min(1).max(200),
  description: z.string().default(""),
  why_it_matters: z.string().default(""),
  target_date: isoDateSchema.nullable(),
  progress_percent: z.number().int().min(0).max(100).default(0),
  status: annualGoalStatusSchema.default("not_started"),
  notes: z.string().nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertAnnualGoalSchema = annualGoalSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateAnnualGoalSchema = insertAnnualGoalSchema
  .omit({ user_id: true })
  .partial();

export type AnnualGoal = z.infer<typeof annualGoalSchema>;
export type InsertAnnualGoal = z.infer<typeof insertAnnualGoalSchema>;
export type UpdateAnnualGoal = z.infer<typeof updateAnnualGoalSchema>;
