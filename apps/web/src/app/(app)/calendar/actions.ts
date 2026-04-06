"use server";

import { revalidatePath } from "next/cache";

import {
  canCreateCalendarEventAt,
  canCreateCalendarEventOnDate,
  canCreateMeetingAt,
  isCalendarEventPast,
  localTimeToUTC,
} from "@pm/domain";
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventType,
  MeetingRecurrenceRule,
  RecurrenceRule,
} from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { success: true } | { error: string };

function revalidateAll() {
  revalidatePath("/calendar");
  revalidatePath("/meeting-planner");
  revalidatePath("/communication-planner");
  revalidatePath("/daily-plan");
}

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
// Create a CalendarEvent.
// - For event_type = "meeting": also creates a linked Meeting + ScheduleInstance
//   (spec §18.1: full meeting creation flow from Calendar).
// - For event_type = "appointment" | "other": CalendarEvent + ScheduleInstance.
// - For event_type = "birthday" | "renewal": created via year_entry / expense hooks only.
// ---------------------------------------------------------------------------

export async function createCalendarEvent(data: {
  event_type: CalendarEventType;
  title: string;
  date: string;
  start_time?: string;       // "HH:MM" — required for timed events
  duration_minutes?: number; // required for timed events
  linked_contact_id?: string | null;
  linked_project_id?: string | null;
  location?: string | null;
  notes?: string | null;
  recurrence_rule?: RecurrenceRule;
  // Meeting-only fields
  agenda?: string | null;
}): Promise<ActionResult> {
  if (data.event_type === "birthday" || data.event_type === "renewal") {
    return { error: "Birthday and renewal events are synced automatically." };
  }

  if (!data.title.trim()) return { error: "Title is required." };
  if (!data.date) return { error: "Date is required." };
  if (data.event_type === "meeting" && !data.linked_contact_id) {
    return { error: "A contact is required for meeting events." };
  }

  // Timed events need start_time + duration
  const hasTiming = !!data.start_time && !!data.duration_minutes;
  if (!hasTiming) {
    if (!canCreateCalendarEventOnDate(data.date)) {
      return { error: "Cannot create an event in the past." };
    }
  }

  let start_at: string | null = null;
  let end_at: string | null = null;

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

  if (hasTiming) {
    const built = buildDatetimes(data.date, data.start_time!, data.duration_minutes!, timezone);
    start_at = built.start_at;
    end_at = built.end_at;

    if (!canCreateCalendarEventAt(start_at)) {
      return { error: "Cannot create an event in the past." };
    }
  }

  // Verify contact ownership if provided
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

  if (data.event_type === "meeting") {
    return _createMeetingEvent(supabase, user.id, data, start_at!, end_at!);
  }

  // Appointment / other: CalendarEvent only (+ ScheduleInstance if timed)
  const { data: calEvent, error: calError } = await supabase
    .from("calendar_events")
    .insert({
      user_id: user.id,
      event_type: data.event_type,
      title: data.title.trim(),
      date: data.date,
      start_at,
      end_at,
      duration_minutes: data.duration_minutes ?? null,
      linked_contact_id: data.linked_contact_id ?? null,
      linked_project_id: data.linked_project_id ?? null,
      linked_meeting_id: null,
      linked_year_entry_id: null,
      location: data.location?.trim() ?? null,
      notes: data.notes?.trim() ?? null,
      recurrence_rule: data.recurrence_rule ?? null,
      status: "upcoming",
      source_type: "calendar",
    })
    .select("id")
    .single();

  if (calError || !calEvent) return { error: calError?.message ?? "Failed to create event." };

  // Create ScheduleInstance for timed events (appointment/other → source_event_id)
  if (hasTiming && start_at && end_at && data.duration_minutes) {
    await supabase.from("schedule_instances").insert({
      user_id: user.id,
      source_type: data.event_type === "appointment" ? "appointment" : "other",
      source_activity_id: null,
      source_meeting_id: null,
      source_event_id: calEvent.id,
      schedule_date: data.date,
      start_at,
      end_at,
      locked_minutes: data.duration_minutes,
      focus_minutes: null,
      status_snapshot: "upcoming",
      keep_as_history: true,
    });
  }

  revalidateAll();
  return { success: true };
}

