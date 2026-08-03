import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, uuidSchema } from "./common";

export const karmicPartnerGroupSchema = z.enum([
  "coworkers",
  "customers",
  "suppliers",
  "world",
]);

export const karmicPartnerStatusSchema = z.enum(["active", "retired"]);

// --- Partner (who + success vision) -----------------------------------------
export const karmicPartnerSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  partner_group: karmicPartnerGroupSchema,
  name: z.string().max(120).nullable(),
  success_vision: z.string().max(500).nullable(),
  status: karmicPartnerStatusSchema.default("active"),
  sort_order: z.number().int().min(0).default(0),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertKarmicPartnerSchema = z.object({
  partner_group: karmicPartnerGroupSchema,
  name: z.string().max(120).nullable(),
  success_vision: z.string().max(500).nullable(),
});

// --- Daily action ----------------------------------------------------------
export const karmicPartnerActionSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  partner_id: uuidSchema,
  partner_group: karmicPartnerGroupSchema,
  action_date: isoDateSchema,
  text: z.string().min(1).max(300),
  done: z.boolean().default(false),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertKarmicPartnerActionSchema = z.object({
  partner_id: uuidSchema,
  partner_group: karmicPartnerGroupSchema,
  action_date: isoDateSchema,
  text: z.string().min(1).max(300),
});

// --- Ethics principle ------------------------------------------------------
export const karmicEthicsPrincipleSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  label: z.string().min(1).max(300),
  sort_order: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

// --- Ethics nightly check-in -----------------------------------------------
export const karmicEthicsCheckinSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  checkin_date: isoDateSchema,
  principle_id: uuidSchema,
  kept: z.boolean(),
  note: z.string().max(300).nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const upsertKarmicEthicsCheckinSchema = z.object({
  checkin_date: isoDateSchema,
  principle_id: uuidSchema,
  kept: z.boolean(),
  note: z.string().max(300).nullable(),
});

export type KarmicPartnerRow = z.infer<typeof karmicPartnerSchema>;
export type InsertKarmicPartner = z.infer<typeof insertKarmicPartnerSchema>;
export type KarmicPartnerActionRow = z.infer<typeof karmicPartnerActionSchema>;
export type InsertKarmicPartnerAction = z.infer<typeof insertKarmicPartnerActionSchema>;
export type KarmicEthicsPrincipleRow = z.infer<typeof karmicEthicsPrincipleSchema>;
export type KarmicEthicsCheckinRow = z.infer<typeof karmicEthicsCheckinSchema>;
export type UpsertKarmicEthicsCheckin = z.infer<typeof upsertKarmicEthicsCheckinSchema>;
