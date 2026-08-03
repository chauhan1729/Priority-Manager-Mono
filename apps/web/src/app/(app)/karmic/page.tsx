import type { Metadata } from "next";

import { localTodayForTimezone } from "@pm/domain";
import {
  DEFAULT_ETHICS_PRINCIPLES,
  type KarmicEthicsCheckin,
  type KarmicEthicsPrinciple,
  type KarmicPartner,
  type KarmicPartnerAction,
  type SixTimeNightlyReview,
} from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KarmicHub } from "@/components/karmic/KarmicHub";

export const metadata: Metadata = { title: "Karmic Management" };

/**
 * Karmic Management hub — three tabs over one screen:
 *   Daily Log      — the guilt-free nightly best/worst review (+ backfill + history).
 *   Karmic Partners — the four fixed slots + a daily action to make each successful.
 *   Ethics Code    — the personal ethical code + a nightly kept/slipped check.
 * The Daily reading modal lives here too.
 */
export default async function KarmicPage() {
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

  const [
    { data: reviews },
    { data: partners },
    { data: partnerActions },
    { data: principlesRaw },
    { data: checkins },
  ] = await Promise.all([
    supabase
      .from("six_time_nightly_reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("review_date", { ascending: false }),
    supabase
      .from("karmic_partners")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("karmic_partner_actions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("karmic_ethics_principles")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase.from("karmic_ethics_checkins").select("*").eq("user_id", user.id),
  ]);

  // Seed the personal ethical code with the book's defaults on first visit.
  let principles = (principlesRaw ?? []) as KarmicEthicsPrinciple[];
  if (principles.length === 0) {
    const { data: seeded } = await supabase
      .from("karmic_ethics_principles")
      .insert(
        DEFAULT_ETHICS_PRINCIPLES.map((label, i) => ({
          user_id: user.id,
          label,
          sort_order: i,
        })),
      )
      .select("*");
    principles = (seeded ?? []) as KarmicEthicsPrinciple[];
  }

  return (
    <KarmicHub
      today={today}
      reviews={(reviews ?? []) as SixTimeNightlyReview[]}
      partners={(partners ?? []) as KarmicPartner[]}
      partnerActions={(partnerActions ?? []) as KarmicPartnerAction[]}
      principles={principles}
      checkins={(checkins ?? []) as KarmicEthicsCheckin[]}
    />
  );
}
