import type { Metadata } from "next";

import { localTodayForTimezone } from "@pm/domain";
import type { SixTimeEntry, SixTimeNightlyReview, SixTimeProblem } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SixTimeBookView } from "@/components/six-time/SixTimeBookView";

export const metadata: Metadata = { title: "Six-Time Book" };

/**
 * Phase 4: the Six-Time Book (tundruk) — three focus problems cycled across six daily slots
 * (each logging +/−/to-do), plus a nightly best-3 / worst-3 review. Short, specific, guilt-free.
 */
export default async function SixTimeBookPage() {
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

  const [{ data: problems }, { data: entries }, { data: nightly }] = await Promise.all([
    supabase
      .from("six_time_problems")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("position", { ascending: true }),
    supabase
      .from("six_time_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("entry_date", today),
    supabase
      .from("six_time_nightly_reviews")
      .select("*")
      .eq("user_id", user.id)
      .eq("review_date", today)
      .maybeSingle(),
  ]);

  return (
    <SixTimeBookView
      today={today}
      problems={(problems ?? []) as SixTimeProblem[]}
      entries={(entries ?? []) as SixTimeEntry[]}
      nightly={(nightly ?? null) as SixTimeNightlyReview | null}
    />
  );
}
