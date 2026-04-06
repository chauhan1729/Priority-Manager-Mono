import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  canCreateCalendarEventAt,
  canCreateCalendarEventOnDate,
  canCreateMeetingAt,
  expandRecurringCalendarEvents,
  isCalendarEventPast,
  localTimeToUTC,
} from '@pm/domain';
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventType,
  MeetingRecurrenceRule,
  RecurrenceRule,
} from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const calendarEventKeys = {
  all: ['calendarEvents'] as const,
  forMonth: (monthKey: string) => ['calendarEvents', 'month', monthKey] as const,
  monthNote: (monthKey: string) => ['calendarMonthNote', monthKey] as const,
};

// ---------------------------------------------------------------------------
// Helpers
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

async function getUserTimezone(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .single();
  return profile?.timezone ?? 'UTC';
}

function extractLocalHHMM(utcIso: string, timezone: string): string {
  const d = new Date(utcIso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const p = Object.fromEntries(fmt.map((x) => [x.type, x.value]));
  return `${p['hour'] ?? '00'}:${p['minute'] ?? '00'}`;
}

// monthKey = "YYYY-MM"
function monthRange(monthKey: string): { startDate: string; endDate: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const startDate = `${monthKey}-01`;
  const lastDay = new Date(y!, m!, 0).getDate(); // day 0 of next month = last day of this month
  const endDate = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useCalendarEventsForMonth(monthKey: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: calendarEventKeys.forMonth(monthKey),
    queryFn: async () => {
      const { startDate, endDate } = monthRange(monthKey);
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('start_at', { ascending: true });
      if (error) throw error;
      const events = data as CalendarEvent[];
      // Expand recurring events within the month range
      return expandRecurringCalendarEvents(events, startDate, endDate);
    },
    enabled: !!user && !!monthKey,
  });
}

export function useMonthNote(monthKey: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: calendarEventKeys.monthNote(monthKey),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_month_notes')
        .select('notes')
        .eq('user_id', user!.id)
        .eq('month_key', monthKey)
        .maybeSingle();
      if (error) throw error;
      return data?.notes ?? null;
    },
    enabled: !!user && !!monthKey,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export interface CreateCalendarEventInput {
  event_type: CalendarEventType;
  title: string;
  date: string;
  start_time?: string;
  duration_minutes?: number;
  linked_contact_id?: string | null;
  linked_project_id?: string | null;
  location?: string | null;
  notes?: string | null;
  recurrence_rule?: RecurrenceRule;
  agenda?: string | null;
}

export function useCreateCalendarEvent() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCalendarEventInput) => {
      if (!user) throw new Error('Not authenticated.');

      if (input.event_type === 'birthday' || input.event_type === 'renewal') {
        throw new Error('Birthday and renewal events are synced automatically.');
      }
      if (!input.title.trim()) throw new Error('Title is required.');
      if (!input.date) throw new Error('Date is required.');
      if (input.event_type === 'meeting' && !input.linked_contact_id) {
        throw new Error('A contact is required for meeting events.');
      }

      const hasTiming = !!input.start_time && !!input.duration_minutes;

      if (!hasTiming && !canCreateCalendarEventOnDate(input.date)) {
        throw new Error('Cannot create an event in the past.');
      }

      const timezone = await getUserTimezone(user.id);
      let start_at: string | null = null;
      let end_at: string | null = null;

      if (hasTiming) {
        const built = buildDatetimes(input.date, input.start_time!, input.duration_minutes!, timezone);
        start_at = built.start_at;
        end_at = built.end_at;
        if (!canCreateCalendarEventAt(start_at)) {
          throw new Error('Cannot create an event in the past.');
        }
      }

      // Verify contact ownership
      if (input.linked_contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('id', input.linked_contact_id)
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .single();
        if (!contact) throw new Error('Contact not found.');
      }

      if (input.event_type === 'meeting') {
        return _createMeetingEvent(user.id, input, start_at!, end_at!);
      }

      // Appointment / other
      const { data: calEvent, error: calError } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          event_type: input.event_type,
          title: input.title.trim(),
          date: input.date,
          start_at,
          end_at,
          duration_minutes: input.duration_minutes ?? null,
          linked_contact_id: input.linked_contact_id ?? null,
          linked_project_id: input.linked_project_id ?? null,
          linked_meeting_id: null,
          linked_year_entry_id: null,
          location: input.location?.trim() ?? null,
          notes: input.notes?.trim() ?? null,
          recurrence_rule: input.recurrence_rule ?? null,
          status: 'upcoming',
          source_type: 'calendar',
        })
        .select('id')
        .single();

      if (calError || !calEvent) throw new Error(calError?.message ?? 'Failed to create event.');

      if (hasTiming && start_at && end_at && input.duration_minutes) {
        await supabase.from('schedule_instances').insert({
          user_id: user.id,
          source_type: input.event_type === 'appointment' ? 'appointment' : 'other',
          source_activity_id: null,
          source_meeting_id: null,
          source_event_id: calEvent.id,
          schedule_date: input.date,
          start_at,
          end_at,
          locked_minutes: input.duration_minutes,
          focus_minutes: null,
          status_snapshot: 'upcoming',
          keep_as_history: true,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarEventKeys.all });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['scheduleInstances'] });
    },
  });
}

