import { z } from "zod";

import {
  isoDateSchema,
  isoDatetimeSchema,
  positiveMinutesSchema,
  recurrenceRuleSchema,
  uuidSchema,
} from "./common";

export const calendarEventTypeSchema = z.enum([
  "meeting",
  "appointment",
  "birthday",
  "renewal",
  "other",
]);
export const calendarEventStatusSchema = z.enum(["upcoming", "completed", "cancelled", "missed"]);
export const calendarEventSourceTypeSchema = z.enum([
  "calendar",
  "meeting_planner",
  "year_entry",
  "expense_recurring",
]);

const calendarEventBaseSchema = z
  .object({
    id: uuidSchema,
    user_id: uuidSchema,
    event_type: calendarEventTypeSchema,
    title: z.string().min(1).max(200),
    date: isoDateSchema,
    start_at: isoDatetimeSchema.nullable(),
    end_at: isoDatetimeSchema.nullable(),
    duration_minutes: positiveMinutesSchema.nullable(),
    linked_contact_id: uuidSchema.nullable(),
    linked_project_id: uuidSchema.nullable(),
    linked_meeting_id: uuidSchema.nullable(),
    linked_year_entry_id: uuidSchema.nullable(),
    location: z.string().nullable(),
    notes: z.string().nullable(),
    recurrence_rule: recurrenceRuleSchema,
    status: calendarEventStatusSchema.default("upcoming"),
    source_type: calendarEventSourceTypeSchema.default("calendar"),
    created_at: isoDatetimeSchema,
    updated_at: isoDatetimeSchema,
  });

export const calendarEventSchema = calendarEventBaseSchema
  .superRefine((data, ctx) => {
    // start before end when both provided
    if (data.start_at && data.end_at && data.start_at >= data.end_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "start_at must be before end_at",
        path: ["end_at"],
      });
    }
    // Birthday events must come from year_entry source
    if (data.event_type === "birthday" && data.source_type !== "year_entry") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Birthday events must have source_type = year_entry to prevent duplicates",
        path: ["source_type"],
      });
    }
    // Birthday events must link to a year_entry
    if (data.event_type === "birthday" && !data.linked_year_entry_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Birthday events must link to a year_entry record",
        path: ["linked_year_entry_id"],
      });
    }
    // Meeting events must link to a meeting record
    if (data.event_type === "meeting" && !data.linked_meeting_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Meeting calendar events must link to a meeting record",
        path: ["linked_meeting_id"],
      });
    }
  });

export const insertCalendarEventSchema = calendarEventBaseSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateCalendarEventSchema = insertCalendarEventSchema
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

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type UpdateCalendarEvent = z.infer<typeof updateCalendarEventSchema>;
