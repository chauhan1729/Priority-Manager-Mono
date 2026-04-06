import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, positiveMinutesSchema, uuidSchema } from "./common";

export const scheduleSourceTypeSchema = z.enum(["activity", "meeting", "appointment", "other"]);
export const scheduleInstanceStatusSchema = z.enum([
  "upcoming",
  "working",
  "completed",
  "postponed",
  "missed",
]);

export const scheduleInstanceSchema = z
  .object({
    id: uuidSchema,
    user_id: uuidSchema,
    source_type: scheduleSourceTypeSchema,
    source_activity_id: uuidSchema.nullable(),
    source_meeting_id: uuidSchema.nullable(),
    source_event_id: uuidSchema.nullable(),
    schedule_date: isoDateSchema,
    start_at: isoDatetimeSchema,
    end_at: isoDatetimeSchema,
    locked_minutes: positiveMinutesSchema,
    focus_minutes: positiveMinutesSchema.nullable(),
    status_snapshot: scheduleInstanceStatusSchema.nullable(),
    keep_as_history: z.boolean().default(true),
    created_at: isoDatetimeSchema,
    updated_at: isoDatetimeSchema,
  })
  .superRefine((data, ctx) => {
    // Time order
    if (data.start_at >= data.end_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "start_at must be before end_at",
        path: ["end_at"],
      });
    }
    // focus <= locked
    if (data.focus_minutes !== null && data.focus_minutes > data.locked_minutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "focus_minutes cannot exceed locked_minutes",
        path: ["focus_minutes"],
      });
    }
    // Exactly one source FK based on source_type
    if (data.source_type === "activity" && !data.source_activity_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "source_activity_id required when source_type = activity",
        path: ["source_activity_id"],
      });
    }
    if (data.source_type === "meeting" && !data.source_meeting_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "source_meeting_id required when source_type = meeting",
        path: ["source_meeting_id"],
      });
    }
    if (["appointment", "other"].includes(data.source_type) && !data.source_event_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "source_event_id required when source_type = appointment or other",
        path: ["source_event_id"],
      });
    }
  });

export const insertScheduleInstanceSchema = scheduleInstanceSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateScheduleInstanceSchema = z.object({
  status_snapshot: scheduleInstanceStatusSchema.optional(),
  focus_minutes: positiveMinutesSchema.nullable().optional(),
  keep_as_history: z.boolean().optional(),
  // Allow rescheduling (future instances only)
  start_at: isoDatetimeSchema.optional(),
  end_at: isoDatetimeSchema.optional(),
  locked_minutes: positiveMinutesSchema.optional(),
  schedule_date: isoDateSchema.optional(),
});

export type ScheduleInstance = z.infer<typeof scheduleInstanceSchema>;
export type InsertScheduleInstance = z.infer<typeof insertScheduleInstanceSchema>;
export type UpdateScheduleInstance = z.infer<typeof updateScheduleInstanceSchema>;
