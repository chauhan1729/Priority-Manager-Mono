"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function auth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/six-time-book");
}

/**
 * Save (upsert) the nightly review for a given day. Past days are allowed
 * (backfilling missed nights); future days are rejected. `todayISO` is the
 * caller's local today, used only to reject future-dated reviews.
 */
export async function saveNightlyReview(
  reviewDate: string,
  best: string[],
  worst: string[],
  todayISO?: string,
): Promise<{ error?: string }> {
  if (todayISO && reviewDate > todayISO) return { error: "Can't log a review for a future date." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const clean = (arr: string[]) =>
    arr.map((s) => s.trim().slice(0, 300)).filter(Boolean).slice(0, 25);

  const { error } = await supabase.from("six_time_nightly_reviews").upsert(
    {
      user_id: user.id,
      review_date: reviewDate,
      best: clean(best),
      worst: clean(worst),
      logged_at: new Date().toISOString(),
    },
    { onConflict: "user_id,review_date" },
  );
  if (error) return { error: error.message };

  revalidate();
  return {};
}
