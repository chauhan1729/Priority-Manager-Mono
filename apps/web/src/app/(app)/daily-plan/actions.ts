"use server";

import { revalidatePath } from "next/cache";

import { canScheduleAt, checkScheduleOverlap, validateFocusMinutes, validateLockedMinutes } from "@pm/domain";
import type { ScheduleInstance } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { success: true } | { error: string };

function revalidateAll(linkedProjectId?: string | null) {
  revalidatePath("/daily-plan");
  revalidatePath("/activities");
  revalidatePath("/project-planner");
  if (linkedProjectId) revalidatePath(`/project-planner/${linkedProjectId}`);
}

/**
 * Spec §18.3: Schedule an activity into the Daily Plan timeline.
 * Creates a ScheduleInstance and decrements activity.remaining_minutes.
 *
 * startAt / endAt must be UTC ISO datetime strings (client computes from local time).
 */
export async function scheduleActivity(
  activityId: string,
  scheduleDate: string,
  startAt: string,
  endAt: string,
  focusMinutes: number,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 1. Validate not in the past
  if (!canScheduleAt(startAt)) {
    return { error: "Cannot schedule in the past" };
  }

  // 2. Compute locked_minutes from wall-clock duration
  const lockedMinutes = Math.round(
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000,
  );

  const lockedErr = validateLockedMinutes(lockedMinutes, startAt, endAt);
  if (lockedErr) return { error: lockedErr };

  // 3. Fetch activity — validate ownership and remaining time
  const { data: activity, error: actErr } = await supabase
    .from("activities")
    .select("id, remaining_minutes, estimated_minutes, linked_project_id, status, priority")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();

  if (actErr || !activity) return { error: "Activity not found" };
  if (activity.status === "completed" || activity.status === "cancelled") {
    return { error: "Cannot schedule a completed or cancelled activity" };
  }
  // Phase 0A: only A-priority activities are schedulable onto the timeline.
  // A B reaches the timeline only after being promoted to A.
  if (activity.priority !== "A") {
    return { error: "Only A-priority activities can be scheduled. Promote it to A first." };
  }

  const focusErr = validateFocusMinutes(focusMinutes, activity.remaining_minutes);
  if (focusErr) return { error: focusErr };

  // Bug §11: if remaining is 0 but activity is not completed, allow scheduling extra time.
  // Extra blocks will increase hours_worked without changing estimated_minutes.
  const isOverwork = activity.remaining_minutes === 0;

  // 4. Fetch existing instances for overlap check
  const { data: existing } = await supabase
    .from("schedule_instances")
    .select("id, start_at, end_at, source_activity_id, source_meeting_id, source_event_id, source_type, schedule_date, locked_minutes, focus_minutes, status_snapshot, keep_as_history, note, created_at, updated_at, user_id")
    .eq("user_id", user.id)
    .eq("schedule_date", scheduleDate);

  const { overlaps, conflictingInstances } = checkScheduleOverlap(
    existing ?? [],
    startAt,
    endAt,
  );

  if (overlaps) {
    return {
      error: `Time slot conflicts with ${conflictingInstances.length} existing block(s)`,
    };
  }

  // 5. Insert schedule instance
  const { error: insertErr } = await supabase.from("schedule_instances").insert({
    user_id: user.id,
    source_type: "activity",
    source_activity_id: activityId,
    source_meeting_id: null,
    source_event_id: null,
    schedule_date: scheduleDate,
    start_at: startAt,
    end_at: endAt,
    locked_minutes: lockedMinutes,
    focus_minutes: focusMinutes,
    status_snapshot: "upcoming",
    keep_as_history: true,
  });

  if (insertErr) return { error: insertErr.message };

  // 6. Decrement remaining_minutes on activity.
  // Bug §11: if this is "overwork" (remaining was 0), don't touch remaining_minutes
  // — extra scheduled time will be credited to hours_worked on block completion.
  if (!isOverwork) {
    const newRemaining = Math.max(0, activity.remaining_minutes - focusMinutes);
    await supabase
      .from("activities")
      .update({ remaining_minutes: newRemaining, updated_at: new Date().toISOString() })
      .eq("id", activityId)
      .eq("user_id", user.id);
  }

  revalidateAll(activity.linked_project_id);
  return { success: true };
}

/**
 * Phase 4 (revised cycles): "start a cycle" = drop a timed focus block on the timeline
 * for the chosen duration. Unlike planned scheduling, this is allowed for B's too (you're actively
 * choosing to work it).
 *
 * @param startAtIso  null → start NOW (block opens in "working" state).
 *                    ISO datetime → schedule for LATER (block is "upcoming"; must be in the future).
 * @param scheduleDateArg  local date the block belongs to (defaults to today / the start's date).
 */
