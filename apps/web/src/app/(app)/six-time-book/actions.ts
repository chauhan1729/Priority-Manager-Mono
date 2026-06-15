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
 * Set (or swap) the focus problem at a position 1–3: retire any active problem there, insert the new one.
 */
export async function saveSixTimeProblem(
  position: number,
  problem: string,
  solution: string,
  reminderPhrase: string,
): Promise<{ error?: string }> {
  if (position < 1 || position > 3) return { error: "Invalid position." };
  if (!problem.trim() || !solution.trim() || !reminderPhrase.trim()) {
    return { error: "Problem, solution, and reminder phrase are all required." };
  }
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const nowISO = new Date().toISOString();
  // Retire the current active problem at this position (if any).
  await supabase
    .from("six_time_problems")
    .update({ status: "retired", retired_at: nowISO, updated_at: nowISO })
    .eq("user_id", user.id)
    .eq("position", position)
    .eq("status", "active");

  const { error } = await supabase.from("six_time_problems").insert({
    user_id: user.id,
    position,
    problem: problem.trim(),
    solution: solution.trim(),
    reminder_phrase: reminderPhrase.trim(),
    status: "active",
  });
  if (error) return { error: error.message };

  revalidate();
  return {};
}

/** Save (upsert) a slot entry for a given day. */
export async function saveSlotEntry(
  entryDate: string,
  slotIndex: number,
  problemId: string,
  plus: string,
  minus: string,
  todo: string,
): Promise<{ error?: string }> {
  if (slotIndex < 1 || slotIndex > 6) return { error: "Invalid slot." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const trim = (s: string) => (s.trim() ? s.trim().slice(0, 140) : null);
  const { error } = await supabase.from("six_time_entries").upsert(
    {
      user_id: user.id,
      entry_date: entryDate,
      slot_index: slotIndex,
      problem_id: problemId,
      plus: trim(plus),
      minus: trim(minus),
      todo: trim(todo),
      logged_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entry_date,slot_index" },
  );
  if (error) return { error: error.message };

  revalidate();
  return {};
}

/** Save (upsert) the nightly review for a given day. */
export async function saveNightlyReview(
  reviewDate: string,
  best: string[],
  worst: string[],
): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const clean = (arr: string[]) =>
    arr.map((s) => s.trim().slice(0, 140)).filter(Boolean).slice(0, 3);

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
