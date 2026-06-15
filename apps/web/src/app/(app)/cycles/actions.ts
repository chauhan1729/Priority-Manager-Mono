"use server";

import { revalidatePath } from "next/cache";

import {
  abandonCycle,
  buildCycleStart,
  canStartCycle,
  completeCycle,
  resumeCycle,
  takeMiniBreak,
} from "@pm/domain";
import type { Cycle } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CycleResult = { cycle: Cycle } | { error: string };

async function auth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/daily-plan");
  revalidatePath("/activities/a");
  revalidatePath("/activities/b");
}

/**
 * Phase 1A: start a fresh cycle for an activity, or return the existing active one
 * (focus/break) so the panel never creates duplicate concurrent cycles.
 */
export async function startOrResumeCycle(activityId: string): Promise<CycleResult> {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated" };

  const { data: activity, error: actErr } = await supabase
    .from("activities")
    .select("id, estimated_minutes, activity_date, status")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();
  if (actErr || !activity) return { error: "Activity not found" };

  // Resume an already-active cycle if one exists.
  const { data: existing } = await supabase
    .from("cycles")
    .select("*")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .in("phase", ["focus", "break"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { cycle: existing as Cycle };

  if (!canStartCycle(activity)) {
    return { error: "Cannot start a cycle for a past or finished activity." };
  }

  const start = buildCycleStart({ activity, nowISO: new Date().toISOString() });
  const { data: inserted, error: insErr } = await supabase
    .from("cycles")
    .insert({ ...start, user_id: user.id })
    .select("*")
    .single();
  if (insErr || !inserted) return { error: insErr?.message ?? "Could not start cycle" };

  revalidate();
  return { cycle: inserted as Cycle };
}

/** Fetch a cycle owned by the current user. */
async function loadCycle(cycleId: string) {
  const { supabase, user } = await auth();
  if (!user) return { error: "Not authenticated" as const };
  const { data: cycle, error } = await supabase
    .from("cycles")
    .select("*")
    .eq("id", cycleId)
    .eq("user_id", user.id)
    .single();
  if (error || !cycle) return { error: "Cycle not found" as const };
  return { supabase, user, cycle: cycle as Cycle };
}

const CYCLE_UPDATE_KEYS = [
  "elapsed_focus_minutes",
  "segment_started_at",
  "break_count",
  "phase",
  "completed_at",
  "note",
  "updated_at",
] as const;

async function persist(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  next: Cycle,
): Promise<CycleResult> {
  const patch = Object.fromEntries(
    CYCLE_UPDATE_KEYS.map((k) => [k, next[k]]),
  );
  const { error } = await supabase
    .from("cycles")
    .update(patch)
    .eq("id", next.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidate();
  return { cycle: next };
}

export async function breakCycle(cycleId: string): Promise<CycleResult> {
  const loaded = await loadCycle(cycleId);
  if ("error" in loaded) return { error: loaded.error };
  const next = takeMiniBreak(loaded.cycle, new Date().toISOString());
  return persist(loaded.supabase, loaded.user.id, next);
}

export async function resumeCycleAction(cycleId: string): Promise<CycleResult> {
  const loaded = await loadCycle(cycleId);
  if ("error" in loaded) return { error: loaded.error };
  const next = resumeCycle(loaded.cycle, new Date().toISOString());
  return persist(loaded.supabase, loaded.user.id, next);
}

export async function completeCycleAction(cycleId: string, note?: string): Promise<CycleResult> {
  const loaded = await loadCycle(cycleId);
  if ("error" in loaded) return { error: loaded.error };
  const next = completeCycle(loaded.cycle, new Date().toISOString(), note);
  const result = await persist(loaded.supabase, loaded.user.id, next);
  if ("cycle" in result && next.elapsed_focus_minutes > 0) {
    // Credit focus time to the activity's worked total (cycles aren't linked to a schedule block,
    // so there's no double-count with block completion).
    const { data: act } = await loaded.supabase
      .from("activities")
      .select("hours_worked, linked_project_id")
      .eq("id", next.activity_id)
      .eq("user_id", loaded.user.id)
      .single();
    if (act) {
      await loaded.supabase
        .from("activities")
        .update({
          hours_worked: (act.hours_worked ?? 0) + next.elapsed_focus_minutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", next.activity_id)
        .eq("user_id", loaded.user.id);
      if (act.linked_project_id) revalidatePath(`/project-planner/${act.linked_project_id}`);
    }
  }
  return result;
}

export async function abandonCycleAction(cycleId: string): Promise<CycleResult> {
  const loaded = await loadCycle(cycleId);
  if ("error" in loaded) return { error: loaded.error };
  const next = abandonCycle(loaded.cycle, new Date().toISOString());
  return persist(loaded.supabase, loaded.user.id, next);
}
