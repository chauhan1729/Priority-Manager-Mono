import type { Metadata } from "next";

import type { Contact, Meeting } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MeetingPlannerView } from "@/components/meeting/MeetingPlannerView";

export const metadata: Metadata = { title: "Meeting Planner" };

/**
 * Spec §10.9: Meeting Planner — server component.
 *
 * Fetches in parallel:
 *   - All meetings for this user (ordered by date descending so newest/most relevant first)
 *   - All non-deleted contacts (for the contact selector in the create/edit form)
 *
 * Sync note: Meeting Planner is the single source of truth for Meeting records.
 * Communication Planner and (future) Calendar read from the same meetings table.
 * Mutations call revalidatePath for this page AND /communication-planner.
 */
export default async function MeetingPlannerPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // middleware handles redirect

  const [{ data: meetings }, { data: contacts }] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("start_at", { ascending: false }),

    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("full_name", { ascending: true }),
  ]);

  return (
    <MeetingPlannerView
      meetings={(meetings ?? []) as Meeting[]}
      contacts={(contacts ?? []) as Contact[]}
    />
  );
}
