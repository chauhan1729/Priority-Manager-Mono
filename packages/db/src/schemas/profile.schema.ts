import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, timeSchema, uuidSchema } from "./common";

export const profileSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  email: z.string().email(),
  auth_provider: z.enum(["email", "google", "apple"]),
  timezone: z.string().min(1),
  eod_review_time: timeSchema.nullable(),
  last_weekly_review_date: isoDateSchema.nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertProfileSchema = profileSchema
  .omit({ created_at: true, updated_at: true })
  .extend({
    name: z.string().default(""),
    auth_provider: z.enum(["email", "google", "apple"]).default("email"),
    timezone: z.string().default("UTC"),
    eod_review_time: timeSchema.nullable().default(null),
    last_weekly_review_date: isoDateSchema.nullable().default(null),
  });

export const updateProfileSchema = insertProfileSchema
  .omit({ id: true })
  .partial();

export type Profile = z.infer<typeof profileSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