async function _createMeetingEvent(
  userId: string,
  data: CreateCalendarEventInput,
  start_at: string,
  end_at: string,
) {
  const durationMinutes = data.duration_minutes!;

  if (!canCreateMeetingAt(start_at)) {
    throw new Error('Cannot create a meeting in the past.');
  }

  // 1. Create Meeting
  const { data: meeting, error: meetingErr } = await supabase
    .from('meetings')
    .insert({
      user_id: userId,
      linked_contact_id: data.linked_contact_id,
      linked_calendar_event_id: null,
      title: data.title.trim(),
      date: data.date,
      start_at,
      end_at,
      duration_minutes: durationMinutes,
      agenda: data.agenda?.trim() ?? '',
      key_takeaways: null,
      recurrence_rule: (data.recurrence_rule as MeetingRecurrenceRule) ?? null,
      status: 'upcoming',
    })
    .select('id')
    .single();

  if (meetingErr || !meeting) throw new Error(meetingErr?.message ?? 'Failed to create meeting.');

  // 2. Create CalendarEvent linked to Meeting
  const { data: calEvent, error: calErr } = await supabase
    .from('calendar_events')
    .insert({
      user_id: userId,
      event_type: 'meeting',
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
      status: 'upcoming',
      source_type: 'calendar',
    })
    .select('id')
    .single();

  if (calErr || !calEvent) {
    await supabase.from('meetings').delete().eq('id', meeting.id);
    throw new Error(calErr?.message ?? 'Failed to create calendar event.');
  }

  // 3. Link Meeting → CalendarEvent (bidirectional)
  await supabase
    .from('meetings')
    .update({ linked_calendar_event_id: calEvent.id })
    .eq('id', meeting.id);

  // 4. ScheduleInstance for Daily Plan
  await supabase.from('schedule_instances').insert({
    user_id: userId,
    source_type: 'meeting',
    source_activity_id: null,
    source_meeting_id: meeting.id,
    source_event_id: null,
    schedule_date: data.date,
    start_at,
    end_at,
    locked_minutes: durationMinutes,
    focus_minutes: null,
    status_snapshot: 'upcoming',
    keep_as_history: true,
  });
}

export interface UpdateCalendarEventInput {
  id: string;
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
}