/** Creates Meeting + CalendarEvent + ScheduleInstance atomically for Calendar-originated meetings. */
async function _createMeetingEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  data: Parameters<typeof createCalendarEvent>[0],
  start_at: string,
  end_at: string,
): Promise<ActionResult> {
  const durationMinutes = data.duration_minutes!;

  // Spec §12.1
  if (!canCreateMeetingAt(start_at)) {
    return { error: "Cannot create a meeting in the past." };
  }

  // 1. Create Meeting
  const { data: meeting, error: meetingErr } = await supabase
    .from("meetings")
    .insert({
      user_id: userId,
      linked_contact_id: data.linked_contact_id,
      linked_calendar_event_id: null,
      title: data.title.trim(),
      date: data.date,
      start_at,
      end_at,
      duration_minutes: durationMinutes,
      agenda: data.agenda?.trim() ?? "",
      key_takeaways: null,
      recurrence_rule: (data.recurrence_rule as MeetingRecurrenceRule) ?? null,
      status: "upcoming",
    })
    .select("id")
    .single();

  if (meetingErr || !meeting) {
    return { error: meetingErr?.message ?? "Failed to create meeting." };
  }

  // 2. Create CalendarEvent linked to Meeting
  const { data: calEvent, error: calErr } = await supabase
    .from("calendar_events")
    .insert({
      user_id: userId,
      event_type: "meeting",
      title: data.title.trim(),
      date: data.date,
      start_at,
      end_at,
      duration_minutes: durationMinutes,
      linked_contact_id: data.linked_contact_id ?? null,
      linked_project_id: data.linked_project_id ?? null,
      linked_meeting_id: meeting.id,
      linked_year_entry_id: null,
      location: data.location?.trim() ?? null,
      notes: data.agenda?.trim() ?? null,
      recurrence_rule: data.recurrence_rule ?? null,
      status: "upcoming",
      source_type: "calendar",
    })
    .select("id")
    .single();

  if (calErr || !calEvent) {
    await supabase.from("meetings").delete().eq("id", meeting.id);
    return { error: calErr?.message ?? "Failed to create calendar event." };
  }

  // 3. Link Meeting → CalendarEvent (bidirectional)
  await supabase
    .from("meetings")
    .update({ linked_calendar_event_id: calEvent.id })
    .eq("id", meeting.id);

  // 4. Create ScheduleInstance for Daily Plan timeline
  await supabase.from("schedule_instances").insert({
    user_id: userId,
    source_type: "meeting",
    source_activity_id: null,
    source_meeting_id: meeting.id,
    source_event_id: null,
    schedule_date: data.date,
    start_at,
    end_at,
    locked_minutes: durationMinutes,
    focus_minutes: null,
    status_snapshot: "upcoming",
    keep_as_history: true,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Update CalendarEvent
// Past events: only status editable.
// Future events: all fields editable.
// For meeting-type events: also syncs linked Meeting record.
// ---------------------------------------------------------------------------

export async function updateCalendarEvent(
  id: string,
  data: {
    title?: string;
    date?: string;
    start_time?: string;
    duration_minutes?: number;
    linked_contact_id?: string | null;
    linked_project_id?: string | null;
    location?: string | null;
    notes?: string | null;
    recurrence_rule?: RecurrenceRule;
    status?: CalendarEventStatus;
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

  const { data: existing } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { error: "Event not found." };

  const event = existing as CalendarEvent;
  const isPast = isCalendarEventPast(event);
  const now = new Date().toISOString();

  if (isPast) {
    // Past event: status only
    const { error } = await supabase
      .from("calendar_events")
      .update({ status: data.status ?? event.status, updated_at: now })
      .eq("id", id);
    if (error) return { error: error.message };

    // Sync to linked meeting status
    if (event.linked_meeting_id && data.status) {
      await supabase
        .from("meetings")
        .update({ status: data.status, updated_at: now })
        .eq("id", event.linked_meeting_id);
    }

    revalidateAll();
    return { success: true };
  }

  // Future event: full edit
  if (data.title !== undefined && !data.title.trim()) {
    return { error: "Title is required." };
  }

  let start_at = event.start_at;
  let end_at = event.end_at;
  let durationMinutes = event.duration_minutes;

  if (data.date || data.start_time || data.duration_minutes) {
    const date = data.date ?? event.date;
    // Extract local HH:MM from stored UTC start_at using user's timezone
    const existingLocalTime = event.start_at ? (() => {
      const d = new Date(event.start_at);
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(d);
      const p = Object.fromEntries(fmt.map((x) => [x.type, x.value]));
      return `${p["hour"] ?? "00"}:${p["minute"] ?? "00"}`;
    })() : null;
    const startTime = data.start_time ?? existingLocalTime;
    durationMinutes = data.duration_minutes ?? event.duration_minutes;

    if (startTime && durationMinutes) {
      const built = buildDatetimes(date, startTime, durationMinutes, timezone);
      start_at = built.start_at;
      end_at = built.end_at;

      if (!canCreateCalendarEventAt(start_at)) {
        return { error: "Cannot reschedule an event to the past." };
      }
    }
  }

  const updatedDate = data.date ?? event.date;

  const { error } = await supabase
    .from("calendar_events")
    .update({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.linked_contact_id !== undefined && { linked_contact_id: data.linked_contact_id }),
      ...(data.linked_project_id !== undefined && { linked_project_id: data.linked_project_id }),
      ...(data.location !== undefined && { location: data.location?.trim() ?? null }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() ?? null }),
      ...(data.recurrence_rule !== undefined && { recurrence_rule: data.recurrence_rule }),
      ...(data.status !== undefined && { status: data.status }),
      date: updatedDate,
      start_at,
      end_at,
      duration_minutes: durationMinutes,
      updated_at: now,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Sync linked Meeting (title, date, times, contact, status)
  if (event.linked_meeting_id) {
    await supabase
      .from("meetings")
      .update({
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.linked_contact_id !== undefined && { linked_contact_id: data.linked_contact_id }),
        ...(data.status !== undefined && { status: data.status }),
        date: updatedDate,
        start_at,
        end_at,
        ...(durationMinutes !== null && { duration_minutes: durationMinutes }),
        updated_at: now,
      })
      .eq("id", event.linked_meeting_id);

    // Sync ScheduleInstance times
    if (data.date || data.start_time || data.duration_minutes) {
      await supabase
        .from("schedule_instances")
        .update({
          schedule_date: updatedDate,
          start_at,
          end_at,
          ...(durationMinutes !== null && { locked_minutes: durationMinutes }),
          updated_at: now,
        })
        .eq("source_meeting_id", event.linked_meeting_id)
        .eq("user_id", user.id);
    }
  }

  // Sync ScheduleInstance times for appointment/other events
  if (!event.linked_meeting_id && (data.date || data.start_time || data.duration_minutes)) {
    await supabase
      .from("schedule_instances")
      .update({
        schedule_date: updatedDate,
        start_at,
        end_at,
        ...(durationMinutes !== null && { locked_minutes: durationMinutes }),
        updated_at: now,
      })
      .eq("source_event_id", id)
      .eq("user_id", user.id);
  }

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete CalendarEvent.
// - If event_type = "meeting": deletes CalendarEvent → cascade deletes linked Meeting
//   via the meetings.linked_calendar_event_id FK on delete set null...
//   Actually: calendar_events.linked_meeting_id ON DELETE CASCADE deletes the CalendarEvent
//   when Meeting is deleted. We need the reverse: deleting CalendarEvent should delete Meeting.
//   The FK from meetings → calendar_events is ON DELETE SET NULL.
//   So: explicitly delete the linked Meeting (which cascades to ScheduleInstance).
// - For appointment/other: CalendarEvent deleted → ScheduleInstance cascade via source_event_id.
// ---------------------------------------------------------------------------

export async function deleteCalendarEvent(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: existing } = await supabase
    .from("calendar_events")
    .select("id, event_type, linked_meeting_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { error: "Event not found." };

  if (existing.event_type === "meeting" && existing.linked_meeting_id) {
    // Delete Meeting → cascades to ScheduleInstance (source_meeting_id FK)
    // CalendarEvent is then auto-deleted via calendar_events.linked_meeting_id ON DELETE CASCADE
    const { error } = await supabase
      .from("meetings")
      .delete()
      .eq("id", existing.linked_meeting_id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    // Appointment/other: delete CalendarEvent → ScheduleInstance cascade via source_event_id
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Upsert monthly notes for the Calendar bottom notes area (spec §10.2).
// ---------------------------------------------------------------------------

export async function upsertMonthNote(
  monthKey: string,
  notes: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("calendar_month_notes")
    .upsert(
      { user_id: user.id, month_key: monthKey, notes, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month_key" },
    );

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return { success: true };
}
