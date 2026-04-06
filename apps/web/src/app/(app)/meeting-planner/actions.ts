"use server";

import { revalidatePath } from "next/cache";

import { canCreateMeetingAt, isMeetingPast, localTimeToUTC } from "@pm/domain";
import type { Meeting, MeetingRecurrenceRule, MeetingStatus } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { success: true } | { error: string };

/**
 * Revalidate all pages that show meeting data.
 * Spec §11.1: meetings are one source of truth — Calendar, Daily Plan, and
 * Communication Planner all read from the same shared Meeting records.
 */
function revalidateAll() {
  revalidatePath("/meeting-planner");
  revalidatePath("/communication-planner");
  revalidatePath("/calendar");
  revalidatePath("/daily-plan");
}

// ---------------------------------------------------------------------------
// Build start_at / end_at UTC ISO strings from local-time form inputs.
// Uses the user's IANA timezone so that "10:00 AM" in Asia/Kolkata is stored
// as the correct UTC equivalent (not 10:00 UTC which would display 15:30 local).
// ---------------------------------------------------------------------------

function buildDatetimes(
  date: string,
  startTime: string,
  durationMinutes: number,
  ianaTimezone: string,
): { start_at: string; end_at: string } {
  const start = localTimeToUTC(date, startTime, ianaTimezone);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

// ---------------------------------------------------------------------------
// Create meeting
// Spec §12.1: no new meetings in the past.
// Spec §10.9: linked_contact required; must come from shared contacts table.
// Spec §11.1: creates linked CalendarEvent + ScheduleInstance so the meeting
//             appears in Calendar month view and Daily Plan timeline.
// ---------------------------------------------------------------------------

export async function createMeeting(data: {
  title: string;
  linked_contact_id: string;
  date: string;
  start_time: string;   // "HH:MM"
  duration_minutes: number;
  agenda?: string | null;
  recurrence_rule?: MeetingRecurrenceRule;
}): Promise<ActionResult> {
  if (!data.title.trim()) return { error: "Title is required." };
  if (!data.linked_contact_id) return { error: "A contact is required." };
  if (!data.date) return { error: "Date is required." };
  if (!data.start_time) return { error: "Start time is required." };
  if (!data.duration_minutes || data.duration_minutes <= 0) {
    return { error: "Duration must be positive." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Fetch user timezone for correct UTC conversion (prevents ±N hour display offset)
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "UTC";

  const { start_at, end_at } = buildDatetimes(
    data.date,
    data.start_time,
    data.duration_minutes,
    timezone,
  );

  if (!canCreateMeetingAt(start_at)) {
    return { error: "Cannot create a meeting in the past." };
  }

  // Verify the linked contact belongs to this user and is not deleted
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", data.linked_contact_id)
    .eq("user_id", user.id)
    .eq("is_deleted", false)
    .single();

  if (!contact) return { error: "Contact not found." };

  // 1. Create the Meeting record
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      user_id: user.id,
      linked_contact_id: data.linked_contact_id,
      linked_calendar_event_id: null, // filled in step 3
      title: data.title.trim(),
      date: data.date,
      start_at,
      end_at,
      duration_minutes: data.duration_minutes,
      agenda: data.agenda?.trim() ?? "",
      key_takeaways: null,
      recurrence_rule: data.recurrence_rule ?? null,
      status: "upcoming",
    })
    .select("id")
    .single();

  if (meetingError || !meeting) return { error: meetingError?.message ?? "Failed to create meeting." };

  // 2. Create a linked CalendarEvent (source_type = 'meeting_planner')
  const { data: calEvent, error: calError } = await supabase
    .from("calendar_events")
    .insert({
      user_id: user.id,
      event_type: "meeting",
      title: data.title.trim(),
      date: data.date,
      start_at,
      end_at,
      duration_minutes: data.duration_minutes,
      linked_contact_id: data.linked_contact_id,
      linked_project_id: null,
      linked_meeting_id: meeting.id,
      linked_year_entry_id: null,
      location: null,
      notes: data.agenda?.trim() ?? null,
      recurrence_rule: data.recurrence_rule ?? null,
      status: "upcoming",
      source_type: "meeting_planner",
    })
    .select("id")
    .single();

  if (calError || !calEvent) {
    // Roll back the meeting to avoid orphan
    await supabase.from("meetings").delete().eq("id", meeting.id);
    return { error: calError?.message ?? "Failed to create calendar event." };
  }

  // 3. Update the Meeting to link back to the CalendarEvent (bidirectional)
  await supabase
    .from("meetings")
    .update({ linked_calendar_event_id: calEvent.id })
    .eq("id", meeting.id);

  // 4. Create a ScheduleInstance so the meeting appears in Daily Plan timeline
  await supabase.from("schedule_instances").insert({
    user_id: user.id,
    source_type: "meeting",
    source_activity_id: null,
    source_meeting_id: meeting.id,
    source_event_id: null,
    schedule_date: data.date,
    start_at,
    end_at,
    locked_minutes: data.duration_minutes,
    focus_minutes: null,
    status_snapshot: "upcoming",
    keep_as_history: true,
  });

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update meeting — future meetings allow full edit; past meetings only allow
// key_takeaways + status (spec §12.3 + §10.9).
// Syncs linked CalendarEvent fields on time/title changes.
// ---------------------------------------------------------------------------

export async function updateMeeting(
  id: string,
  data: {
    // Full-edit fields (future meetings only)
    title?: string;
    linked_contact_id?: string;
    date?: string;
    start_time?: string;
    duration_minutes?: number;
    agenda?: string | null;
    recurrence_rule?: MeetingRecurrenceRule;
    // Always allowed
    key_takeaways?: string | null;
    status?: MeetingStatus;
  },
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Fetch user timezone for correct UTC conversion
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "UTC";

  // Fetch the existing meeting to determine past/future and get linked IDs
  const { data: existing } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { error: "Meeting not found." };

  const meetingRecord = existing as Meeting;
  const isPast = isMeetingPast(meetingRecord);
  const now = new Date().toISOString();

  if (isPast) {
    // Past meeting: only key_takeaways + status editable (spec §12.3)
    const { error } = await supabase
      .from("meetings")
      .update({
        key_takeaways: data.key_takeaways ?? existing.key_takeaways,
        status: data.status ?? existing.status,
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    // Sync status to CalendarEvent
    if (existing.linked_calendar_event_id) {
      await supabase
        .from("calendar_events")
        .update({
          status: data.status ?? existing.status,
          updated_at: now,
        })
        .eq("id", existing.linked_calendar_event_id);
    }
  } else {
    // Future meeting: full edit allowed
    if (data.title !== undefined && !data.title.trim()) {
      return { error: "Title is required." };
    }

    let start_at = existing.start_at;
    let end_at = existing.end_at;
    let durationMinutes = existing.duration_minutes;

    if (data.date || data.start_time || data.duration_minutes) {
      const date = data.date ?? existing.date;
      // Extract local HH:MM from the stored UTC start_at using user's timezone
      const existingLocalTime = (() => {
        const d = new Date(existing.start_at);
        const fmt = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(d);
        const p = Object.fromEntries(fmt.map((x) => [x.type, x.value]));
        return `${p["hour"] ?? "00"}:${p["minute"] ?? "00"}`;
      })();
      const startTime = data.start_time ?? existingLocalTime;
      durationMinutes = data.duration_minutes ?? existing.duration_minutes;
      const built = buildDatetimes(date, startTime, durationMinutes, timezone);
      start_at = built.start_at;
      end_at = built.end_at;

      if (!canCreateMeetingAt(start_at)) {
        return { error: "Cannot reschedule a meeting to the past." };
      }
    }

    if (data.linked_contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("id", data.linked_contact_id)
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .single();
      if (!contact) return { error: "Contact not found." };
    }

    const updatedDate = data.date ?? existing.date;

    const { error } = await supabase
      .from("meetings")
      .update({
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.linked_contact_id !== undefined && { linked_contact_id: data.linked_contact_id }),
        ...(data.agenda !== undefined && { agenda: data.agenda?.trim() ?? "" }),
        ...(data.recurrence_rule !== undefined && { recurrence_rule: data.recurrence_rule }),
        ...(data.key_takeaways !== undefined && { key_takeaways: data.key_takeaways }),
        ...(data.status !== undefined && { status: data.status }),
        date: updatedDate,
        start_at,
        end_at,
        duration_minutes: durationMinutes,
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    // Sync CalendarEvent fields (title, dates, contact, status)
    if (existing.linked_calendar_event_id) {
      await supabase
        .from("calendar_events")
        .update({
          ...(data.title !== undefined && { title: data.title.trim() }),
          ...(data.linked_contact_id !== undefined && { linked_contact_id: data.linked_contact_id }),
          ...(data.recurrence_rule !== undefined && { recurrence_rule: data.recurrence_rule }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.agenda !== undefined && { notes: data.agenda?.trim() ?? null }),
          date: updatedDate,
          start_at,
          end_at,
          duration_minutes: durationMinutes,
          updated_at: now,
        })
        .eq("id", existing.linked_calendar_event_id);
    }

    // Sync ScheduleInstance times if date/time changed
    if (data.date || data.start_time || data.duration_minutes) {
      await supabase
        .from("schedule_instances")
        .update({
          schedule_date: updatedDate,
          start_at,
          end_at,
          locked_minutes: durationMinutes,
          updated_at: now,
        })
        .eq("source_meeting_id", id)
        .eq("user_id", user.id);
    }
  }

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete meeting — hard delete.
// CalendarEvent auto-deleted via: calendar_events.linked_meeting_id ON DELETE CASCADE
// ScheduleInstance auto-deleted via: schedule_instances.source_meeting_id ON DELETE CASCADE
// ---------------------------------------------------------------------------

export async function deleteMeeting(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Archive meeting — sets archived = true, hides from main view.
// ---------------------------------------------------------------------------

export async function archiveMeeting(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("meetings")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}