export function useUpdateCalendarEvent() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCalendarEventInput) => {
      if (!user) throw new Error('Not authenticated.');

      const timezone = await getUserTimezone(user.id);

      const { data: existing } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', input.id)
        .eq('user_id', user.id)
        .single();

      if (!existing) throw new Error('Event not found.');

      const event = existing as CalendarEvent;
      const isPast = isCalendarEventPast(event);
      const now = new Date().toISOString();

      if (isPast) {
        // Past event: status only
        const { error } = await supabase
          .from('calendar_events')
          .update({ status: input.status ?? event.status, updated_at: now })
          .eq('id', input.id);
        if (error) throw new Error(error.message);

        if (event.linked_meeting_id && input.status) {
          await supabase
            .from('meetings')
            .update({ status: input.status, updated_at: now })
            .eq('id', event.linked_meeting_id);
        }
        return;
      }

      // Future event: full edit
      if (input.title !== undefined && !input.title.trim()) {
        throw new Error('Title is required.');
      }

      let start_at = event.start_at;
      let end_at = event.end_at;
      let durationMinutes = event.duration_minutes;

      if (input.date || input.start_time || input.duration_minutes) {
        const date = input.date ?? event.date;
        const existingLocalTime = event.start_at
          ? extractLocalHHMM(event.start_at, timezone)
          : null;
        const startTime = input.start_time ?? existingLocalTime;
        durationMinutes = input.duration_minutes ?? event.duration_minutes;

        if (startTime && durationMinutes) {
          const built = buildDatetimes(date, startTime, durationMinutes, timezone);
          start_at = built.start_at;
          end_at = built.end_at;

          if (!canCreateCalendarEventAt(start_at)) {
            throw new Error('Cannot reschedule an event to the past.');
          }
        }
      }

      const updatedDate = input.date ?? event.date;

      const { error } = await supabase
        .from('calendar_events')
        .update({
          ...(input.title !== undefined && { title: input.title.trim() }),
          ...(input.linked_contact_id !== undefined && { linked_contact_id: input.linked_contact_id }),
          ...(input.linked_project_id !== undefined && { linked_project_id: input.linked_project_id }),
          ...(input.location !== undefined && { location: input.location?.trim() ?? null }),
          ...(input.notes !== undefined && { notes: input.notes?.trim() ?? null }),
          ...(input.recurrence_rule !== undefined && { recurrence_rule: input.recurrence_rule }),
          ...(input.status !== undefined && { status: input.status }),
          date: updatedDate,
          start_at,
          end_at,
          duration_minutes: durationMinutes,
          updated_at: now,
        })
        .eq('id', input.id);

      if (error) throw new Error(error.message);

      // Sync linked Meeting
      if (event.linked_meeting_id) {
        await supabase
          .from('meetings')
          .update({
            ...(input.title !== undefined && { title: input.title.trim() }),
            ...(input.linked_contact_id !== undefined && { linked_contact_id: input.linked_contact_id }),
            ...(input.status !== undefined && { status: input.status }),
            date: updatedDate,
            start_at,
            end_at,
            ...(durationMinutes !== null && { duration_minutes: durationMinutes }),
            updated_at: now,
          })
          .eq('id', event.linked_meeting_id);

        if (input.date || input.start_time || input.duration_minutes) {
          await supabase
            .from('schedule_instances')
            .update({
              schedule_date: updatedDate,
              start_at,
              end_at,
              ...(durationMinutes !== null && { locked_minutes: durationMinutes }),
              updated_at: now,
            })
            .eq('source_meeting_id', event.linked_meeting_id)
            .eq('user_id', user.id);
        }
      }

      // Sync ScheduleInstance for appointment/other
      if (!event.linked_meeting_id && (input.date || input.start_time || input.duration_minutes)) {
        await supabase
          .from('schedule_instances')
          .update({
            schedule_date: updatedDate,
            start_at,
            end_at,
            ...(durationMinutes !== null && { locked_minutes: durationMinutes }),
            updated_at: now,
          })
          .eq('source_event_id', input.id)
          .eq('user_id', user.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarEventKeys.all });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['scheduleInstances'] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      if (!user) throw new Error('Not authenticated.');

      const { data: existing } = await supabase
        .from('calendar_events')
        .select('id, event_type, linked_meeting_id')
        .eq('id', eventId)
        .eq('user_id', user.id)
        .single();

      if (!existing) throw new Error('Event not found.');

      if (existing.event_type === 'meeting' && existing.linked_meeting_id) {
        // Delete Meeting → cascades to CalendarEvent + ScheduleInstance
        const { error } = await supabase
          .from('meetings')
          .delete()
          .eq('id', existing.linked_meeting_id)
          .eq('user_id', user.id);
        if (error) throw new Error(error.message);
      } else {
        // Appointment/other → CalendarEvent cascade deletes ScheduleInstance
        const { error } = await supabase
          .from('calendar_events')
          .delete()
          .eq('id', eventId)
          .eq('user_id', user.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarEventKeys.all });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['scheduleInstances'] });
    },
  });
}

export function useUpsertMonthNote() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ monthKey, notes }: { monthKey: string; notes: string }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('calendar_month_notes')
        .upsert(
          { user_id: user.id, month_key: monthKey, notes, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,month_key' },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: calendarEventKeys.monthNote(vars.monthKey) });
    },
  });
}
