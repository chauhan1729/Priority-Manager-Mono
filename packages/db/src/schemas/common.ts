import { z } from "zod";

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

/** UUID v4 */
export const uuidSchema = z.string().uuid();

/** ISO date string YYYY-MM-DD */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

/** ISO datetime string (full ISO 8601) */
export const isoDatetimeSchema = z.string().datetime({ offset: true });

/** Month key YYYY-MM */
export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM");

/** Time string HH:MM */
export const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Must be HH:MM");

export const recurrenceRuleSchema = z.enum(["daily", "weekly", "monthly"]).nullable();

/** Positive integer minutes */
export const positiveMinutesSchema = z.number().int().positive();
export const nonNegativeMinutesSchema = z.number().int().min(0);
