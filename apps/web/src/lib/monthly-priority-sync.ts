import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Keep the bidirectional monthly-priority ↔ project link consistent.
 *
 * Model:
 *  - `monthly_priorities.linked_project_id` — the project a priority is about.
 *    Multiple priorities across DIFFERENT months may reference the same project
 *    (that's carry-forward / history).
 *  - `projects.linked_monthly_priority_id` — the project's CURRENT owning priority
 *    (single-valued; last writer wins).
 *
 * Invariants enforced here when a priority takes a project:
 *  1. If this priority previously pointed at another project, that project releases
 *     its reverse pointer.
 *  2. Same-month exclusivity: no other priority in the same month may own the project
 *     (a released priority reverts to manual progress, since auto needs a project).
 *  3. The project's reverse pointer is set to this priority (its current owner).
 *
 * Cross-month references are intentionally preserved (past months keep their link;
 * the project's reverse pointer simply tracks the most recent owner).
 *
 * @param oldProjectId The project this priority pointed at before this change (or null).
 * @param newProjectId The project this priority points at now (null = just release).
 */
export async function linkPriorityAndProject(
  supabase: ServerClient,
  userId: string,
  priorityId: string,
  monthKey: string,
  newProjectId: string | null,
  oldProjectId: string | null,
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Priority switched away from a project → clear that project's reverse pointer.
  if (oldProjectId && oldProjectId !== newProjectId) {
    await supabase
      .from("projects")
      .update({ linked_monthly_priority_id: null, updated_at: now })
      .eq("id", oldProjectId)
      .eq("linked_monthly_priority_id", priorityId)
      .eq("user_id", userId);
  }

  if (!newProjectId) return;

  // 2. Same-month exclusivity: any other priority this month referencing the project releases it.
  await supabase
    .from("monthly_priorities")
    .update({ linked_project_id: null, progress_mode: "manual", updated_at: now })
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .eq("linked_project_id", newProjectId)
    .neq("id", priorityId);

  // 3. Point the project at this priority (its current owner).
  await supabase
    .from("projects")
    .update({ linked_monthly_priority_id: priorityId, updated_at: now })
    .eq("id", newProjectId)
    .eq("user_id", userId);
}
