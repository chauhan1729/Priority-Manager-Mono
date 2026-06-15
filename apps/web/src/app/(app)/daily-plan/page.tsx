import type { Metadata } from "next";

import { expandRecurringCalendarEvents, expandRecurringMeetings, localTodayForTimezone } from "@pm/domain";
import type { Activity, CalendarEvent, Meeting, Project, ScheduleInstance } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DailyPlanView } from "@/components/daily-plan/DailyPlanView";

export const metadata: Metadata = { title: "Daily Plan" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/**
 * Spec §10.6: Daily Plan — server component, default home screen.
 * Date is controlled via ?date=YYYY-MM-DD search param (defaults to today).
 *
 * Fetches in parallel:
 *   - Activities for selected date (shown unscheduled + provides metadata for timeline blocks)
 *   - ScheduleInstances for selected date (positioned on timeline)
 *   - Meetings for selected date (for meeting block rendering in timeline via meetingMap)
 *   - CalendarEvents (appointment/other) for selected date (for appointment block rendering)
 *   - Previous day's incomplete activities (carry-forward panel)
 *   - Active projects (name display)
 */
export default async function DailyPlanPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // middleware handles redirect

  // Use user's stored timezone so the default date is correct for their local time
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "UTC";

  const { date: dateParam } = await searchParams;
  const selectedDate = dateParam ?? localTodayForTimezone(timezone);

  // Compute previous date (for carry-forward panel) — timezone-safe
  const parts = selectedDate.split("-");
  const prevDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) - 1);
  const previousDate = prevDate.toISOString().slice(0, 10);

  const [
    { data: activities },
    { data: scheduleInstances },
    { data: meetings },
    { data: calendarEvents },
    { data: prevActivities },
    { data: projects },
  ] = await Promise.all([
    // Activities for selected date (exclude Someday — those live only on /someday)
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", selectedDate)
      .eq("is_someday", false)
      .order("created_at", { ascending: true }),

    // Schedule instances for selected date (timeline blocks)
    supabase
      .from("schedule_instances")
      .select("*")
      .eq("user_id", user.id)
      .eq("schedule_date", selectedDate)
      .order("start_at", { ascending: true }),

    // Meetings for selected date + all recurring meetings (for expansion)
    // ScheduleInstances with source_type='meeting' reference these via source_meeting_id
    supabase
      .from("meetings")
      .select("*")
      .eq("user_id", user.id)
      .or(`date.eq.${selectedDate},recurrence_rule.not.is.null`),

    // CalendarEvents (appointment/other) for selected date + all recurring (for expansion)
    supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .in("event_type", ["appointment", "other"])
      .or(`date.eq.${selectedDate},recurrence_rule.not.is.null`),

    // Previous day's carry-forward eligible activities (exclude Someday)
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_date", previousDate)
      .eq("is_someday", false)
      .in("status", ["not_started", "postponed"]),

    // Active projects for name display
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .not("status", "in", "(cancelled,completed)")
      .order("name", { ascending: true }),
  ]);

  // Expand recurring meetings + appointments and keep only those on selectedDate
  const expandedMeetings = expandRecurringMeetings(
    (meetings ?? []) as Meeting[],
    selectedDate,
    selectedDate,
  );
  const expandedEvents = expandRecurringCalendarEvents(
    (calendarEvents ?? []) as CalendarEvent[],
    selectedDate,
    selectedDate,
  );

  return (
    <DailyPlanView
      activities={(activities ?? []) as Activity[]}
      scheduleInstances={(scheduleInstances ?? []) as ScheduleInstance[]}
      meetings={expandedMeetings}
      calendarEvents={expandedEvents}
      carryForwardActivities={(prevActivities ?? []) as Activity[]}
      projects={(projects ?? []) as Pick<Project, "id" | "name" | "status">[]}
      selectedDate={selectedDate}
      previousDate={previousDate}
    />
  );
}
