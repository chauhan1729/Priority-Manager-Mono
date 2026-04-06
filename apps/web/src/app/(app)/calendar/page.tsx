import type { Metadata } from "next";

import { currentMonthKey, expandRecurringCalendarEvents, expandRecurringMeetings, monthEnd, monthStart } from "@pm/domain";
import type {
  CalendarEvent,
  CalendarMonthNote,
  Contact,
  Meeting,
  YearEntry,
} from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar/CalendarView";

export const metadata: Metadata = { title: "Calendar" };

interface Props {
  searchParams: Promise<{ month?: string }>;
}

/**
 * Spec §10.2: Calendar — month grid server component.
 *
 * Fetches for the selected month in parallel:
 *   - calendar_events: all non-birthday events (meetings, appointments, other)
 *   - meetings: "orphan" meetings without linked_calendar_event_id (legacy/pre-Calendar data)
 *   - year_entries: birthdays (displayed as chips) + travel/away (displayed as context overlay)
 *   - contacts: name lookup for linked events
 *   - calendar_month_notes: monthly free-text notes (spec §10.2 bottom notes area)
 *
 * Sync note: all mutations call revalidatePath("/calendar") so this page
 * stays current after meeting creation, updates, or deletions from any feature.
 */
export default async function CalendarPage({ searchParams }: Props) {
  const { month: monthParam } = await searchParams;
  const selectedMonth = monthParam ?? currentMonthKey();

  const start = monthStart(selectedMonth);
  const end = monthEnd(selectedMonth);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: calendarEvents },
    { data: orphanMeetings },
    { data: yearEntries },
    { data: contacts },
    { data: monthNoteRows },
  ] = await Promise.all([
    // All non-birthday CalendarEvents for the month, PLUS any recurring events
    // (recurring events may have originated in a different month but repeat into this one)
    supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .neq("event_type", "birthday") // birthdays come from year_entries directly
      .or(`and(date.gte.${start},date.lte.${end}),recurrence_rule.not.is.null`)
      .order("start_at", { ascending: true, nullsFirst: false }),

    // Orphan meetings that pre-date Calendar feature (no linked_calendar_event_id)
    // Recurring orphan meetings may originate before this month — include them all for expansion.
    supabase
      .from("meetings")
      .select("*")
      .eq("user_id", user.id)
      .is("linked_calendar_event_id", null)
      .or(`and(date.gte.${start},date.lte.${end}),recurrence_rule.not.is.null`)
      .order("start_at", { ascending: true }),

    // Birthday entries (rendered as birthday chips, no CalendarEvent duplication)
    // Travel/away entries that overlap the month (for away overlay + scheduling warnings)
    supabase
      .from("year_entries")
      .select("*")
      .eq("user_id", user.id)
      .lte("start_date", end)
      .or(`end_date.gte.${start},end_date.is.null`)
      .order("start_date", { ascending: true }),

    // All active contacts for name lookup in event chips and popups
    supabase
      .from("contacts")
      .select("id, full_name, company, role, email, phone, category, note, is_deleted, created_at, updated_at, user_id")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("full_name", { ascending: true }),

    // Monthly notes for the bottom notes area (spec §10.2)
    supabase
      .from("calendar_month_notes")
      .select("*")
      .eq("user_id", user.id)
      .eq("month_key", selectedMonth)
      .limit(1),
  ]);

  const monthNote = (monthNoteRows ?? [])[0] ?? null;

  // Expand recurring events + meetings into all occurrences within this month
  const expandedCalendarEvents = expandRecurringCalendarEvents(
    (calendarEvents ?? []) as CalendarEvent[],
    start,
    end,
  );
  const expandedOrphanMeetings = expandRecurringMeetings(
    (orphanMeetings ?? []) as Meeting[],
    start,
    end,
  );

  return (
    <CalendarView
      calendarEvents={expandedCalendarEvents}
      orphanMeetings={expandedOrphanMeetings}
      yearEntries={(yearEntries ?? []) as YearEntry[]}
      contacts={(contacts ?? []) as Contact[]}
      monthNote={monthNote as CalendarMonthNote | null}
      selectedMonth={selectedMonth}
    />
  );
}
