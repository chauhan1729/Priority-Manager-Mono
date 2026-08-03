"use server";

import { revalidatePath } from "next/cache";

import { isFutureLogDate, isValidPartnerGroup } from "@pm/domain";
import { MAX_PARTNERS_PER_GROUP, type KarmicPartnerGroup } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function auth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/karmic");
}

// --- Nightly Review (Daily Log tab) ----------------------------------------
/**
 * Save (upsert) the nightly review for a day. Past days allowed (backfill);
 * future days rejected. `todayISO` is the caller's local today.
 */
export async function saveNightlyReview(
  reviewDate: string,
  best: string[],
  worst: string[],
  todayISO?: string,
): Promise<{ error?: string }> {
  if (todayISO && isFutureLogDate(reviewDate, todayISO))
    return { error: "Can't log a review for a future date." };
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

// --- Karmic Partners tab ---------------------------------------------------
const trim = (v: string | null, max: number) => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
};

/** Add a new partner to a group (up to the per-group cap). Requires a name. */
export async function addPartner(
  group: KarmicPartnerGroup,
  name: string | null,
  successVision: string | null,
): Promise<{ error?: string }> {
  if (!isValidPartnerGroup(group)) return { error: "Invalid partner group." };
  const cleanName = trim(name, 120);
  if (!cleanName) return { error: "Give your partner a name." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  // Enforce the soft cap and compute the next sort position within the group.
  const { data: existing } = await supabase
    .from("karmic_partners")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("partner_group", group)
    .eq("status", "active");
  if ((existing?.length ?? 0) >= MAX_PARTNERS_PER_GROUP)
    return { error: `You can keep up to ${MAX_PARTNERS_PER_GROUP} here at a time.` };
  const nextOrder =
    (existing ?? []).reduce((m: number, r: { sort_order: number }) => Math.max(m, r.sort_order), -1) + 1;

  const { error } = await supabase.from("karmic_partners").insert({
    user_id: user.id,
    partner_group: group,
    name: cleanName,
    success_vision: trim(successVision, 500),
    sort_order: nextOrder,
  });
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Edit an existing partner's who + success vision. */
export async function updatePartner(
  id: string,
  name: string | null,
  successVision: string | null,
): Promise<{ error?: string }> {
  const cleanName = trim(name, 120);
  if (!cleanName) return { error: "Give your partner a name." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("karmic_partners")
    .update({ name: cleanName, success_vision: trim(successVision, 500), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Delete a partner and all their actions (FK cascade). Permanent. */
export async function deletePartner(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("karmic_partners")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Add one "what I'll do today" action for a specific partner. Future dates rejected. */
export async function addPartnerAction(
  partnerId: string,
  group: KarmicPartnerGroup,
  actionDate: string,
  text: string,
  todayISO?: string,
): Promise<{ error?: string }> {
  if (!isValidPartnerGroup(group)) return { error: "Invalid partner group." };
  if (todayISO && isFutureLogDate(actionDate, todayISO))
    return { error: "Can't plan an action for a future date." };
  const clean = text.trim().slice(0, 300);
  if (!clean) return { error: "Write something first." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase.from("karmic_partner_actions").insert({
    user_id: user.id,
    partner_id: partnerId,
    partner_group: group,
    action_date: actionDate,
    text: clean,
  });
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Toggle an action's done flag. */
export async function togglePartnerAction(
  id: string,
  done: boolean,
): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("karmic_partner_actions")
    .update({ done, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Delete one action. */
export async function deletePartnerAction(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("karmic_partner_actions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}

// --- Ethics Code tab -------------------------------------------------------
/** Add a new principle to the personal code (sorted after the current last). */
export async function addEthicsPrinciple(label: string): Promise<{ error?: string }> {
  const clean = label.trim().slice(0, 300);
  if (!clean) return { error: "Write a principle first." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };

  const { data: last } = await supabase
    .from("karmic_ethics_principles")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("karmic_ethics_principles").insert({
    user_id: user.id,
    label: clean,
    sort_order: nextOrder,
  });
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Edit a principle's text. */
export async function updateEthicsPrinciple(
  id: string,
  label: string,
): Promise<{ error?: string }> {
  const clean = label.trim().slice(0, 300);
  if (!clean) return { error: "Principle can't be empty." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("karmic_ethics_principles")
    .update({ label: clean, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Retire (or restore) a principle without deleting its history. */
export async function setEthicsPrincipleActive(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("karmic_ethics_principles")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}

/** Upsert tonight's kept/slipped check + note for one principle. Future dates rejected. */
export async function saveEthicsCheckin(
  checkinDate: string,
  principleId: string,
  kept: boolean,
  note: string | null,
  todayISO?: string,
): Promise<{ error?: string }> {
  if (todayISO && isFutureLogDate(checkinDate, todayISO))
    return { error: "Can't check a future date." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase.from("karmic_ethics_checkins").upsert(
    {
      user_id: user.id,
      checkin_date: checkinDate,
      principle_id: principleId,
      kept,
      note: (note ?? "").trim().slice(0, 300) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,checkin_date,principle_id" },
  );
  if (error) return { error: error.message };
  revalidate();
  return {};
}