export async function startCycleBlock(
  activityId: string,
  durationMinutes: number,
  note?: string,
  startAtIso?: string | null,
  scheduleDateArg?: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Pick a duration." };
  }
  const dur = Math.min(Math.round(durationMinutes), 600); // cap at 10h

  const startsNow = !startAtIso;
  let startDate: Date;
  if (startsNow) {
    startDate = new Date();
  } else {
    startDate = new Date(startAtIso as string);
    if (Number.isNaN(startDate.getTime())) return { error: "Invalid start time." };
  }
  const startAt = startDate.toISOString();
  const endAt = new Date(startDate.getTime() + dur * 60_000).toISOString();
  const scheduleDate = scheduleDateArg ?? startAt.slice(0, 10);

  // Past-time rule: a "later" cycle cannot be placed in the past.
  if (!startsNow && !canScheduleAt(startAt)) {
    return { error: "Cannot start a cycle in the past. Pick a future time." };
  }

  const { data: activity, error: actErr } = await supabase
    .from("activities")
    .select("id, remaining_minutes, status, linked_project_id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();
  if (actErr || !activity) return { error: "Activity not found" };
  if (activity.status === "completed" || activity.status === "cancelled") {
    return { error: "Cannot start a cycle on a completed or cancelled activity" };
  }

  // Overlap check against today's blocks.
  const { data: existing } = await supabase
    .from("schedule_instances")
    .select("id, start_at, end_at, source_activity_id, source_meeting_id, source_event_id, source_type, schedule_date, locked_minutes, focus_minutes, status_snapshot, keep_as_history, note, created_at, updated_at, user_id")
    .eq("user_id", user.id)
    .eq("schedule_date", scheduleDate);

  const { overlaps, conflictingInstances } = checkScheduleOverlap(existing ?? [], startAt, endAt);
  if (overlaps) {
    return { error: `That time overlaps ${conflictingInstances.length} existing block(s). Finish or move it first.` };
  }

  const { error: insertErr } = await supabase.from("schedule_instances").insert({
    user_id: user.id,
    source_type: "activity",
    source_activity_id: activityId,
    source_meeting_id: null,
    source_event_id: null,
    schedule_date: scheduleDate,
    start_at: startAt,
    end_at: endAt,
    locked_minutes: dur,
    focus_minutes: dur,
    // Now → you're focusing immediately; Later → a planned, upcoming block.
    status_snapshot: startsNow ? "working" : "upcoming",
    keep_as_history: true,
    note: note?.trim() ? note.trim() : null,
  });
  if (insertErr) return { error: insertErr.message };

  // Consume remaining time either way (a future cycle is committed time, like planned scheduling).
  // Only flip the activity into "working" when the cycle starts now.
  const newRemaining = activity.remaining_minutes > 0
    ? Math.max(0, activity.remaining_minutes - dur)
    : 0;
  await supabase
    .from("activities")
    .update({
      ...(startsNow ? { status: "working" } : {}),
      remaining_minutes: newRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);

  revalidateAll(activity.linked_project_id);
  return { success: true };
}

/**
 * For a (possibly recurring) appointment occurrence on a given day: find its schedule_instance, or
 * materialize one on demand, so the user can manage/complete it for that specific day.
 */
export async function ensureAppointmentInstance(
  eventId: string,
  scheduleDate: string,
  startAt: string,
  endAt: string,
  sourceType: "appointment" | "other",
): Promise<{ instance: ScheduleInstance } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("schedule_instances")
    .select("*")
    .eq("user_id", user.id)
    .eq("source_event_id", eventId)
    .eq("schedule_date", scheduleDate)
    .maybeSingle();
  if (existing) return { instance: existing as ScheduleInstance };

  const lockedMinutes =
    Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000) || 30;
  const { data: inserted, error } = await supabase
    .from("schedule_instances")
    .insert({
      user_id: user.id,
      source_type: sourceType,
      source_activity_id: null,
      source_meeting_id: null,
      source_event_id: eventId,
      schedule_date: scheduleDate,
      start_at: startAt,
      end_at: endAt,
      locked_minutes: lockedMinutes,
      focus_minutes: null,
      status_snapshot: "upcoming",
      keep_as_history: true,
    })
    .select("*")
    .single();
  if (error || !inserted) return { error: error?.message ?? "Could not open appointment" };

  revalidateAll();
  return { instance: inserted as ScheduleInstance };
}

/**
 * Phase 0A: promote a B activity to A directly from the Daily Plan, so it becomes schedulable.
 * Intended for use once the day's A's are completed and the user wants to pull a B forward.
 */
