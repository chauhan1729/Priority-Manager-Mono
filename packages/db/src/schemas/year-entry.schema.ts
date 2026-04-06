import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, uuidSchema } from "./common";

export const yearEntryTypeSchema = z.enum(["travel", "away", "birthday"]);
export const availabilityStatusSchema = z.enum(["available", "away", "partial"]);

export const yearEntrySchema = z
  .object({
    id: uuidSchema,
    user_id: uuidSchema,
    type: yearEntryTypeSchema,
    title: z.string().min(1).max(200),
    start_date: isoDateSchema,
    end_date: isoDateSchema.nullable(),
    location: z.string().nullable(),
    note: z.string().nullable(),
    availability_status: availabilityStatusSchema.nullable(),
    create_linked_trip_plan: z.boolean().default(false),
    linked_project_id: uuidSchema.nullable(),
    created_at: isoDatetimeSchema,
    updated_at: isoDatetimeSchema,
  })
  .superRefine((data, ctx) => {
    // Spec §10.1: birthday entries are single-day only
    if (data.type === "birthday" && data.end_date !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Birthday entries cannot have an end_date",
        path: ["end_date"],
      });
    }
    // Travel/away must have availability_status
    if (data.type !== "birthday" && data.availability_status === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Travel and away entries require an availability_status",
        path: ["availability_status"],
      });
    }
    // end_date must be >= start_date if provided
    if (data.end_date && data.end_date < data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "end_date must be on or after start_date",
        path: ["end_date"],
      });
    }
  });

export const insertYearEntrySchema = yearEntrySchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateYearEntrySchema = insertYearEntrySchema
  .omit({ user_id: true })
  .partial()
  // Re-apply cross-field rules after partial
  .superRefine((data, ctx) => {
    if (data.type === "birthday" && data.end_date !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Birthday entries cannot have an end_date",
        path: ["end_date"],
      });
    }
  });

export type YearEntry = z.infer<typeof yearEntrySchema>;
export type InsertYearEntry = z.infer<typeof insertYearEntrySchema>;
export type UpdateYearEntry = z.infer<typeof updateYearEntrySchema>;
