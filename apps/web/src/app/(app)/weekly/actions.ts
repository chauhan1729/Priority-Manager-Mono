"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canCreateActivityOnDate, localTodayForTimezone } from "@pm/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true } | null;

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateAll(linkedProjectId?: string | null) {
  revalidatePath("/weekly");
  revalidatePath("/daily-plan");
  revalidatePath("/activities/a");
  revalidatePath("/activities/b");
  revalidatePath("/someday");
  revalidatePath("/project-planner");
  if (linkedProjectId) revalidatePath(`/project-planner/${linkedProjectId}`);
}

/** Quick-add straight into the week's pool (priority B, no day yet). */
export async function createWeeklyActivity(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Title is required." };

  const weekStart = formData.get("week_start") as string | null;
  if (!weekStart) return { error: "Missing week." };

  const linkedProjectId = (formData.get("linked_project_id") as string) || null;
  const sectionType = linkedProjectId ? "work" : "unplanned";

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  if (linkedProjectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", linkedProjectId)
      .eq("user_id", user.id)
      .single();
    if (!project) return { error: "Project not found." };
  }

  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    section_type: sectionType,
    title,
    priority: "B",
    activity_date: weekStart, // soft week anchor, not a commitment to that day
    estimated_minutes: 0,
    remaining_minutes: 0,
    status: "not_started",
    linked_project_id: linkedProjectId,
    delegated_contact_id: null,
    note: (formData.get("note") as string) || null,
    origin_type: "manual",
    moved_from_date: null,
    is_someday: false,
    is_weekly: true,
  });
  if (error) return { error: error.message };

  revalidateAll(linkedProjectId);
  return { success: true };
}

/** Someday → weekly pool. Clears the someday flag and anchors the item to the week. */
export async function pullIntoWeek(
  activityId: string,
  weekStartDate: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("activities")
    .update({
      is_someday: false,
      is_weekly: true,
      activity_date: weekStartDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateAll();
  return {};
}

/**
 * Weekly pool → a specific day. This is the point of commitment, so the work→project
 * requirement (deferred while the item was parked) applies here.
 */
export async function assignToDay(
  activityId: string,
  toDateISO: string,
): Promise<{ error?: string }> {
  if (!canCreateActivityOnDate(toDateISO)) {
    return { error: "Pick today or a future day." };
  }
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { data: activity } = await supabase
    .from("activities")
    .select("id, section_type, linked_project_id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();
  if (!activity) return { error: "Activity not found." };

  if (activity.section_type === "work" && !activity.linked_project_id) {
    return {
      error: "Work activities need a linked project before they go on a day.",
    };
  }

  const { error } = await supabase
    .from("activities")
    .update({
      is_weekly: false,
      activity_date: toDateISO,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateAll(activity.linked_project_id);
  return {};
}

/**
 * Move an item into the week's pool — either a dated activity that slipped, or a pool item
 * stranded in a week that has already passed. Re-anchors it and clears any day commitment.
 */
export async function moveToWeeklyPool(
  activityId: string,
  weekStartDate: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { data: activity } = await supabase
    .from("activities")
    .select("id, activity_date, is_weekly, linked_project_id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();
  if (!activity) return { error: "Activity not found." };

  const { error } = await supabase
    .from("activities")
    .update({
      is_someday: false,
      is_weekly: true,
      activity_date: weekStartDate,
      // Keep the origin only for items that actually had a day; a stranded pool item never did.
      ...(activity.is_weekly
        ? {}
        : { moved_from_date: activity.activity_date }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateAll(activity.linked_project_id);
  return {};
}

/** Stamp the weekly review as done today, so the review-due prompt stands down for a week. */
export async function markWeeklyReviewDone(): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();

  const today = localTodayForTimezone(profile?.timezone ?? "UTC");
  const { error } = await supabase
    .from("profiles")
    .update({
      last_weekly_review_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/weekly");
  return {};
}

/** Park a pool item back on the Someday list. */
export async function moveWeeklyItemToSomeday(
  activityId: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("activities")
    .update({
      is_weekly: false,
      is_someday: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateAll();
  return {};
}
