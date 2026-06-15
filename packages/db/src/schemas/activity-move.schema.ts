import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, uuidSchema } from "./common";

const activityMoveBaseSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  activity_id: uuidSchema,
  from_date: isoDateSchema,
  to_date: isoDateSchema,
  reason: z.string().max(280).nullable(),
  moved_at: isoDatetimeSchema,
});

export const activityMoveSchema = activityMoveBaseSchema;

export const insertActivityMoveSchema = activityMoveBaseSchema.omit({ id: true });

export type ActivityMove = z.infer<typeof activityMoveSchema>;
export type InsertActivityMove = z.infer<typeof insertActivityMoveSchema>;
