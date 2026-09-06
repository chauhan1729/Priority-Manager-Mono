import type { Metadata } from "next";

import { localTodayForTimezone, weekEndISO, weekStartISO } from "@pm/domain";
import type { Activity, Project } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WeeklyView } from "@/components/weekly/WeeklyView";

export const metadata: Metadata = { title: "Weekly" };

interface Props {
  searchParams: Promise<{ week?: string }>;
}

/**
 * The weekly pool — the middle tier between Someday and the Daily Plan. Items here are
 * committed to a week but not yet to a day; the user assigns them days from this screen.
 * Week is controlled via ?week=YYYY-MM-DD (normalised to the week start).
 */
export default async function WeeklyPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware handles redirect

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, last_weekly_review_date")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "UTC";

  const today = localTodayForTimezone(timezone);
  const { week: weekParam } = await searchParams;
  const weekStart = weekStartISO(weekParam ?? today);
  const weekEnd = weekEndISO(weekStart);
  const currentWeekStart = weekStartISO(today);

  const [
    { data: pool },
    { data: stranded },
    { data: overdue },
    { data: someday },
    { data: weekScheduled },
    { data: projects },
  ] = await Promise.all([
    // This week's pool
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_weekly", true)
      .eq("archived", false)
      .gte("activity_date", weekStart)
      .lte("activity_date", weekEnd)
      .order("created_at", { ascending: true }),

    // Pool items stranded in an earlier week — nothing else surfaces these
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_weekly", true)
      .eq("archived", false)
      .lt("activity_date", weekStart)
      .order("activity_date", { ascending: true }),

    // Dated activities that slipped before this week and are still open
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_weekly", false)
      .eq("is_someday", false)
      .eq("archived", false)
      .lt("activity_date", weekStart)
      .in("status", ["not_started", "working", "postponed"])
      .order("activity_date", { ascending: true }),

    // Someday list, for the weekly review
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_someday", true)
      .eq("archived", false)
      .order("created_at", { ascending: false }),

    // Already committed to a day this week — drives the per-day load counts
    supabase
      .from("activities")
      .select("activity_date, priority")
      .eq("user_id", user.id)
      .eq("is_weekly", false)
      .eq("is_someday", false)
      .eq("archived", false)
      .gte("activity_date", weekStart)
      .lte("activity_date", weekEnd),

    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .not("status", "in", "(cancelled,completed)")
      .order("name", { ascending: true }),
  ]);

  const dayLoad: Record<string, { a: number; total: number }> = {};
  for (const row of (weekScheduled ?? []) as Pick<
    Activity,
    "activity_date" | "priority"
  >[]) {
    const entry = dayLoad[row.activity_date] ?? { a: 0, total: 0 };
    entry.total += 1;
    if (row.priority === "A") entry.a += 1;
    dayLoad[row.activity_date] = entry;
  }

  return (
    <WeeklyView
      weekStart={weekStart}
      weekEnd={weekEnd}
      currentWeekStart={currentWeekStart}
      today={today}
      pool={(pool ?? []) as Activity[]}
      stranded={(stranded ?? []) as Activity[]}
      overdue={(overdue ?? []) as Activity[]}
      someday={(someday ?? []) as Activity[]}
      dayLoad={dayLoad}
      lastReviewedDate={profile?.last_weekly_review_date ?? null}
      projects={(projects ?? []) as Pick<Project, "id" | "name" | "status">[]}
    />
  );
}
