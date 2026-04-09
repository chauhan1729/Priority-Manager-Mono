"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canCreateActivityOnDate } from "@pm/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true } | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Project name is required." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("projects").insert({
    user_id: user.id,
    name,
    description: (formData.get("description") as string) || null,
    status: (formData.get("status") as string) || "planned",
    start_date: (formData.get("start_date") as string) || null,
    target_end_date: (formData.get("target_end_date") as string) || null,
    notes: null,
  });

  if (error) return { error: error.message };

  revalidatePath("/project-planner");
  return { success: true };
}

export async function updateProject(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Project name is required." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      description: (formData.get("description") as string) || null,
      status: formData.get("status") as string,
      start_date: (formData.get("start_date") as string) || null,
      target_end_date: (formData.get("target_end_date") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/project-planner");
  revalidatePath(`/project-planner/${id}`);
  return { success: true };
}

/**
 * Spec §10.10: Delete flow — delete linked activities first (ON DELETE SET NULL
 * would break chk_work_needs_project for work activities), then delete project
 * (milestones + resources cascade automatically).
 */
export async function deleteProject(id: string): Promise<void> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Delete linked activities before the project (can't rely on ON DELETE SET NULL
  // because work activities require a project_id — would violate the DB constraint)
  await supabase
    .from("activities")
    .delete()
    .eq("linked_project_id", id)
    .eq("user_id", user.id);

  // Delete project (milestones and resources cascade)
  await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/project-planner");
  redirect("/project-planner");
}

// ---------------------------------------------------------------------------
// Activities within a project (shared activity model — spec §9)
// ---------------------------------------------------------------------------

export async function createProjectActivity(
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Activity title is required." };

  const activityDate = formData.get("activity_date") as string;
  if (!activityDate) return { error: "Date is required." };
  if (!canCreateActivityOnDate(activityDate)) {
    return { error: "Cannot create activities in the past." };
  }

  const estimatedHoursRaw = formData.get("estimated_hours") as string;
  const estimatedHours = parseFloat(estimatedHoursRaw);
  if (!estimatedHoursRaw || isNaN(estimatedHours) || estimatedHours <= 0) {
    return { error: "Estimated time must be a positive number." };
  }
  const estimatedMinutes = Math.round(estimatedHours * 60);

  const sectionType = (formData.get("section_type") as string) || "work";
  const priority = (formData.get("priority") as string) || null;
  const delegatedContactId = (formData.get("delegated_contact_id") as string) || null;
  const isDelegated = sectionType === "delegated";

  if (isDelegated && !delegatedContactId) {
    return { error: "Delegated activities require a contact. Select one from the list." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify delegated contact belongs to this user
  if (isDelegated && delegatedContactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", delegatedContactId)
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .single();
    if (!contact) return { error: "Contact not found." };
  }

  const recurrenceRaw = (formData.get("recurrence_rule") as string) || null;
  const validRecurrence = ["daily", "weekly", "monthly"] as const;
  type RecurrenceRule = typeof validRecurrence[number];
  const recurrenceRule: RecurrenceRule | null =
    recurrenceRaw && (validRecurrence as readonly string[]).includes(recurrenceRaw)
      ? (recurrenceRaw as RecurrenceRule)
      : null;

  const base = {
    user_id: user.id,
    title,
    section_type: sectionType,
    priority: priority || null,
    estimated_minutes: estimatedMinutes,
    remaining_minutes: estimatedMinutes,
    status: "not_started" as const,
    linked_project_id: projectId,
    delegated_contact_id: isDelegated ? delegatedContactId : null,
    note: (formData.get("note") as string) || null,
    origin_type: "project" as const,
    moved_from_date: null,
    recurrence_rule: recurrenceRule,
  };

  const { error } = await supabase.from("activities").insert({
    ...base,
    activity_date: activityDate,
  });

  if (error) return { error: error.message };

  // Create recurring sibling copies (next 3 occurrences)
  if (recurrenceRule) {
    const siblings = buildRecurringDates(activityDate, recurrenceRule, 3);
    for (const sibDate of siblings) {
      await supabase.from("activities").insert({ ...base, activity_date: sibDate });
    }
  }

  revalidatePath(`/project-planner/${projectId}`);
  revalidatePath("/activities");
  return { success: true };
}

function buildRecurringDates(
  startISO: string,
  rule: "daily" | "weekly" | "monthly",
  count: number,
): string[] {
  const dates: string[] = [];
  const [y, m, d] = startISO.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  for (let i = 1; i <= count; i++) {
    const next = new Date(base);
    if (rule === "daily") next.setDate(next.getDate() + i);
    else if (rule === "weekly") next.setDate(next.getDate() + i * 7);
    else if (rule === "monthly") next.setMonth(next.getMonth() + i);
    dates.push(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`,
    );
  }
  return dates;
}

export async function updateActivityStatus(
  activityId: string,
  projectId: string,
  status: string,
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();
  await supabase
    .from("activities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", activityId);
  revalidatePath(`/project-planner/${projectId}`);
  revalidatePath("/activities");
}

export async function deleteProjectActivity(
  activityId: string,
  projectId: string,
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();
  await supabase.from("activities").delete().eq("id", activityId);
  revalidatePath(`/project-planner/${projectId}`);
  revalidatePath("/activities");
}

/**
 * Bulk-create multiple activities for a project in one shot.
 * Accepts newline-separated titles; shares a common date, estimated time, and priority.
 */
export async function bulkCreateProjectActivities(
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const titlesRaw = (formData.get("titles") as string | null)?.trim();
  if (!titlesRaw) return { error: "At least one activity title is required." };

  const titles = titlesRaw
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (titles.length === 0) return { error: "No valid titles provided." };
  if (titles.length > 30) return { error: "Maximum 30 activities can be created at once." };

  const activityDate = formData.get("activity_date") as string;
  if (!activityDate) return { error: "Date is required." };
  if (!canCreateActivityOnDate(activityDate)) {
    return { error: "Cannot create activities in the past." };
  }

  const estimatedHoursRaw = formData.get("estimated_hours") as string;
  const estimatedHours = parseFloat(estimatedHoursRaw);
  if (!estimatedHoursRaw || isNaN(estimatedHours) || estimatedHours <= 0) {
    return { error: "Estimated time must be a positive number." };
  }
  const estimatedMinutes = Math.round(estimatedHours * 60);
  const priority = (formData.get("priority") as string) || null;

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const rows = titles.map((title) => ({
    user_id: user.id,
    title,
    section_type: "work" as const,
    priority: priority || null,
    activity_date: activityDate,
    estimated_minutes: estimatedMinutes,
    remaining_minutes: estimatedMinutes,
    status: "not_started" as const,
    linked_project_id: projectId,
    delegated_contact_id: null,
    note: null,
    origin_type: "project" as const,
    moved_from_date: null,
  }));

  const { error } = await supabase.from("activities").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/project-planner/${projectId}`);
  revalidatePath("/activities");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function createMilestone(
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Milestone title is required." };

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase.from("project_milestones").insert({
    project_id: projectId,
    title,
    target_date: (formData.get("target_date") as string) || null,
    status: "pending",
  });

  if (error) return { error: error.message };

  revalidatePath(`/project-planner/${projectId}`);
  return { success: true };
}

export async function updateMilestoneStatus(
  milestoneId: string,
  projectId: string,
  status: string,
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();
  await supabase
    .from("project_milestones")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", milestoneId);
  revalidatePath(`/project-planner/${projectId}`);
}

export async function updateMilestone(
  milestoneId: string,
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Milestone title is required." };

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("project_milestones")
    .update({
      title,
      target_date: (formData.get("target_date") as string) || null,
      status: (formData.get("status") as string) || "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", milestoneId);

  if (error) return { error: error.message };

  revalidatePath(`/project-planner/${projectId}`);
  return { success: true };
}

export async function deleteMilestone(
  milestoneId: string,
  projectId: string,
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();
  await supabase.from("project_milestones").delete().eq("id", milestoneId);
  revalidatePath(`/project-planner/${projectId}`);
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export async function createResource(
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Resource title is required." };

  const resourceType = (formData.get("resource_type") as string) || "";
  if (!resourceType) return { error: "Resource type is required." };

  const costRaw = formData.get("estimated_cost") as string;
  const estimatedCost = costRaw ? parseFloat(costRaw) : null;

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase.from("project_resources").insert({
    project_id: projectId,
    resource_type: resourceType,
    title,
    note: (formData.get("note") as string) || null,
    estimated_cost: estimatedCost,
    status: (formData.get("status") as string) || "needed",
    assigned_contact_id: null,
    needed_by_date: (formData.get("needed_by_date") as string) || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/project-planner/${projectId}`);
  return { success: true };
}

export async function updateResourceStatus(
  resourceId: string,
  projectId: string,
  status: string,
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();
  await supabase
    .from("project_resources")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", resourceId);
  revalidatePath(`/project-planner/${projectId}`);
}

export async function updateResource(
  resourceId: string,
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Resource title is required." };

  const resourceType = (formData.get("resource_type") as string) || "";
  if (!resourceType) return { error: "Resource type is required." };

  const costRaw = formData.get("estimated_cost") as string;
  const estimatedCost = costRaw ? parseFloat(costRaw) : null;

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("project_resources")
    .update({
      resource_type: resourceType,
      title,
      note: (formData.get("note") as string) || null,
      estimated_cost: estimatedCost,
      status: (formData.get("status") as string) || "needed",
      needed_by_date: (formData.get("needed_by_date") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resourceId);

  if (error) return { error: error.message };

  revalidatePath(`/project-planner/${projectId}`);
  return { success: true };
}

export async function deleteResource(
  resourceId: string,
  projectId: string,
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();
  await supabase.from("project_resources").delete().eq("id", resourceId);
  revalidatePath(`/project-planner/${projectId}`);
}

// ---------------------------------------------------------------------------
// Notes (inline update)
// ---------------------------------------------------------------------------

export async function updateProjectNotes(id: string, notes: string): Promise<void> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  await supabase
    .from("projects")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath(`/project-planner/${id}`);
}
