"use server";

import { revalidatePath } from "next/cache";

import type { GivingCategory } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function auth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/giving");
  revalidatePath("/daily-plan");
}

/** Start a 90-day giving challenge (rejects if one is already active). */
export async function startGivingChallenge(startDate: string): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const { data: existing } = await supabase
    .from("giving_challenges")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return { error: "You already have an active challenge." };

  const { error } = await supabase.from("giving_challenges").insert({
    user_id: user.id,
    start_date: startDate,
    mode: "challenge",
    status: "active",
  });
  if (error) return { error: error.message };

  revalidate();
  return {};
}

/**
 * Add one give/receive/cognition log (separate items; many allowed per day).
 * Past dates are allowed (backfilling missed days); future dates are rejected.
 * `todayISO` is the caller's local today, used only to reject future entries.
 */
export async function addGivingLog(
  challengeId: string,
  entryDate: string,
  kind: "given" | "received" | "cognition",
  content: string,
  categories: GivingCategory[],
  givenInSecret: boolean,
  todayISO?: string,
): Promise<{ error?: string }> {
  if (!content.trim()) return { error: "Write something to log." };
  if (kind === "given" && categories.length === 0) return { error: "Pick at least one category." };
  if (todayISO && entryDate > todayISO) return { error: "Can't log giving for a future date." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase.from("giving_logs").insert({
    user_id: user.id,
    challenge_id: challengeId,
    entry_date: entryDate,
    kind,
    content: content.trim().slice(0, 200),
    categories: kind === "given" ? categories : [],
    given_in_secret: kind === "given" ? givenInSecret : false,
  });
  if (error) return { error: error.message };

  revalidate();
  return {};
}

/**
 * Reset Giving: delete all giving records (logs + challenges) for the user,
 * returning the screen to a clean start. Destructive — guard with a confirm in the UI.
 */
export async function resetGiving(): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const { error: logErr } = await supabase.from("giving_logs").delete().eq("user_id", user.id);
  if (logErr) return { error: logErr.message };

  const { error: challengeErr } = await supabase
    .from("giving_challenges")
    .delete()
    .eq("user_id", user.id);
  if (challengeErr) return { error: challengeErr.message };

  revalidate();
  return {};
}

/** Remove a single log. */
export async function deleteGivingLog(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase.from("giving_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Apply the Day-91 review: complete the challenge; if continuing, start a fresh continuous one. */
export async function completeGivingReview(
  challengeId: string,
  continueDecision: boolean,
  newStartDate: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const nowISO = new Date().toISOString();
  const { error } = await supabase
    .from("giving_challenges")
    .update({
      status: "completed",
      reviewed_at: nowISO,
      continue_decision: continueDecision,
      updated_at: nowISO,
    })
    .eq("id", challengeId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  if (continueDecision) {
    const { error: insErr } = await supabase.from("giving_challenges").insert({
      user_id: user.id,
      start_date: newStartDate,
      mode: "continuous",
      status: "active",
    });
    if (insErr) return { error: insErr.message };
  }

  revalidate();
  return {};
}
