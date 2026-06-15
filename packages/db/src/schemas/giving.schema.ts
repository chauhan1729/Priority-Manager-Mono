import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, uuidSchema } from "./common";

export const givingModeSchema = z.enum(["challenge", "continuous"]);
export const givingStatusSchema = z.enum(["active", "completed", "abandoned"]);
export const givingCategorySchema = z.enum(["words", "thoughts", "deeds", "things_money"]);
export const givingKindSchema = z.enum(["given", "received", "cognition"]);

export const givingChallengeSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  start_date: isoDateSchema,
  mode: givingModeSchema.default("challenge"),
  status: givingStatusSchema.default("active"),
  reviewed_at: isoDatetimeSchema.nullable(),
  continue_decision: z.boolean().nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});
export const insertGivingChallengeSchema = givingChallengeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const updateGivingChallengeSchema = z.object({
  mode: givingModeSchema.optional(),
  status: givingStatusSchema.optional(),
  reviewed_at: isoDatetimeSchema.nullable().optional(),
  continue_decision: z.boolean().nullable().optional(),
});

export const givingLogSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  challenge_id: uuidSchema,
  entry_date: isoDateSchema,
  kind: givingKindSchema,
  content: z.string().min(1).max(200),
  categories: z.array(givingCategorySchema),
  given_in_secret: z.boolean().default(false),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});
export const insertGivingLogSchema = givingLogSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type GivingChallenge = z.infer<typeof givingChallengeSchema>;
export type GivingLog = z.infer<typeof givingLogSchema>;
