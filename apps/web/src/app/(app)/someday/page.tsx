import type { Metadata } from "next";

import type { Activity, Project } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SomedayView } from "@/components/someday/SomedayView";

export const metadata: Metadata = { title: "Someday" };

/**
 * Phase 1B: the Someday list — items parked outside the rolling 30-day horizon ("the Kevin list"),
 * reviewed weekly. Pull anything ready into the next 30 days.
 */
export default async function SomedayPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: items }, { data: projects }] = await Promise.all([
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_someday", true)
      .eq("archived", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .not("status", "in", "(cancelled,completed)")
      .order("name", { ascending: true }),
  ]);

  return (
    <SomedayView
      items={(items ?? []) as Activity[]}
      projects={(projects ?? []) as Pick<Project, "id" | "name" | "status">[]}
    />
  );
}
