export { createSupabaseClient } from "./client";
export type { SupabaseClient } from "./client";
export type { Database } from "./database.types";
export * from "./database.types";
export * from "./schemas";

// Both "./database.types" and "./schemas" export these Insert* type names.
// Re-export them explicitly from the canonical "./database.types" source to
// resolve the wildcard ambiguity (TS2308). Apps depend on the database.types
// versions; the schema-derived Insert* types remain reachable via the
// per-schema modules directly.
export type {
  InsertActivity,
  InsertAnnualGoal,
  InsertCalendarEvent,
  InsertContact,
  InsertExpense,
  InsertMeeting,
  InsertMonthlyPriority,
  InsertProfile,
  InsertProject,
  InsertProjectMilestone,
  InsertProjectResource,
  InsertReminderInstance,
  InsertScheduleInstance,
  InsertYearEntry,
} from "./database.types";
