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
  computeAllReminders,
  filterUnfiredReminders,
  type ComputeRemindersParams,
  type ReminderSchedule,
} from "@pm/domain";
import type { ReminderPreference } from "@pm/types";


import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { showToast } from "@/components/ui/Toaster";
import {
  fireNewOverdueReminders,
  requestNotificationPermission,
} from "@/lib/notifications/web-notifications";

// ---------------------------------------------------------------------------

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const checkReminders = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch reminder preferences
    const { data: prefsData } = await supabase
      .from("reminder_preferences")
      .select(
        "eod_review_enabled, eod_review_time, meeting_reminder_minutes_before, morning_summary_enabled, morning_summary_time, birthday_reminder_days_before, travel_reminder_days_before, renewal_reminder_days_before, activity_starting_enabled, activity_reminder_minutes_before, activity_overdue_enabled, event_reminder_minutes_before",
      )
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
    const [meetingsResult, expensesResult, yearEntriesResult, scheduleInstancesResult, activitiesResult, calendarEventsResult] = await Promise.all([
      supabase
        .from("meetings")
        .select("id, title, start_at, end_at, status, key_takeaways")
        .eq("user_id", user.id)
        .eq("date", todayISO)
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
        .from("schedule_instances")
        .select("id, source_type, source_activity_id, start_at, end_at, status_snapshot")
        .eq("user_id", user.id)
        .eq("schedule_date", todayISO),
      supabase
        .from("activities")
        .select("id, title")
        .eq("user_id", user.id)
        .in("status", ["not_started", "working", "postponed"]),
      supabase
        .from("calendar_events")
        .select("id, title, event_type, start_at")
        .eq("user_id", user.id)
        .gte("start_at", `${todayISO}T00:00:00Z`)
        .lte("start_at", `${todayISO}T23:59:59Z`),
    ]);


    const params: ComputeRemindersParams = {
      prefs,
      meetings: meetingsResult.data ?? [],
      expenses: expensesResult.data ?? [],
      yearEntries: yearEntriesResult.data ?? [],
      scheduleInstances: scheduleInstancesResult.data ?? [],
      activities: activitiesResult.data ?? [],
      calendarEvents: calendarEventsResult.data ?? [],
      todayISO,
      now,
    };


    const allReminders = computeAllReminders(params);

    // Filter out already-fired via Supabase (cross-device dedup)
    const unfired = filterUnfiredReminders(allReminders, firedInstances ?? []);

    // Fire browser notifications (localStorage dedup for same-device/refresh)
    const fired = fireNewOverdueReminders(unfired, now);

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
    // Request permission once on mount
    requestNotificationPermission().catch(() => {});

    // Check on mount (slight delay to let auth settle)
    const timer = setTimeout(() => { checkReminders().catch(() => {}); }, 1500);

    // Re-check on tab focus (catches reminders that fired while tab was hidden)
    const onFocus = () => { checkReminders().catch(() => {}); };
    window.addEventListener("focus", onFocus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkReminders]);

  return <>{children}</>;
}
