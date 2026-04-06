"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isValidProgress,
  isValidSection,
  isValidStatus,
} from "@pm/domain";
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

function revalidateAll() {
  revalidatePath("/annual-strategies");
  // Project Planner shows linked_annual_goal_id — revalidate it on link/unlink
  revalidatePath("/project-planner");
}

// ---------------------------------------------------------------------------
// Create Annual Goal
// ---------------------------------------------------------------------------

export type CreateGoalData = {
  section: string;
  title: string;
  description?: string | undefined;
  why_it_matters?: string | undefined;
  target_date?: string | null | undefined;
  notes?: string | null | undefined;
};

export async function createAnnualGoal(data: CreateGoalData): Promise<ActionResult> {
  const title = data.title.trim();
  if (!title) return { error: "Title is required." };

  if (!isValidSection(data.section)) {
    return { error: "Section must be business, career, or personal." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("annual_goals").insert({
    user_id: user.id,
    section: data.section,
    title,
    description: data.description?.trim() ?? "",
    why_it_matters: data.why_it_matters?.trim() ?? "",
    target_date: data.target_date ?? null,
    progress_percent: 0,
    status: "not_started",
    notes: data.notes?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update Annual Goal
// ---------------------------------------------------------------------------

export type UpdateGoalData = {
  title?: string | undefined;
  description?: string | undefined;
  why_it_matters?: string | undefined;
  target_date?: string | null | undefined;
  notes?: string | null | undefined;
  status?: string | undefined;
};

export async function updateAnnualGoal(
  id: string,
  data: UpdateGoalData,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from("annual_goals")
    .select("id, user_id, section")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) return { error: "Goal not found." };

  if (data.status !== undefined && !isValidStatus(data.status)) {
    return { error: "Invalid status." };
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) return { error: "Title is required." };
    updatePayload.title = title;
  }
  if (data.description !== undefined) updatePayload.description = data.description.trim();
  if (data.why_it_matters !== undefined) updatePayload.why_it_matters = data.why_it_matters.trim();
  if ("target_date" in data) updatePayload.target_date = data.target_date ?? null;
  if ("notes" in data) updatePayload.notes = data.notes?.trim() || null;
  if (data.status !== undefined) updatePayload.status = data.status;

  const { error } = await supabase
    .from("annual_goals")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update Progress (separate action — manual only, spec §10.3)
// ---------------------------------------------------------------------------

export async function updateGoalProgress(
  id: string,
  progressPercent: number,
): Promise<ActionResult> {
  if (!isValidProgress(progressPercent)) {
    return { error: "Progress must be an integer between 0 and 100." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("annual_goals")
    .update({
      progress_percent: progressPercent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete Annual Goal
// ---------------------------------------------------------------------------

/**
 * Spec §10.3 sync rule: deleting a goal leaves linked projects intact.
 * The FK (projects.linked_annual_goal_id ON DELETE SET NULL) handles nullification.
 * Monthly priorities also have linked_annual_goal_id ON DELETE SET NULL — same behavior.
 */
export async function deleteAnnualGoal(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("annual_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Link / Unlink Project
// ---------------------------------------------------------------------------

/**
 * Spec §10.3 sync rule: projects reference AnnualGoal via FK.
 * Linking = update projects.linked_annual_goal_id.
 * Never creates duplicate project records.
 */
export async function linkProjectToGoal(
  goalId: string,
  projectId: string,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify goal ownership
  const { data: goal, error: goalError } = await supabase
    .from("annual_goals")
    .select("id, status")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single();

  if (goalError || !goal) return { error: "Goal not found." };
  if (goal.status === "completed" || goal.status === "dropped") {
    return { error: "Cannot link projects to an archived goal." };
  }

  // Verify project ownership
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) return { error: "Project not found." };

  const { error } = await supabase
    .from("projects")
    .update({
      linked_annual_goal_id: goalId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

export async function unlinkProjectFromGoal(
  goalId: string,
  projectId: string,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify ownership of both (goalId used for revalidation logic only; project carries the FK)
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, linked_annual_goal_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) return { error: "Project not found." };
  if (project.linked_annual_goal_id !== goalId) {
    return { error: "Project is not linked to this goal." };
  }

  const { error } = await supabase
    .from("projects")
    .update({
      linked_annual_goal_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}
