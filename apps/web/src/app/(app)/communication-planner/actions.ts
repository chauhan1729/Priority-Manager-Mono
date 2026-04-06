"use server";

import { revalidatePath } from "next/cache";

import { canCreateActivityOnDate } from "@pm/domain";
import type { ContactCategory } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { success: true } | { error: string };

/**
 * Revalidate all pages that display contact or delegated-activity data.
 * Spec §10.7 sync rule: contact updates must reflect everywhere contact info is shown.
 */
function revalidateAll() {
  revalidatePath("/communication-planner");
  revalidatePath("/activities");
  revalidatePath("/daily-plan");
}

// ---------------------------------------------------------------------------
// Create contact
// ---------------------------------------------------------------------------

export async function createContact(data: {
  full_name: string;
  category: ContactCategory;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
}): Promise<ActionResult> {
  if (!data.full_name.trim()) return { error: "Name is required." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("contacts").insert({
    user_id: user.id,
    category: data.category,
    full_name: data.full_name.trim(),
    company: data.company?.trim() || null,
    role: data.role?.trim() || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    note: data.note?.trim() || null,
    is_deleted: false,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update contact
// ---------------------------------------------------------------------------

export async function updateContact(
  id: string,
  data: {
    full_name: string;
    category: ContactCategory;
    company?: string | null;
    role?: string | null;
    phone?: string | null;
    email?: string | null;
  },
): Promise<ActionResult> {
  if (!data.full_name.trim()) return { error: "Name is required." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("contacts")
    .update({
      category: data.category,
      full_name: data.full_name.trim(),
      company: data.company?.trim() || null,
      role: data.role?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update rolling note — separate action for quick in-drawer save
// ---------------------------------------------------------------------------

export async function updateContactNote(
  id: string,
  note: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("contacts")
    .update({ note: note.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete contact — safe delete spec §10.7
//
// mode "soft":   Set is_deleted = true. Historical activity records are preserved
//                with their delegated_contact_id FK intact.
//
// mode "unlink": Set is_deleted = true AND null out delegated_contact_id on all
//                linked activities. Activities themselves are preserved.
// ---------------------------------------------------------------------------

export async function deleteContact(
  id: string,
  mode: "soft" | "unlink",
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (mode === "unlink") {
    // Null out delegated_contact_id on all linked activities first
    const { error: unlinkErr } = await supabase
      .from("activities")
      .update({ delegated_contact_id: null, updated_at: new Date().toISOString() })
      .eq("delegated_contact_id", id)
      .eq("user_id", user.id);

    if (unlinkErr) return { error: unlinkErr.message };
  }

  // Soft-delete the contact in both modes
  const { error } = await supabase
    .from("contacts")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Create delegated activity from Communication Planner contact card
// Spec §10.7: "quick actions: add delegated activity"
// Uses the same shared Activity model — no separate delegated task model.
// ---------------------------------------------------------------------------

export async function createDelegatedActivity(data: {
  contactId: string;
  title: string;
  activityDate: string;
  estimatedMinutes: number;
  linkedProjectId?: string | null;
  note?: string | null;
}): Promise<ActionResult> {
  if (!data.title.trim()) return { error: "Title is required." };
  if (!canCreateActivityOnDate(data.activityDate)) {
    return { error: "Cannot create activities in the past." };
  }
  if (data.estimatedMinutes <= 0) return { error: "Estimated time must be positive." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify the contact belongs to this user
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", data.contactId)
    .eq("user_id", user.id)
    .eq("is_deleted", false)
    .single();

  if (!contact) return { error: "Contact not found." };

  // If a project is specified, verify it belongs to this user
  if (data.linkedProjectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", data.linkedProjectId)
      .eq("user_id", user.id)
      .single();
    if (!project) return { error: "Project not found." };
  }

  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    section_type: "delegated",
    title: data.title.trim(),
    priority: null,
    activity_date: data.activityDate,
    estimated_minutes: data.estimatedMinutes,
    remaining_minutes: data.estimatedMinutes,
    status: "not_started",
    linked_project_id: data.linkedProjectId ?? null,
    delegated_contact_id: data.contactId,
    note: data.note?.trim() || null,
    origin_type: "manual",
    moved_from_date: null,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}
