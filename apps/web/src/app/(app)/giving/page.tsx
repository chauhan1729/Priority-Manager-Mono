import type { Metadata } from "next";

import { localTodayForTimezone } from "@pm/domain";
import type { GivingChallenge, GivingLog } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GivingView } from "@/components/giving/GivingView";

export const metadata: Metadata = { title: "Giving" };

/** Phase 5: the 90-Day Karma Scorecard — give daily and keep score. */
export default async function GivingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const today = localTodayForTimezone(profile?.timezone ?? "UTC");

  const { data: challenge } = await supabase
    .from("giving_challenges")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  let logs: GivingLog[] = [];
  if (challenge) {
    const { data } = await supabase
      .from("giving_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .order("created_at", { ascending: true });
    logs = (data ?? []) as GivingLog[];
  }

  return (
    <GivingView today={today} challenge={(challenge ?? null) as GivingChallenge | null} logs={logs} />
  );
}
