import { z } from "zod";

import { isoDateSchema, isoDatetimeSchema, uuidSchema } from "./common";

export const projectStatusSchema = z.enum([
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
]);

export const milestoneStatusSchema = z.enum(["pending", "completed", "missed"]);

export const resourceTypeSchema = z.enum([
  "budget",
  "employee",
  "contractor",
  "new_hire",
  "tool_software",
  "equipment",
  "other",
]);

export const resourceStatusSchema = z.enum([
  "needed",
  "requested",
  "approved",
  "acquired",
  "delayed",
  "cancelled",
]);

export const projectSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
  status: projectStatusSchema.default("planned"),
  start_date: isoDateSchema.nullable(),
  target_end_date: isoDateSchema.nullable(),
  linked_annual_goal_id: uuidSchema.nullable(),
  linked_monthly_priority_id: uuidSchema.nullable(),
  notes: z.string().nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertProjectSchema = projectSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateProjectSchema = insertProjectSchema
  .omit({ user_id: true })
  .partial();

export const projectMilestoneSchema = z.object({
  id: uuidSchema,
  project_id: uuidSchema,
  title: z.string().min(1).max(200),
  target_date: isoDateSchema.nullable(),
  status: milestoneStatusSchema.default("pending"),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertProjectMilestoneSchema = projectMilestoneSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateProjectMilestoneSchema = insertProjectMilestoneSchema
  .omit({ project_id: true })
  .partial();

export const projectResourceSchema = z.object({
  id: uuidSchema,
  project_id: uuidSchema,
  resource_type: resourceTypeSchema,
  title: z.string().min(1).max(200),
  note: z.string().nullable(),
  estimated_cost: z.number().min(0).nullable(),
  status: resourceStatusSchema.default("needed"),
  assigned_contact_id: uuidSchema.nullable(),
  needed_by_date: isoDateSchema.nullable(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema,
});

export const insertProjectResourceSchema = projectResourceSchema
  .omit({ id: true, created_at: true, updated_at: true });

export const updateProjectResourceSchema = insertProjectResourceSchema
  .omit({ project_id: true })
  .partial();

export type Project = z.infer<typeof projectSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ProjectMilestone = z.infer<typeof projectMilestoneSchema>;
export type InsertProjectMilestone = z.infer<typeof insertProjectMilestoneSchema>;
export type UpdateProjectMilestone = z.infer<typeof updateProjectMilestoneSchema>;
export type ProjectResource = z.infer<typeof projectResourceSchema>;
export type InsertProjectResource = z.infer<typeof insertProjectResourceSchema>;
export type UpdateProjectResource = z.infer<typeof updateProjectResourceSchema>;
