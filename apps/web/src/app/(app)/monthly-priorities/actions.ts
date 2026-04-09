"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getNextMonthKey,
  isEligibleForCarryForward,
  isValidManualProgress,
  isValidMonthKey,
  isValidMPSection,
  isValidMPStatus,
  MAX_PRIORITIES_PER_SECTION,
} from "@pm/domain";
import type { MonthlyPriority } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true } | null;

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateAll(...projectIds: (string | null | undefined)[]) {
  revalidatePath("/monthly-priorities");
  revalidatePath("/project-planner");
  revalidatePath("/annual-strategies");
  for (const id of projectIds) {
    if (id) revalidatePath(`/project-planner/${id}`);
  }
}

// ---------------------------------------------------------------------------
// Create Monthly Priority
// ---------------------------------------------------------------------------

export type CreatePriorityData = {
  section: string;
  title: string;
  month_key: string;
  category?: string | null | undefined;
  started_date?: string | null | undefined;
  assigned_date?: string | null | undefined;
  target_date?: string | null | undefined;
  linked_annual_goal_id?: string | null | undefined;
  linked_project_id?: string | null | undefined;
  progress_mode?: string | undefined;
  note?: string | null | undefined;
  pinned?: boolean | undefined;
};

export async function createMonthlyPriority(
  data: CreatePriorityData,
): Promise<ActionResult> {
  const title = data.title.trim();
  if (!title) return { error: "Title is required." };

  if (!isValidMPSection(data.section)) {
    return { error: "Section must be business_career or personal." };
  }

  if (!isValidMonthKey(data.month_key)) {
    return { error: "Invalid month key." };
  }

  const progressMode = data.progress_mode ?? "manual";
  if (progressMode !== "manual" && progressMode !== "auto_project") {
    return { error: "Invalid progress mode." };
  }

  if (progressMode === "auto_project" && !data.linked_project_id) {
    return { error: "Auto progress requires a linked project." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Enforce section limit — spec §10.4: hard block at 5
  const { data: existing, error: countError } = await supabase
    .from("monthly_priorities")
    .select("id")
    .eq("user_id", user.id)
    .eq("section", data.section)
    .eq("month_key", data.month_key);

  if (countError) return { error: countError.message };

  if ((existing ?? []).length >= MAX_PRIORITIES_PER_SECTION) {
    return {
      error: `Section is full. Maximum ${MAX_PRIORITIES_PER_SECTION} priorities per section per month.`,
    };
  }

  const { data: newPriority, error } = await supabase
    .from("monthly_priorities")
    .insert({
      user_id: user.id,
      section: data.section,
      title,
      month_key: data.month_key,
      category: data.category?.trim() || null,
      started_date: data.started_date ?? null,
      assigned_date: data.assigned_date ?? null,
      target_date: data.target_date ?? null,
      linked_annual_goal_id: data.linked_annual_goal_id ?? null,
      linked_project_id: data.linked_project_id ?? null,
      progress_mode: progressMode,
      manual_progress_percent: 0,
      status: "planned",
      note: data.note?.trim() || null,
      pinned: data.pinned ?? false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Sync linked_monthly_priority_id on the project
  if (data.linked_project_id && newPriority?.id) {
    await supabase
      .from("projects")
      .update({ linked_monthly_priority_id: newPriority.id, updated_at: new Date().toISOString() })
      .eq("id", data.linked_project_id)
      .eq("user_id", user.id);
  }

  revalidateAll(data.linked_project_id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update Monthly Priority
// ---------------------------------------------------------------------------

export type UpdatePriorityData = {
  title?: string | undefined;
  category?: string | null | undefined;
  started_date?: string | null | undefined;
  assigned_date?: string | null | undefined;
  target_date?: string | null | undefined;
  linked_annual_goal_id?: string | null | undefined;
  linked_project_id?: string | null | undefined;
  progress_mode?: string | undefined;
  status?: string | undefined;
  note?: string | null | undefined;
  pinned?: boolean | undefined;
};

export async function updateMonthlyPriority(
  id: string,
  data: UpdatePriorityData,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify ownership and fetch current state
  const { data: existing, error: fetchError } = await supabase
    .from("monthly_priorities")
    .select("id, user_id, linked_project_id, progress_mode")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) return { error: "Priority not found." };

  // Validate progress_mode change: auto_project requires a linked project
  const newProgressMode = data.progress_mode ?? existing.progress_mode;
  const newLinkedProject =
    "linked_project_id" in data
      ? data.linked_project_id
      : existing.linked_project_id;

  if (newProgressMode === "auto_project" && !newLinkedProject) {
    return { error: "Auto progress requires a linked project." };
  }

  // If project is being unlinked, force progress_mode back to manual
  if ("linked_project_id" in data && !data.linked_project_id) {
    data = { ...data, progress_mode: "manual" };
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) return { error: "Title is required." };
    updatePayload.title = title;
  }
  if ("category" in data) updatePayload.category = data.category?.trim() || null;
  if ("started_date" in data) updatePayload.started_date = data.started_date ?? null;
  if ("assigned_date" in data) updatePayload.assigned_date = data.assigned_date ?? null;
  if ("target_date" in data) updatePayload.target_date = data.target_date ?? null;
  if ("linked_annual_goal_id" in data)
    updatePayload.linked_annual_goal_id = data.linked_annual_goal_id ?? null;
  if ("linked_project_id" in data)
    updatePayload.linked_project_id = data.linked_project_id ?? null;
  if (data.progress_mode !== undefined) updatePayload.progress_mode = data.progress_mode;
  if (data.status !== undefined) {
    if (!isValidMPStatus(data.status)) return { error: "Invalid status." };
    updatePayload.status = data.status;
  }
  if ("note" in data) updatePayload.note = data.note?.trim() || null;
  if (data.pinned !== undefined) updatePayload.pinned = data.pinned;

  const { error } = await supabase
    .from("monthly_priorities")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Sync linked_monthly_priority_id on projects when the linked project changes
  const oldProjectId = existing.linked_project_id as string | null;
  const newProjectId = ("linked_project_id" in data ? data.linked_project_id : existing.linked_project_id) as string | null | undefined;

  // Always sync when linked_project_id is explicitly part of this update (handles relink of same project)
  if ("linked_project_id" in data) {
    // Clear the old project's link only if switching to a different project
    if (oldProjectId && oldProjectId !== newProjectId) {
      await supabase
        .from("projects")
        .update({ linked_monthly_priority_id: null, updated_at: new Date().toISOString() })
        .eq("id", oldProjectId)
        .eq("linked_monthly_priority_id", id)
        .eq("user_id", user.id);
    }
    // Always ensure the new project points to this priority
    if (newProjectId) {
      await supabase
        .from("projects")
        .update({ linked_monthly_priority_id: id, updated_at: new Date().toISOString() })
        .eq("id", newProjectId)
        .eq("user_id", user.id);
    }
  } else if (oldProjectId !== newProjectId) {
    // Fallback: handle any other case where project link changed
    if (oldProjectId) {
      await supabase
        .from("projects")
        .update({ linked_monthly_priority_id: null, updated_at: new Date().toISOString() })
        .eq("id", oldProjectId)
        .eq("linked_monthly_priority_id", id)
        .eq("user_id", user.id);
    }
    if (newProjectId) {
      await supabase
        .from("projects")
        .update({ linked_monthly_priority_id: id, updated_at: new Date().toISOString() })
        .eq("id", newProjectId)
        .eq("user_id", user.id);
    }
  }

  revalidateAll(oldProjectId, newProjectId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update Status (inline — spec §10.4 requires inline updates)
// ---------------------------------------------------------------------------

export async function updatePriorityStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!isValidMPStatus(status)) {
    return { error: "Invalid status." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("monthly_priorities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update Progress (manual mode only)
// ---------------------------------------------------------------------------

export async function updatePriorityProgress(
  id: string,
  progressPercent: number,
): Promise<ActionResult> {
  if (!isValidManualProgress(progressPercent)) {
    return { error: "Progress must be an integer between 0 and 100." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify mode is manual before allowing update
  const { data: existing, error: fetchError } = await supabase
    .from("monthly_priorities")
    .select("progress_mode")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) return { error: "Priority not found." };
  if (existing.progress_mode !== "manual") {
    return {
      error: "Progress is auto-computed from the linked project and cannot be set manually.",
    };
  }

  const { error } = await supabase
    .from("monthly_priorities")
    .update({
      manual_progress_percent: progressPercent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Toggle Pin
// ---------------------------------------------------------------------------

export async function togglePriorityPin(
  id: string,
  pinned: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("monthly_priorities")
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete Monthly Priority
// ---------------------------------------------------------------------------

export async function deleteMonthlyPriority(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Fetch linked project before deleting so we can clear its reference
  const { data: existing } = await supabase
    .from("monthly_priorities")
    .select("linked_project_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const linkedProjectId = existing?.linked_project_id as string | null | undefined;

  const { error } = await supabase
    .from("monthly_priorities")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Clear the project's link if it was pointing to this priority
  if (linkedProjectId) {
    await supabase
      .from("projects")
      .update({ linked_monthly_priority_id: null, updated_at: new Date().toISOString() })
      .eq("id", linkedProjectId)
      .eq("linked_monthly_priority_id", id)
      .eq("user_id", user.id);
  }

  revalidateAll(linkedProjectId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Carry Forward Priority
// ---------------------------------------------------------------------------

/**
 * Spec §10.4: carry-forward only allowed if linked project is still in_progress.
 * Creates a new record in targetMonthKey with status="planned".
 * Preserves linked_annual_goal_id and linked_project_id.
 * Historical record is left intact.
 */
export async function carryForwardPriority(
  id: string,
  targetMonthKey?: string | undefined,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Fetch the source priority
  const { data: source, error: fetchError } = await supabase
    .from("monthly_priorities")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !source) return { error: "Priority not found." };

  const priority = source as MonthlyPriority;

  if (!isEligibleForCarryForward(priority)) {
    return {
      error:
        "Priority cannot be carried forward. It must have a linked project and not be completed or dropped.",
    };
  }

  // Verify linked project is still in progress
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", priority.linked_project_id!)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return { error: "Linked project not found." };
  }

  if (project.status !== "in_progress") {
    return {
      error: `Linked project is "${project.status}" — carry-forward requires the project to be in progress.`,
    };
  }

  // Target month key defaults to next month
  const nextKey = targetMonthKey ?? getNextMonthKey(priority.month_key);

  if (!isValidMonthKey(nextKey)) {
    return { error: "Invalid target month." };
  }

  // Check section capacity in target month
  const { data: targetExisting, error: countError } = await supabase
    .from("monthly_priorities")
    .select("id")
    .eq("user_id", user.id)
    .eq("section", priority.section)
    .eq("month_key", nextKey);

  if (countError) return { error: countError.message };

  if ((targetExisting ?? []).length >= MAX_PRIORITIES_PER_SECTION) {
    return {
      error: `Cannot carry forward — target month section is full (max ${MAX_PRIORITIES_PER_SECTION} priorities).`,
    };
  }

  // Create new record in target month
  const { error: insertError } = await supabase.from("monthly_priorities").insert({
    user_id: user.id,
    section: priority.section,
    title: priority.title,
    month_key: nextKey,
    category: priority.category,
    started_date: priority.started_date,
    assigned_date: priority.assigned_date,
    target_date: priority.target_date,
    linked_annual_goal_id: priority.linked_annual_goal_id,
    linked_project_id: priority.linked_project_id,
    progress_mode: priority.progress_mode,
    manual_progress_percent: priority.manual_progress_percent,
    status: "planned",
    note: priority.note,
    pinned: false,
  });

  if (insertError) return { error: insertError.message };

  revalidateAll();
  return { success: true };
}
