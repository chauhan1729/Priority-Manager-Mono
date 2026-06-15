"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildActivityMove, canCreateActivityOnDate } from "@pm/domain";
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
  revalidatePath("/activities/a");
  revalidatePath("/activities/b");
  revalidatePath("/daily-plan");
  revalidatePath("/someday");
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

  // Phase 1B: no date chosen → park on the Someday list (use today as a soft "review on/after" date).
  const activityDateRaw = (formData.get("activity_date") as string) || "";
  const isSomeday = !activityDateRaw;
  const activityDate = activityDateRaw || new Date().toISOString().slice(0, 10);
  if (activityDateRaw && !canCreateActivityOnDate(activityDate)) {
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

  // Phase 0A: priority is mandatory — default to B ("everything is a B").
  const priority = (formData.get("priority") as string) === "A" ? "A" : "B";
  const linkedProjectId = (formData.get("linked_project_id") as string) || null;

  // Spec §10.5: Work activities must link to a project — except Someday items (parked, not committed).
  if (sectionType === "work" && !linkedProjectId && !isSomeday) {
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

  // Phase 0A: the 3-A/day cap is a soft, override-able recommendation, surfaced as an escalating
  // warning in the UI — not a server-side hard block. So no cap enforcement here.

  const recurrenceRule = (formData.get("recurrence_rule") as string) || null;
  const validRecurrence = ["daily", "weekly", "monthly"] as const;
  type RecurrenceRule = typeof validRecurrence[number];
  const typedRecurrence: RecurrenceRule | null =
    recurrenceRule && (validRecurrence as readonly string[]).includes(recurrenceRule)
      ? (recurrenceRule as RecurrenceRule)
      : null;

  const base = {
    user_id: user.id,
    title,
    section_type: sectionType,
    priority,
    estimated_minutes: estimatedMinutes,
    remaining_minutes: estimatedMinutes,
    status: "not_started" as const,
    linked_project_id: linkedProjectId,
    delegated_contact_id: sectionType === "delegated" ? delegatedContactId : null,
    note: (formData.get("note") as string) || null,
    origin_type: "manual" as const,
    moved_from_date: null,
    recurrence_rule: typedRecurrence,
    is_someday: isSomeday,
  };

  const { error } = await supabase.from("activities").insert({
    ...base,
    activity_date: activityDate,
  });

  if (error) return { error: error.message };

  // Create recurring sibling copies (next 3 occurrences)
  if (typedRecurrence) {
    const siblings = buildRecurringDates(activityDate, typedRecurrence, 3);
    for (const sibDate of siblings) {
      await supabase.from("activities").insert({
        ...base,
        activity_date: sibDate,
        recurrence_rule: typedRecurrence,
      });
    }
  }

  revalidateAll(linkedProjectId);
  return { success: true };
}

/**
 * Given a start date (ISO), a recurrence rule, and a count,
 * returns the next `count` occurrence dates as ISO strings.
 */
function buildRecurringDates(
  startISO: string,
  rule: "daily" | "weekly" | "monthly",
  count: number,
): string[] {
  const dates: string[] = [];
  const [y = 0, m = 0, d = 0] = startISO.split("-").map(Number);
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

  // Phase 0A: priority is mandatory — default to B.
  const priority = (formData.get("priority") as string) === "A" ? "A" : "B";
  const linkedProjectId = (formData.get("linked_project_id") as string) || null;

  if (sectionType === "work" && !linkedProjectId) {
    return { error: "Work activities must be linked to a project." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Phase 0A: 3-A/day cap is a soft UI warning with override, not a server hard block.

  const { error } = await supabase
    .from("activities")
    .update({
      title,
      section_type: sectionType,
      priority,
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
// Bulk update — move or postpone multiple activities to a new date.
// Cannot change: name, project, priority (per spec).
// ---------------------------------------------------------------------------

export async function bulkMoveActivities(
  activityIds: string[],
  toDate: string,
  currentDate: string,
): Promise<{ error?: string }> {
  if (activityIds.length === 0) return {};
  if (!canCreateActivityOnDate(toDate)) {
    return { error: "Cannot move activities to a past date." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { data: existing } = await supabase
    .from("activities")
    .select("id, moved_from_date")
    .in("id", activityIds)
    .eq("user_id", user.id);

  for (const act of existing ?? []) {
    const movedFromDate = act.moved_from_date ?? currentDate;
    await supabase
      .from("activities")
      .update({
        activity_date: toDate,
        status: "postponed",
        moved_from_date: movedFromDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", act.id)
      .eq("user_id", user.id);
  }

  revalidateAll();
  return {};
}

// ---------------------------------------------------------------------------
// Bulk delete
// ---------------------------------------------------------------------------

export async function bulkDeleteActivities(
  activityIds: string[],
): Promise<{ error?: string }> {
  if (activityIds.length === 0) return {};

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("activities")
    .delete()
    .in("id", activityIds)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return {};
}

// ---------------------------------------------------------------------------
// Bulk status update
// ---------------------------------------------------------------------------

export async function bulkUpdateActivityStatus(
  activityIds: string[],
  status: string,
): Promise<{ error?: string }> {
  if (activityIds.length === 0) return {};

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("activities")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", activityIds)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return {};
}

// ---------------------------------------------------------------------------
// Bulk priority update
// ---------------------------------------------------------------------------

export async function bulkUpdateActivityPriority(
  activityIds: string[],
  priority: "A" | "B",
): Promise<{ error?: string }> {
  if (activityIds.length === 0) return {};

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  // Phase 0A: priority is mandatory A|B (default B for any unexpected value).
  const next = priority === "A" ? "A" : "B";
  const { error } = await supabase
    .from("activities")
    .update({ priority: next, updated_at: new Date().toISOString() })
    .in("id", activityIds)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return {};
}

// ---------------------------------------------------------------------------
// Bulk archive
// ---------------------------------------------------------------------------

export async function bulkArchiveActivities(
  activityIds: string[],
): Promise<{ error?: string }> {
  if (activityIds.length === 0) return {};

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("activities")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .in("id", activityIds)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
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

// ---------------------------------------------------------------------------
// Phase 1B — Someday list (parked outside the 30-day horizon)
// ---------------------------------------------------------------------------

/** Park an activity on the Someday list (outside the horizon). */
export async function moveToSomeday(activityId: string): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("activities")
    .update({ is_someday: true, updated_at: new Date().toISOString() })
    .eq("id", activityId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/**
 * Pull a Someday item into the 30-day horizon: clear the someday flag and give it a concrete date.
 * Rejects past dates (no creation in the past).
 */
export async function pullIntoHorizon(
  activityId: string,
  toDateISO: string,
): Promise<{ error?: string }> {
  if (!canCreateActivityOnDate(toDateISO)) {
    return { error: "Pick today or a future date." };
  }
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("activities")
    .update({ is_someday: false, activity_date: toDateISO, updated_at: new Date().toISOString() })
    .eq("id", activityId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/**
 * Phase 2A: re-date an activity to a chosen day (not a blind "tomorrow"), recording the move in
 * activity_moves and setting moved_from_date. Rejects past targets.
 */
export async function rescheduleActivityToDate(
  activityId: string,
  toDateISO: string,
  reason?: string,
): Promise<{ error?: string }> {
  if (!canCreateActivityOnDate(toDateISO)) {
    return { error: "Pick today or a future date." };
  }
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { data: activity } = await supabase
    .from("activities")
    .select("id, user_id, activity_date, linked_project_id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();
  if (!activity) return { error: "Activity not found." };
  if (activity.activity_date === toDateISO) return {}; // no-op

  const nowISO = new Date().toISOString();
  const { error } = await supabase
    .from("activities")
    .update({
      activity_date: toDateISO,
      moved_from_date: activity.activity_date,
      updated_at: nowISO,
    })
    .eq("id", activityId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  const move = buildActivityMove({
    activity,
    toDateISO,
    nowISO,
    reason: reason ?? null,
  });
  await supabase.from("activity_moves").insert(move);

  revalidateAll(activity.linked_project_id);
  return {};
}

/** Quick-add a Someday item (title + optional project; priority B, parked outside the horizon). */
export async function createSomedayActivity(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Title is required." };

  // Optional project link. If chosen, the item is a (parked) work activity; otherwise unplanned.
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    section_type: sectionType,
    title,
    priority: "B",
    activity_date: todayStr, // soft "review on/after" date
    estimated_minutes: 0,
    remaining_minutes: 0,
    status: "not_started",
    linked_project_id: linkedProjectId,
    delegated_contact_id: null,
    note: (formData.get("note") as string) || null,
    origin_type: "manual",
    moved_from_date: null,
    is_someday: true,
  });
  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}
