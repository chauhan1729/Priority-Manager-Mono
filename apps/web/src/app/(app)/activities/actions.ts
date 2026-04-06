"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canCreateActivityOnDate, MAX_A_PRIORITY_PER_DAY } from "@pm/domain";
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

/**
 * Revalidates all pages that display activity data.
 * Called after every mutation so Activities tab and Project Planner stay in sync.
 */
function revalidateAll(linkedProjectId?: string | null) {
  revalidatePath("/activities");
  revalidatePath("/project-planner");
  if (linkedProjectId) revalidatePath(`/project-planner/${linkedProjectId}`);
}

// ---------------------------------------------------------------------------
// Create (spec §10.5)
// ---------------------------------------------------------------------------

export async function createActivity(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Title is required." };

  const activityDate = formData.get("activity_date") as string;
  if (!activityDate) return { error: "Date is required." };
  if (!canCreateActivityOnDate(activityDate)) {
    return { error: "Cannot create activities in the past." };
  }

  const sectionType = (formData.get("section_type") as string) || "work";
  const delegatedContactId = (formData.get("delegated_contact_id") as string) || null;

  // Delegated activities require a contact to be selected
  if (sectionType === "delegated" && !delegatedContactId) {
    return { error: "Delegated activities require a contact. Select one from the list." };
  }

  const estimatedHoursRaw = formData.get("estimated_hours") as string;
  const estimatedHours = parseFloat(estimatedHoursRaw);
  if (!estimatedHoursRaw || isNaN(estimatedHours) || estimatedHours <= 0) {
    return { error: "Estimated time must be a positive number." };
  }
  const estimatedMinutes = Math.round(estimatedHours * 60);

  const priority = (formData.get("priority") as string) || null;
  const linkedProjectId = (formData.get("linked_project_id") as string) || null;

  // Spec §10.5: Work activities must link to a project
  if (sectionType === "work" && !linkedProjectId) {
    return { error: "Work activities must be linked to a project." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Verify delegated contact belongs to this user
  if (sectionType === "delegated" && delegatedContactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", delegatedContactId)
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .single();
    if (!contact) return { error: "Contact not found." };
  }

  // Spec §10.5: Hard block — max 3 A-priorities per day (server-side)
  if (priority === "A") {
    const { count } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("activity_date", activityDate)
      .eq("priority", "A");

    if ((count ?? 0) >= MAX_A_PRIORITY_PER_DAY) {
      return {
        error: `Maximum ${MAX_A_PRIORITY_PER_DAY} A-priority activities allowed per day.`,
      };
    }
  }

  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    title,
    section_type: sectionType,
    priority: priority || null,
    activity_date: activityDate,
    estimated_minutes: estimatedMinutes,
    remaining_minutes: estimatedMinutes,
    status: "not_started",
    linked_project_id: linkedProjectId,
    delegated_contact_id: sectionType === "delegated" ? delegatedContactId : null,
    note: (formData.get("note") as string) || null,
    origin_type: "manual",
    moved_from_date: null,
  });

  if (error) return { error: error.message };

  revalidateAll(linkedProjectId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update / Edit
// Preserves: delegated_contact_id, origin_type, moved_from_date — not in form.
// Only updates the columns sent from the edit form.
// ---------------------------------------------------------------------------

export async function updateActivity(
  activityId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Title is required." };

  const activityDate = formData.get("activity_date") as string;
  if (!activityDate) return { error: "Date is required." };
  if (!canCreateActivityOnDate(activityDate)) {
    return { error: "Cannot move activities to a past date." };
  }

  const sectionType = (formData.get("section_type") as string) || "work";
  // Allow editing existing delegated activities (DB constraint still enforced).
  // But block changing a non-delegated activity to delegated without a contact.
  // Since we don't know the current section here, we'll let the DB enforce it
  // and return the error message if it fails.

  const estimatedHoursRaw = formData.get("estimated_hours") as string;
  const estimatedHours = parseFloat(estimatedHoursRaw);
  if (!estimatedHoursRaw || isNaN(estimatedHours) || estimatedHours <= 0) {
    return { error: "Estimated time must be a positive number." };
  }
  const estimatedMinutes = Math.round(estimatedHours * 60);

  const priority = (formData.get("priority") as string) || null;
  const linkedProjectId = (formData.get("linked_project_id") as string) || null;

  if (sectionType === "work" && !linkedProjectId) {
    return { error: "Work activities must be linked to a project." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // A-priority cap check (exclude self from count)
  if (priority === "A") {
    const { count } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("activity_date", activityDate)
      .eq("priority", "A")
      .neq("id", activityId);

    if ((count ?? 0) >= MAX_A_PRIORITY_PER_DAY) {
      return {
        error: `Maximum ${MAX_A_PRIORITY_PER_DAY} A-priority activities allowed per day.`,
      };
    }
  }

  const { error } = await supabase
    .from("activities")
    .update({
      title,
      section_type: sectionType,
      priority: priority || null,
      activity_date: activityDate,
      estimated_minutes: estimatedMinutes,
      remaining_minutes: estimatedMinutes, // sync remaining to new estimate
      linked_project_id: linkedProjectId,
      note: (formData.get("note") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll(linkedProjectId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Status update (inline quick action)
// ---------------------------------------------------------------------------

export async function updateActivityStatus(
  activityId: string,
  status: string,
  linkedProjectId?: string | null,
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();
  await supabase
    .from("activities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", activityId);
  revalidateAll(linkedProjectId);
}

// ---------------------------------------------------------------------------
// Postpone — spec §10.5: rescheduling history preserved via moved_from_date.
// First-move-wins: moved_from_date is only set on the first postpone,
// preserving the original planned date across multiple moves.
// ---------------------------------------------------------------------------

export async function postponeActivity(
  activityId: string,
  toDate: string,
  currentDate: string,
  linkedProjectId?: string | null,
): Promise<{ error?: string }> {
  if (!canCreateActivityOnDate(toDate)) {
    return { error: "Cannot postpone to a past date." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  // Fetch existing moved_from_date to apply first-move-wins rule
  const { data: existing } = await supabase
    .from("activities")
    .select("moved_from_date")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();

  // Preserve original planned date — never overwrite once set
  const movedFromDate = existing?.moved_from_date ?? currentDate;

  const { error } = await supabase
    .from("activities")
    .update({
      activity_date: toDate,
      status: "postponed",
      moved_from_date: movedFromDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll(linkedProjectId);
  return {};
}

// ---------------------------------------------------------------------------
// Carry forward — move from previous day to target date (spec §10.5).
// Preserves original moved_from_date. Sets origin_type = 'carry_forward'.
// ---------------------------------------------------------------------------

export async function carryForwardActivity(
  activityId: string,
  fromDate: string,
  toDate: string,
  linkedProjectId?: string | null,
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { data: existing } = await supabase
    .from("activities")
    .select("moved_from_date")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();

  const movedFromDate = existing?.moved_from_date ?? fromDate;

  const { error } = await supabase
    .from("activities")
    .update({
      activity_date: toDate,
      origin_type: "carry_forward",
      moved_from_date: movedFromDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll(linkedProjectId);
  return {};
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteActivity(
  activityId: string,
  linkedProjectId?: string | null,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  await supabase
    .from("activities")
    .delete()
    .eq("id", activityId)
    .eq("user_id", user.id);

  revalidateAll(linkedProjectId);
}

// ---------------------------------------------------------------------------
// Delegate — sets status + section_type = "delegated" and links a contact.
// ---------------------------------------------------------------------------

export async function delegateActivity(
  activityId: string,
  contactId: string,
  linkedProjectId?: string | null,
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  // Verify contact belongs to this user
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("user_id", user.id)
    .eq("is_deleted", false)
    .single();

  if (!contact) return { error: "Contact not found." };

  const { error } = await supabase
    .from("activities")
    .update({
      status: "delegated",
      section_type: "delegated",
      delegated_contact_id: contactId,
      linked_project_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll(linkedProjectId);
  return {};
}

// ---------------------------------------------------------------------------
// Archive (soft-hide completed/cancelled activities)
// ---------------------------------------------------------------------------

export async function archiveActivity(
  activityId: string,
  linkedProjectId?: string | null,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  await supabase
    .from("activities")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", activityId)
    .eq("user_id", user.id);

  revalidateAll(linkedProjectId);
}
