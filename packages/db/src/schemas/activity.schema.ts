import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, nonNegativeMinutesSchema, uuidSchema } from "./common";

export const activitySectionSchema = z.enum(["work", "outside", "delegated", "unplanned"]);
// Phase 0A: priority is mandatory (every activity is an A or a B — "everything is a B").
// Reads stay tolerant of legacy null (kept in the shared TS union for mobile compile-compat), but the
// canonical A/B value defaults to B and the DB enforces NOT NULL.
export const activityPrioritySchema = z.enum(["A", "B"]).nullable();
export const activityPriorityRequiredSchema = z.enum(["A", "B"]);
export const activityStatusSchema = z.enum([
  "not_started",
  "working",
  "completed",
  "postponed",
  "delegated",
  "cancelled",
]);
export const activityOriginTypeSchema = z.enum(["manual", "project", "carry_forward"]);

const activityBaseSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  section_type: activitySectionSchema,
  title: z.string().min(1).max(300),
  priority: activityPrioritySchema.default("B"),
  activity_date: isoDateSchema,
  estimated_minutes: nonNegativeMinutesSchema.default(0),
  remaining_minutes: nonNegativeMinutesSchema.default(0),
  status: activityStatusSchema.default("not_started"),
  linked_project_id: uuidSchema.nullable(),
  delegated_contact_id: uuidSchema.nullable(),
  note: z.string().nullable(),
  origin_type: activityOriginTypeSchema.nullable().default(null),
  moved_from_date: isoDateSchema.nullable(),
  is_someday: z.boolean().default(false),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const activitySchema = activityBaseSchema
  .superRefine((data, ctx) => {
    // remaining <= estimated
    if (data.remaining_minutes > data.estimated_minutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "remaining_minutes cannot exceed estimated_minutes",
        path: ["remaining_minutes"],
      });
    }
    // Work activities must have a linked project (spec §10.5).
    // Phase 1B: someday items are parked / not yet committed, so they're exempt until pulled
    // into the horizon (at which point the rule re-applies).
    if (data.section_type === "work" && !data.is_someday && !data.linked_project_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Work activities require a linked_project_id",
        path: ["linked_project_id"],
      });
    }
    // Delegated activities must have a contact
    if (data.section_type === "delegated" && !data.delegated_contact_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delegated activities require a delegated_contact_id",
        path: ["delegated_contact_id"],
      });
    }
  });

export const insertActivitySchema = activityBaseSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateActivitySchema = insertActivitySchema
  .omit({ user_id: true })
  .partial()
  .superRefine((data, ctx) => {
    if (
      data.remaining_minutes !== undefined &&
      data.estimated_minutes !== undefined &&
      data.remaining_minutes > data.estimated_minutes
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "remaining_minutes cannot exceed estimated_minutes",
        path: ["remaining_minutes"],
      });
    }
  });

export type Activity = z.infer<typeof activitySchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type UpdateActivity = z.infer<typeof updateActivitySchema>;
