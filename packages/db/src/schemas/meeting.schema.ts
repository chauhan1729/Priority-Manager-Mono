import { z } from "zod";

import {
  isoDateSchema,
  isoDatetimeSchema,
  positiveMinutesSchema,
  recurrenceRuleSchema,
  uuidSchema,
} from "./common";

export const meetingStatusSchema = z.enum(["upcoming", "completed", "missed", "cancelled"]);

const meetingBaseSchema = z
  .object({
    id: uuidSchema,
    user_id: uuidSchema,
    linked_contact_id: uuidSchema,
    linked_calendar_event_id: uuidSchema.nullable(),
    title: z.string().min(1).max(200),
    date: isoDateSchema,
    start_at: isoDatetimeSchema,
    end_at: isoDatetimeSchema,
    duration_minutes: positiveMinutesSchema,
    agenda: z.string().default(""),
    key_takeaways: z.string().nullable(),
    recurrence_rule: recurrenceRuleSchema,
    status: meetingStatusSchema.default("upcoming"),
    created_at: isoDatetimeSchema,
    updated_at: isoDatetimeSchema,
  });

export const meetingSchema = meetingBaseSchema
  .superRefine((data, ctx) => {
    if (data.start_at >= data.end_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "start_at must be before end_at",
        path: ["end_at"],
      });
    }
  });

export const insertMeetingSchema = meetingBaseSchema
  .omit({ id: true, created_at: true, updated_at: true });

/**
 * Spec §12.3: For past meetings only key_takeaways is editable.
 * This schema is used when the meeting's end_at is in the past.
 */
export const updatePastMeetingSchema = z.object({
  key_takeaways: z.string().nullable(),
  status: meetingStatusSchema.optional(),
});

/** Full update — only valid for future meetings. */
export const updateMeetingSchema = insertMeetingSchema
  .omit({ user_id: true })
  .partial()
  .superRefine((data, ctx) => {
    if (data.start_at && data.end_at && data.start_at >= data.end_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "start_at must be before end_at",
        path: ["end_at"],
      });
    }
  });

export type Meeting = z.infer<typeof meetingSchema>;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type UpdateMeeting = z.infer<typeof updateMeetingSchema>;
export type UpdatePastMeeting = z.infer<typeof updatePastMeetingSchema>;
