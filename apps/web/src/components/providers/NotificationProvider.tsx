"use client";

/**
 * NotificationProvider
 * Spec §13: client-side bridge that polls for due reminders on mount and
 * on page-focus, shows browser notifications, and surfaces in-app banners
 * for meetings that have passed without a status update.
 *
 * Cross-device deduplication uses reminder_instances table in Supabase:
 * - On each check, fetch today's fired reminder_instances for the user.
 * - Only fire reminders whose (type, source_id) pair has no instance row.
 * - After firing, insert a reminder_instance row so other devices see it.
 *
 * Client-side dedup via localStorage provides instant feedback on refresh.
 * Supabase dedup provides cross-device correctness.
 */

import { useCallback, useEffect } from "react";

import {
  addDays,
  buildOutboxRows,
  computeAllReminders,
  filterUnfiredReminders,
  type ComputeRemindersParams,
  type ReminderSchedule,
} from "@pm/domain";
import type { NotificationSound, ReminderPreference } from "@pm/types";


import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { showToast } from "@/components/ui/Toaster";
import {
  fireNewOverdueReminders,
  type SoundConfig,
} from "@/lib/notifications/web-notifications";
import { ensureWebPushSubscribed } from "@/lib/notifications/web-push";

/** How often the foreground checks for newly-due reminders (ms). */
const CHECK_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const checkReminders = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch reminder preferences. Select "*" so every reminder-gating column is
    // present — a narrowed list silently disabled someday/meeting-prep/giving
    // reminders (their prefs came back undefined → gated off).
    const { data: prefsData } = await supabase
      .from("reminder_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!prefsData) return;
    const prefs = prefsData as ReminderPreference;


    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);

    // Fetch today's already-fired reminder_instances (cross-device dedup)
    const { data: firedInstances } = await supabase
      .from("reminder_instances")
      .select("reminder_type, source_id")
      .eq("user_id", user.id)
      .gte("scheduled_for", `${todayISO}T00:00:00Z`)
      .lte("scheduled_for", `${todayISO}T23:59:59Z`)
      .not("fired_at", "is", null);

    // Parallel data fetches for reminder sources
    const [meetingsResult, expensesResult, yearEntriesResult, scheduleInstancesResult, activitiesResult, calendarEventsResult, sixTimeConfigResult, sixTimeProblemsResult, givingChallengeResult] = await Promise.all([
      supabase
        // Phase 2B: widen to the prep window (today … +14d) so "prepare for meeting" reminders
        // can fire ahead of the meeting. Today-only time-window reminders still behave correctly.
        .from("meetings")
        .select("id, title, date, start_at, end_at, status, key_takeaways")
        .eq("user_id", user.id)
        .gte("date", todayISO)
        .lte("date", addDays(todayISO, 14))
        .in("status", ["upcoming"]),
      supabase
        .from("expenses")
        .select("id, title, amount, expense_date, recurrence_rule")
        .eq("user_id", user.id)
        .not("recurrence_rule", "is", null),
      supabase
        .from("year_entries")
        .select("id, title, type, start_date")
        .eq("user_id", user.id),
      supabase
        // Widen to today … +2d so a cycle/appointment scheduled ahead gets its
        // start reminder queued for closed-app push (and covers UTC/local edges).
        .from("schedule_instances")
        .select("id, source_type, source_activity_id, start_at, end_at, status_snapshot, schedule_date")
        .eq("user_id", user.id)
        .gte("schedule_date", todayISO)
        .lte("schedule_date", addDays(todayISO, 2)),
      supabase
        .from("activities")
        .select("id, title, priority, activity_date, status, is_someday, archived")
        .eq("user_id", user.id)
        .in("status", ["not_started", "working", "postponed"]),
      supabase
        .from("calendar_events")
        .select("id, title, event_type, start_at")
        .eq("user_id", user.id)
        .gte("start_at", `${todayISO}T00:00:00Z`)
        .lte("start_at", `${addDays(todayISO, 2)}T23:59:59Z`),
      // Phase 4: Six-Time Book config + active focus problems
      supabase
        .from("six_time_config")
        .select("enabled, slot_times, nightly_time")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("six_time_problems")
        .select("position, status, reminder_phrase")
        .eq("user_id", user.id)
        .eq("status", "active"),
      // Phase 5: is there an active giving challenge?
      supabase
        .from("giving_challenges")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);


    const params: ComputeRemindersParams = {
      prefs,
      meetings: meetingsResult.data ?? [],
      expenses: expensesResult.data ?? [],
      yearEntries: yearEntriesResult.data ?? [],
      scheduleInstances: scheduleInstancesResult.data ?? [],
      activities: activitiesResult.data ?? [],
      calendarEvents: calendarEventsResult.data ?? [],
      sixTimeConfig: sixTimeConfigResult.data ?? null,
      sixTimeProblems: sixTimeProblemsResult.data ?? [],
      hasActiveGivingChallenge: Boolean(givingChallengeResult.data),
      todayISO,
      now,
    };


    const allReminders = computeAllReminders(params);

    const soundEnabled = prefs.notification_sound_enabled ?? true;
    const soundConfig: SoundConfig = {
      sound: (prefs.notification_sound as NotificationSound) ?? "chime",
      enabled: soundEnabled,
    };

    // Queue upcoming reminders for server-side (closed-app) delivery. The browser
    // computes fire-times in the user's real local timezone; the Edge Function is
    // a dumb dispatcher. Upsert on (user_id, dedup_key) makes re-syncing safe.
    const outboxRows = buildOutboxRows(allReminders, soundEnabled, now).map((r) => ({
      ...r,
      user_id: user.id,
    }));
    if (outboxRows.length > 0) {
      await supabase
        .from("push_outbox")
        .upsert(outboxRows, { onConflict: "user_id,dedup_key", ignoreDuplicates: true });
    }

    // Filter out already-fired via Supabase (cross-device dedup)
    const unfired = filterUnfiredReminders(allReminders, firedInstances ?? []);

    // Fire browser notifications now for anything already due (localStorage dedup
    // for same-device/refresh). Future ones are handled by the outbox above.
    const fired = fireNewOverdueReminders(unfired, now, soundConfig);

    if (fired.length === 0) return;

    // Write reminder_instances to Supabase for cross-device tracking
    const instances = fired.map((r: ReminderSchedule) => ({
      user_id: user.id,
      reminder_type: r.type,
      source_id: r.source_id,
      scheduled_for: r.scheduled_for.toISOString(),
      fired_at: now.toISOString(),
    }));

    await supabase.from("reminder_instances").insert(instances);

    // In-app toast for meeting-passed (always surface in-app, not just browser notification)
    const meetingPassed = fired.filter((r: ReminderSchedule) => r.type === "meeting_passed");
    for (const r of meetingPassed) {
      showToast(r.body);
    }
  }, []);

  useEffect(() => {
    // If the user already granted permission, make sure this browser is
    // subscribed for closed-app push (endpoints can rotate). Permission itself is
    // requested from a user gesture in Settings — Safari/iOS ignore auto-prompts.
    ensureWebPushSubscribed().catch(() => {});

    // Check on mount (slight delay to let auth settle)
    const timer = setTimeout(() => { checkReminders().catch(() => {}); }, 1500);

    // Poll while the tab is open so reminders fire at their scheduled time — not
    // only on mount/focus (that was the bug: a due reminder never fired live).
    const interval = setInterval(() => { checkReminders().catch(() => {}); }, CHECK_INTERVAL_MS);

    // Re-check on tab focus (catches reminders that came due while tab was hidden)
    const onFocus = () => { checkReminders().catch(() => {}); };
    window.addEventListener("focus", onFocus);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkReminders]);

  return <>{children}</>;
}
