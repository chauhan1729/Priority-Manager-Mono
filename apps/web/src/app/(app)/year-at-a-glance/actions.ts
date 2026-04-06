"use server";

import { revalidatePath } from "next/cache";

import { buildLinkedProjectName } from "@pm/domain";
import type { AvailabilityStatus, YearEntryType } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { success: true } | { error: string };

/**
 * Revalidate all pages that display year entry data.
 * Calendar reads year_entries directly for birthday chips and away overlays.
 */
function revalidateAll() {
  revalidatePath("/year-at-a-glance");
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

function validateEntryData(data: {
  type: YearEntryType;
  title: string;
  start_date: string;
  end_date?: string | null;
  availability_status?: AvailabilityStatus | null;
  create_linked_trip_plan?: boolean;
}): string | null {
  if (!data.title.trim()) return "Title is required.";
  if (!data.start_date) return "Start date is required.";

  if (data.type === "birthday") {
    if (data.end_date) return "Birthday entries cannot have an end date.";
    if (data.create_linked_trip_plan) return "Birthday entries cannot have linked trip plans.";
  }

  if (data.type !== "birthday" && !data.availability_status) {
    return "Availability status is required for travel/away entries.";
  }

  if (data.end_date && data.end_date < data.start_date) {
    return "End date must be on or after start date.";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Create year entry
// Spec §10.1: travel/away entries optionally create a linked project (trip plan).
// Birthday entries are single-day; they display in Calendar by annual recurrence.
// ---------------------------------------------------------------------------

export async function createYearEntry(data: {
  type: YearEntryType;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  note?: string | null;
  availability_status?: AvailabilityStatus | null;
  create_linked_trip_plan?: boolean;
}): Promise<ActionResult> {
  const validationError = validateEntryData(data);
  if (validationError) return { error: validationError };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: entry, error: entryError } = await supabase
    .from("year_entries")
    .insert({
      user_id: user.id,
      type: data.type,
      title: data.title.trim(),
      start_date: data.start_date,
      end_date: data.end_date ?? null,
      location: data.location?.trim() ?? null,
      note: data.note?.trim() ?? null,
      availability_status: data.type !== "birthday" ? (data.availability_status ?? null) : null,
      create_linked_trip_plan: data.create_linked_trip_plan ?? false,
      linked_project_id: null,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    return { error: entryError?.message ?? "Failed to create entry." };
  }

  // Create linked trip plan project if requested (travel/away only, spec §10.1 §18.5)
  if (data.create_linked_trip_plan && data.type !== "birthday") {
    const projectName = buildLinkedProjectName({ title: data.title.trim() });

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: projectName,
        description: null,
        status: "in_progress",
        start_date: data.start_date,
        target_end_date: data.end_date ?? null,
        notes: null,
      })
      .select("id")
      .single();

    if (!projectError && project) {
      await supabase
        .from("year_entries")
        .update({ linked_project_id: project.id })
        .eq("id", entry.id)
        .eq("user_id", user.id);
    }
  }

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update year entry
// If create_linked_trip_plan becomes true and no project exists yet, create one.
// Spec §10.1: preserving linked project relationship when applicable.
// ---------------------------------------------------------------------------

export async function updateYearEntry(
  id: string,
  data: {
    title?: string;
    start_date?: string;
    end_date?: string | null;
    location?: string | null;
    note?: string | null;
    availability_status?: AvailabilityStatus | null;
    create_linked_trip_plan?: boolean;
  },
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: existing } = await supabase
    .from("year_entries")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { error: "Entry not found." };

  // Merge and validate with current type (type is immutable after creation)
  const mergedType = existing.type as YearEntryType;
  const mergedTitle = data.title ?? existing.title;
  const mergedStartDate = data.start_date ?? existing.start_date;
  const mergedEndDate = "end_date" in data ? data.end_date : existing.end_date;
  const mergedAvailability = "availability_status" in data
    ? data.availability_status
    : existing.availability_status;
  const willCreatePlan = data.create_linked_trip_plan ?? existing.create_linked_trip_plan;

  const validationError = validateEntryData({
    type: mergedType,
    title: mergedTitle,
    start_date: mergedStartDate,
    end_date: mergedEndDate,
    availability_status: mergedAvailability,
    create_linked_trip_plan: willCreatePlan,
  });
  if (validationError) return { error: validationError };

  const { error } = await supabase
    .from("year_entries")
    .update({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.start_date !== undefined && { start_date: data.start_date }),
      ...("end_date" in data && { end_date: data.end_date ?? null }),
      ...("location" in data && { location: data.location?.trim() ?? null }),
      ...("note" in data && { note: data.note?.trim() ?? null }),
      ...("availability_status" in data && { availability_status: data.availability_status ?? null }),
      ...(data.create_linked_trip_plan !== undefined && {
        create_linked_trip_plan: data.create_linked_trip_plan,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Create linked trip plan if newly requested and not yet created (spec §10.1)
  if (
    data.create_linked_trip_plan === true &&
    !existing.linked_project_id &&
    mergedType !== "birthday"
  ) {
    const projectName = buildLinkedProjectName({ title: mergedTitle });

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: projectName,
        description: null,
        status: "in_progress",
        start_date: mergedStartDate,
        target_end_date: mergedEndDate ?? null,
        notes: null,
      })
      .select("id")
      .single();

    if (!projectError && project) {
      await supabase
        .from("year_entries")
        .update({ linked_project_id: project.id })
        .eq("id", id)
        .eq("user_id", user.id);
    }
  }

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete year entry — safe delete.
// Spec §10.1: deleting a year entry with a linked trip plan should:
//   - Remove year entry only and keep the linked project.
// The FK is: year_entries.linked_project_id → projects ON DELETE SET NULL
// So deleting the year_entry leaves the project intact by design.
// If the user also wants to delete the project, they do that from Project Planner.
// ---------------------------------------------------------------------------

export async function deleteYearEntry(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: existing } = await supabase
    .from("year_entries")
    .select("id, linked_project_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { error: "Entry not found." };

  const { error } = await supabase
    .from("year_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}
