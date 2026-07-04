import type { Metadata } from "next";

import { localTodayForTimezone } from "@pm/domain";
import type { SixTimeNightlyReview } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SixTimeBookView } from "@/components/six-time/SixTimeBookView";

export const metadata: Metadata = { title: "Nightly Review" };

/**
 * The Six-Time Book, simplified to the nightly review: a guilt-free best-3+/worst-3+
 * log of the day (add as many as you like). The Daily reading modal lives here too.
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

  const { data: nightly } = await supabase
    .from("six_time_nightly_reviews")
    .select("*")
    .eq("user_id", user.id)
    .eq("review_date", today)
    .maybeSingle();

  return <SixTimeBookView today={today} nightly={(nightly ?? null) as SixTimeNightlyReview | null} />;
}
