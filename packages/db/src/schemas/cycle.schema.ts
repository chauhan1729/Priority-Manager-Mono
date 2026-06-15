import { z } from "zod";

import { isoDatetimeSchema, nonNegativeMinutesSchema, positiveMinutesSchema, uuidSchema } from "./common";

export const cyclePhaseSchema = z.enum(["focus", "break", "completed", "abandoned"]);

const cycleBaseSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  activity_id: uuidSchema,
  schedule_instance_id: uuidSchema.nullable(),
  soft_target_minutes: positiveMinutesSchema.nullable(),
  elapsed_focus_minutes: nonNegativeMinutesSchema.default(0),
  segment_started_at: isoDatetimeSchema.nullable(),
  break_count: nonNegativeMinutesSchema.default(0),
  phase: cyclePhaseSchema.default("focus"),
  started_at: isoDatetimeSchema,
  completed_at: isoDatetimeSchema.nullable(),
  note: z.string().max(280).nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const cycleSchema = cycleBaseSchema.superRefine((data, ctx) => {
  // completed_at is set iff the cycle is completed.
  if (data.phase === "completed" && !data.completed_at) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "completed_at is required when phase = completed",
      path: ["completed_at"],
    });
  }
  // A focus segment must have an anchor; non-focus phases must not.
  if (data.phase === "focus" && !data.segment_started_at) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "segment_started_at is required while phase = focus",
      path: ["segment_started_at"],
    });
  }
});

export const insertCycleSchema = cycleBaseSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateCycleSchema = z.object({
  schedule_instance_id: uuidSchema.nullable().optional(),
  soft_target_minutes: positiveMinutesSchema.nullable().optional(),
  elapsed_focus_minutes: nonNegativeMinutesSchema.optional(),
  segment_started_at: isoDatetimeSchema.nullable().optional(),
  break_count: nonNegativeMinutesSchema.optional(),
  phase: cyclePhaseSchema.optional(),
  completed_at: isoDatetimeSchema.nullable().optional(),
  note: z.string().max(280).nullable().optional(),
});

export type Cycle = z.infer<typeof cycleSchema>;
export type InsertCycle = z.infer<typeof insertCycleSchema>;
export type UpdateCycle = z.infer<typeof updateCycleSchema>;
