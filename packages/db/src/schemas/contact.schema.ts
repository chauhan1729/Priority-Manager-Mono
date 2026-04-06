import { z } from "zod";

import { isoDatetimeSchema, uuidSchema } from "./common";

export const contactCategorySchema = z.enum([
  "personal",
  "professional",
  "family",
  "client",
  "vendor",
  "other",
]);

export const contactSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  category: contactCategorySchema,
  full_name: z.string().min(1).max(200),
  company: z.string().nullable(),
  role: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  note: z.string().nullable(),
  is_deleted: z.boolean().default(false),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertContactSchema = contactSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({ category: contactCategorySchema.default("other") });

export const updateContactSchema = insertContactSchema
  .omit({ user_id: true })
  .partial();

export type Contact = z.infer<typeof contactSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
