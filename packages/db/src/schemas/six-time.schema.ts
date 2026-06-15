import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, timeSchema, uuidSchema } from "./common";

// Brevity is the point — keep entries short & sweet.
const shortText = z.string().max(140);

// --- Problem ---------------------------------------------------------------
export const sixTimeProblemStatusSchema = z.enum(["active", "retired"]);

export const sixTimeProblemSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  position: z.number().int().min(1).max(3),
  problem: z.string().min(1).max(120),
  solution: z.string().min(1).max(120),
  reminder_phrase: z.string().min(1).max(120),
  status: sixTimeProblemStatusSchema.default("active"),
  created_at: isoDatetimeSchema,
  retired_at: isoDatetimeSchema.nullable(),
  updated_at: isoDatetimeSchema,
});
export const insertSixTimeProblemSchema = sixTimeProblemSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// --- Entry -----------------------------------------------------------------
export const sixTimeEntrySchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  entry_date: isoDateSchema,
  slot_index: z.number().int().min(1).max(6),
  problem_id: uuidSchema,
  plus: shortText.nullable(),
  minus: shortText.nullable(),
  todo: shortText.nullable(),
  logged_at: isoDatetimeSchema.nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});
export const insertSixTimeEntrySchema = sixTimeEntrySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const updateSixTimeEntrySchema = z.object({
  plus: shortText.nullable().optional(),
  minus: shortText.nullable().optional(),
  todo: shortText.nullable().optional(),
  logged_at: isoDatetimeSchema.nullable().optional(),
});

// --- Nightly review --------------------------------------------------------
export const sixTimeNightlyReviewSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  review_date: isoDateSchema,
  best: z.array(shortText).max(3),
  worst: z.array(shortText).max(3),
  logged_at: isoDatetimeSchema.nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});
export const insertSixTimeNightlyReviewSchema = sixTimeNightlyReviewSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// --- Config ----------------------------------------------------------------
export const sixTimeConfigSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  enabled: z.boolean().default(true),
  slot_times: z.array(timeSchema).length(6),
  nightly_time: timeSchema,
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});
export const updateSixTimeConfigSchema = z.object({
  enabled: z.boolean().optional(),
  slot_times: z.array(timeSchema).length(6).optional(),
  nightly_time: timeSchema.optional(),
});

export type SixTimeProblem = z.infer<typeof sixTimeProblemSchema>;
export type SixTimeEntry = z.infer<typeof sixTimeEntrySchema>;
export type SixTimeNightlyReview = z.infer<typeof sixTimeNightlyReviewSchema>;
export type SixTimeConfig = z.infer<typeof sixTimeConfigSchema>;