export async function promoteActivityToA(activityId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: activity, error: actErr } = await supabase
    .from("activities")
    .select("id, linked_project_id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();
  if (actErr || !activity) return { error: "Activity not found" };

  const { error } = await supabase
    .from("activities")
    .update({ priority: "A", updated_at: new Date().toISOString() })
    .eq("id", activityId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateAll(activity.linked_project_id);
  return { success: true };
}

/**
 * Remove a scheduled block from the timeline.
 * Only allowed for future blocks (past blocks are kept as history per spec).
 * Restores focus_minutes back to activity.remaining_minutes.
 */
export async function unscheduleActivity(
  instanceId: string,
  activityId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch instance to get focus_minutes and validate ownership
  const { data: instance, error: instErr } = await supabase
    .from("schedule_instances")
    .select("id, start_at, focus_minutes, source_activity_id")
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .single();

  if (instErr || !instance) return { error: "Schedule block not found" };

  // Only allow removing future blocks — past blocks kept as history
  if (!canScheduleAt(instance.start_at)) {
    return { error: "Cannot remove a past scheduled block (kept as history)" };
  }

  // Fetch activity to restore remaining_minutes
  const { data: activity } = await supabase
    .from("activities")
    .select("remaining_minutes, estimated_minutes, linked_project_id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();

  // Delete the instance
  const { error: delErr } = await supabase
    .from("schedule_instances")
    .delete()
    .eq("id", instanceId)
    .eq("user_id", user.id);

  if (delErr) return { error: delErr.message };

  // Restore remaining_minutes (capped at estimated)
  if (activity && instance.focus_minutes) {
    const restored = Math.min(
      activity.remaining_minutes + instance.focus_minutes,
      activity.estimated_minutes,
    );
    await supabase
      .from("activities")
      .update({ remaining_minutes: restored, updated_at: new Date().toISOString() })
      .eq("id", activityId)
      .eq("user_id", user.id);
  }

  revalidateAll(activity?.linked_project_id);
  return { success: true };
}

/**
 * Update the status_snapshot on a schedule block and sync to the activity.
 * Spec §10.6: "activity status updates from Daily Plan sync back to Activities and Project Planner."
 */
export async function updateScheduleBlockStatus(
  instanceId: string,
  status: "upcoming" | "working" | "completed" | "postponed" | "missed",
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch instance — need start_at, end_at, focus_minutes to handle early completion
  const { data: instance } = await supabase
    .from("schedule_instances")
    .select("source_activity_id, source_type, start_at, end_at, focus_minutes, locked_minutes")
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .single();

  const now = new Date();

  // For early completion: compute actual elapsed time
  let blockUpdate: Record<string, unknown> = {
    status_snapshot: status,
    updated_at: now.toISOString(),
  };
  let earlyCompletionUnworkedMinutes = 0;

  if (status === "completed" && instance) {
    const focusMinutes: number = instance.focus_minutes ?? instance.locked_minutes ?? 0;
    const endMs = new Date(instance.end_at).getTime();
    const isEarlyCompletion = now.getTime() < endMs;

    if (isEarlyCompletion) {
      // Block completed before its scheduled end — truncate the block
      const startMs = new Date(instance.start_at).getTime();
      const elapsed = Math.max(1, Math.floor((now.getTime() - startMs) / 60_000));
      const workedNow = Math.min(elapsed, focusMinutes);
      earlyCompletionUnworkedMinutes = focusMinutes - workedNow;

      blockUpdate = {
        ...blockUpdate,
        end_at: now.toISOString(),
        locked_minutes: workedNow,
        focus_minutes: workedNow,
      };
    }
  }

  // Update the schedule block
  const { error } = await supabase
    .from("schedule_instances")
    .update(blockUpdate)
    .eq("id", instanceId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Sync to activity status — map block status to activity status
  if (instance?.source_type === "activity" && instance.source_activity_id) {
    const { data: activity } = await supabase
      .from("activities")
      .select("linked_project_id, hours_worked, estimated_minutes, remaining_minutes")
      .eq("id", instance.source_activity_id)
      .eq("user_id", user.id)
      .single();

    // When a block completes, credit its worked time to hours_worked.
    // For early completions, credit only elapsed time and restore unworked portion to remaining.
    // Only mark the ACTIVITY as completed if all estimated time is now worked.
    if (status === "completed" && activity) {
      const { data: blockData } = await supabase
        .from("schedule_instances")
        .select("focus_minutes, locked_minutes")
        .eq("id", instanceId)
        .eq("user_id", user.id)
        .single();

      // focus_minutes on the block is now the actual worked time (updated above for early completions)
      const workedMinutes = blockData?.focus_minutes ?? blockData?.locked_minutes ?? 0;
      const newHoursWorked = (activity.hours_worked ?? 0) + workedMinutes;
      // Restore unworked portion to remaining (for early completions earlyCompletionUnworkedMinutes > 0).
      // Cap at estimated - hours_worked so we never over-restore.
      const newRemaining = Math.min(
        Math.max(0, activity.remaining_minutes + earlyCompletionUnworkedMinutes),
        activity.estimated_minutes - newHoursWorked,
      );
      // Only mark activity "completed" if all estimated time has been worked.
      const newActivityStatus = newRemaining === 0 ? "completed" : "working";

      await supabase
        .from("activities")
        .update({
          status: newActivityStatus,
          hours_worked: newHoursWorked,
          remaining_minutes: newRemaining,
          updated_at: now.toISOString(),
        })
        .eq("id", instance.source_activity_id)
        .eq("user_id", user.id);

      revalidateAll(activity.linked_project_id);
      return { success: true };
    }

    // Non-completed statuses: map directly (no hours_worked change)
    const activityStatusMap: Record<string, string | null> = {
      working: "working",
      postponed: "postponed",
      missed: "not_started", // keep reschedulable
      upcoming: null, // no change
    };
    const activityStatus = activityStatusMap[status];
    if (activityStatus) {
      await supabase
        .from("activities")
        .update({ status: activityStatus, updated_at: new Date().toISOString() })
        .eq("id", instance.source_activity_id)
        .eq("user_id", user.id);

      revalidateAll(activity?.linked_project_id);
      return { success: true };
    }
  }

  revalidatePath("/daily-plan");
  return { success: true };
}

/**
 * Handle moving a currently-running block back to unscheduled.
 *
 * mode "full"  — Delete the block entirely; restore all focus_minutes to remaining.
 * mode "split" — Truncate the block to the elapsed time and mark it "completed";
 *                restore the unelapsed portion (focus_minutes - elapsed) to remaining.
 */
export async function unscheduleRunningBlock(
  instanceId: string,
  activityId: string,
  mode: "full" | "split",
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: instance, error: instErr } = await supabase
    .from("schedule_instances")
    .select("id, start_at, end_at, focus_minutes, locked_minutes, source_activity_id")
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .single();

  if (instErr || !instance) return { error: "Schedule block not found" };

  const now = new Date();
  const startMs = new Date(instance.start_at).getTime();
  const elapsedMin = Math.max(1, Math.floor((now.getTime() - startMs) / 60_000));
  const focusMin: number = instance.focus_minutes ?? instance.locked_minutes;
  const remainingMin = Math.max(0, focusMin - elapsedMin);

  const { data: activity } = await supabase
    .from("activities")
    .select("remaining_minutes, estimated_minutes, linked_project_id, hours_worked")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();

  if (!activity) return { error: "Activity not found" };

  if (mode === "full") {
    // Delete the block and restore all focus_minutes
    const { error: delErr } = await supabase
      .from("schedule_instances")
      .delete()
      .eq("id", instanceId)
      .eq("user_id", user.id);

    if (delErr) return { error: delErr.message };

    const restored = Math.min(activity.remaining_minutes + focusMin, activity.estimated_minutes);
    await supabase
      .from("activities")
      .update({ remaining_minutes: restored, updated_at: now.toISOString() })
      .eq("id", activityId)
      .eq("user_id", user.id);
  } else {
    // Split: truncate the block to elapsed time, mark completed
    const { error: updErr } = await supabase
      .from("schedule_instances")
      .update({
        end_at: now.toISOString(),
        locked_minutes: elapsedMin,
        focus_minutes: elapsedMin,
        status_snapshot: "completed",
        updated_at: now.toISOString(),
      })
      .eq("id", instanceId)
      .eq("user_id", user.id);

    if (updErr) return { error: updErr.message };

    // Credit elapsed time to hours_worked; restore unelapsed portion to remaining
    const activityUpdate: Record<string, unknown> = {
      hours_worked: (activity.hours_worked ?? 0) + elapsedMin,
      updated_at: now.toISOString(),
    };
    if (remainingMin > 0) {
      activityUpdate.remaining_minutes = Math.min(
        activity.remaining_minutes + remainingMin,
        activity.estimated_minutes,
      );
    }
    await supabase
      .from("activities")
      .update(activityUpdate)
      .eq("id", activityId)
      .eq("user_id", user.id);
  }

  revalidateAll(activity.linked_project_id);
  return { success: true };
}

/**
 * Postpone a scheduled or unscheduled activity to another date from Daily Plan.
 * Syncs with Activities tab and Project Planner.
 * First-move-wins: preserves original moved_from_date.
 */
export async function postponeFromDailyPlan(
  activityId: string,
  toDate: string,
  currentDate: string,
  linkedProjectId: string | null,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("activities")
    .select("moved_from_date")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();

  const movedFromDate = existing?.moved_from_date ?? currentDate;

  const { error } = await supabase
    .from("activities")
    .update({
      activity_date: toDate,
      status: "postponed",
      moved_from_date: movedFromDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll(linkedProjectId);
  return { success: true };
}
