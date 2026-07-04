import { z } from "zod";

import { isoDatetimeSchema, timeSchema, uuidSchema } from "./common";

export const reminderTypeSchema = z.enum([
  "eod_review",
  "meeting_upcoming",
  "meeting_passed",
  "renewal",
  "birthday",
  "travel",
  "morning_summary",
  "activity_starting",
  "activity_overdue",
  "event_upcoming",
  "weekly_someday_review",
  "meeting_prep",
  "six_time_daily",
  "six_time_nightly",
  "giving_daily",
]);

export const reminderPreferenceSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  eod_review_enabled: z.boolean().default(true),
  eod_review_time: timeSchema.default("21:00"),
  meeting_reminder_minutes_before: z.number().int().min(0).max(120).default(15),
  morning_summary_enabled: z.boolean().default(true),
  morning_summary_time: timeSchema.default("08:00"),
  birthday_reminder_days_before: z.number().int().min(0).max(30).default(1),
  travel_reminder_days_before: z.number().int().min(0).max(30).default(1),
  renewal_reminder_days_before: z.number().int().min(0).max(30).default(3),
  someday_review_enabled: z.boolean().default(true),
  someday_review_weekday: z.number().int().min(0).max(6).default(0),
  someday_review_time: timeSchema.default("09:00"),
  meeting_prep_enabled: z.boolean().default(true),
  meeting_prep_days_before: z.number().int().min(0).max(14).default(1),
  meeting_buffer_minutes: z.number().int().min(0).max(120).default(15),
  giving_reminder_enabled: z.boolean().default(true),
  giving_reminder_time: timeSchema.default("20:00"),
  currency_code: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const updateReminderPreferenceSchema = reminderPreferenceSchema
  .omit({ id: true, user_id: true, created_at: true, updated_at: true })
  .partial();

export const reminderInstanceSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  reminder_type: reminderTypeSchema,
  source_id: uuidSchema.nullable(),
  scheduled_for: isoDatetimeSchema,
  fired_at: isoDatetimeSchema.nullable(),
  dismissed_at: isoDatetimeSchema.nullable(),
  created_at: isoDatetimeSchema,
});

export const insertReminderInstanceSchema = reminderInstanceSchema
  .omit({ id: true, fired_at: true, dismissed_at: true, created_at: true });

export type ReminderPreference = z.infer<typeof reminderPreferenceSchema>;
export type UpdateReminderPreference = z.infer<typeof updateReminderPreferenceSchema>;
export type ReminderInstance = z.infer<typeof reminderInstanceSchema>;
export type InsertReminderInstance = z.infer<typeof insertReminderInstanceSchema>;
