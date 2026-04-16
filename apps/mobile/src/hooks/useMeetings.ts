import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { canCreateMeetingAt, isMeetingPast, localTimeToUTC } from '@pm/domain';
import type { Meeting, MeetingRecurrenceRule, MeetingStatus } from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const meetingKeys = {
  all: ['meetings'] as const,
  archived: ['meetings', 'archived'] as const,
  forDate: (date: string) => ['meetings', 'date', date] as const,
  forContact: (contactId: string) => ['meetings', 'contact', contactId] as const,
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

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useMeetings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: meetingKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user!.id)
        .eq('archived', false)
        .order('date', { ascending: false })
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data as Meeting[];
    },
    enabled: !!user,
  });
}

export function useMeetingsForDate(date: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: meetingKeys.forDate(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', date)
        .eq('archived', false)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data as Meeting[];
    },
    enabled: !!user && !!date,
  });
}

export function useArchivedMeetings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: meetingKeys.archived,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user!.id)
        .eq('archived', true)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Meeting[];
    },
    enabled: !!user,
  });
}

export function useMeetingsForContact(contactId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: meetingKeys.forContact(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user!.id)
        .eq('linked_contact_id', contactId)
        .eq('archived', false)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Meeting[];
    },
    enabled: !!user && !!contactId,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export interface CreateMeetingInput {
  title: string;
  linked_contact_id: string;
  date: string;
  start_time: string; // "HH:MM"
  duration_minutes: number;
  agenda?: string | null;
  recurrence_rule?: MeetingRecurrenceRule;
}

export function useCreateMeeting() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMeetingInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (!input.title.trim()) throw new Error('Title is required.');
      if (!input.linked_contact_id) throw new Error('A contact is required.');
      if (!input.date) throw new Error('Date is required.');
      if (!input.start_time) throw new Error('Start time is required.');
      if (!input.duration_minutes || input.duration_minutes <= 0) {
        throw new Error('Duration must be positive.');
      }

      const timezone = await getUserTimezone(user.id);
      const { start_at, end_at } = buildDatetimes(
        input.date, input.start_time, input.duration_minutes, timezone,
      );

      if (!canCreateMeetingAt(start_at)) {
        throw new Error('Cannot create a meeting in the past.');
      }

      // Verify contact ownership
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('id', input.linked_contact_id)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .single();
      if (!contact) throw new Error('Contact not found.');

      // 1. Create Meeting
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          linked_contact_id: input.linked_contact_id,
          linked_calendar_event_id: null,
          title: input.title.trim(),
          date: input.date,
          start_at,
          end_at,
          duration_minutes: input.duration_minutes,
          agenda: input.agenda?.trim() ?? '',
          key_takeaways: null,
          recurrence_rule: input.recurrence_rule ?? null,
          status: 'upcoming',
        })
        .select('id')
        .single();

      if (meetingError || !meeting) throw new Error(meetingError?.message ?? 'Failed to create meeting.');

      // 2. Create linked CalendarEvent
      const { data: calEvent, error: calError } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          event_type: 'meeting',
          title: input.title.trim(),
          date: input.date,
          start_at,
          end_at,
          duration_minutes: input.duration_minutes,
          linked_contact_id: input.linked_contact_id,
          linked_project_id: null,
          linked_meeting_id: meeting.id,
          linked_year_entry_id: null,
          location: null,
          notes: input.agenda?.trim() ?? null,
          recurrence_rule: input.recurrence_rule ?? null,
          status: 'upcoming',
          source_type: 'meeting_planner',
        })
        .select('id')
        .single();

      if (calError || !calEvent) {
        await supabase.from('meetings').delete().eq('id', meeting.id);
        throw new Error(calError?.message ?? 'Failed to create calendar event.');
      }

      // 3. Link Meeting → CalendarEvent
      await supabase
        .from('meetings')
        .update({ linked_calendar_event_id: calEvent.id })
        .eq('id', meeting.id);

      // 4. Create ScheduleInstance for Daily Plan
      await supabase.from('schedule_instances').insert({
        user_id: user.id,
        source_type: 'meeting',
        source_activity_id: null,
        source_meeting_id: meeting.id,
        source_event_id: null,
        schedule_date: input.date,
        start_at,
        end_at,
        locked_minutes: input.duration_minutes,
        focus_minutes: null,
        status_snapshot: 'upcoming',
        keep_as_history: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['calendarEvents'] });
      qc.invalidateQueries({ queryKey: ['scheduleInstances'] });
    },
  });
}

export interface UpdateMeetingInput {
  id: string;
  // Full edit (future meetings only)
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
}

export function useUpdateMeeting() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMeetingInput) => {
      if (!user) throw new Error('Not authenticated.');

      const timezone = await getUserTimezone(user.id);

      const { data: existing } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', input.id)
        .eq('user_id', user.id)
        .single();

      if (!existing) throw new Error('Meeting not found.');

      const meetingRecord = existing as Meeting;
      const isPast = isMeetingPast(meetingRecord);
      const now = new Date().toISOString();

      if (isPast) {
        // Past meeting: only key_takeaways + status
        const { error } = await supabase
          .from('meetings')
          .update({
            key_takeaways: input.key_takeaways ?? existing.key_takeaways,
            status: input.status ?? existing.status,
            updated_at: now,
          })
          .eq('id', input.id)
          .eq('user_id', user.id);
        if (error) throw new Error(error.message);

        if (existing.linked_calendar_event_id) {
          await supabase
            .from('calendar_events')
            .update({ status: input.status ?? existing.status, updated_at: now })
            .eq('id', existing.linked_calendar_event_id);
        }
        return;
      }

      // Future meeting: full edit
      if (input.title !== undefined && !input.title.trim()) {
        throw new Error('Title is required.');
      }

      let start_at = existing.start_at;
      let end_at = existing.end_at;
      let durationMinutes = existing.duration_minutes;

      if (input.date || input.start_time || input.duration_minutes) {
        const date = input.date ?? existing.date;
        const existingLocalTime = extractLocalHHMM(existing.start_at, timezone);
        const startTime = input.start_time ?? existingLocalTime;
        durationMinutes = input.duration_minutes ?? existing.duration_minutes;
        const built = buildDatetimes(date, startTime, durationMinutes, timezone);
        start_at = built.start_at;
        end_at = built.end_at;

        if (!canCreateMeetingAt(start_at)) {
          throw new Error('Cannot reschedule a meeting to the past.');
        }
      }

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

      const updatedDate = input.date ?? existing.date;

      const { error } = await supabase
        .from('meetings')
        .update({
          ...(input.title !== undefined && { title: input.title.trim() }),
          ...(input.linked_contact_id !== undefined && { linked_contact_id: input.linked_contact_id }),
          ...(input.agenda !== undefined && { agenda: input.agenda?.trim() ?? '' }),
          ...(input.recurrence_rule !== undefined && { recurrence_rule: input.recurrence_rule }),
          ...(input.key_takeaways !== undefined && { key_takeaways: input.key_takeaways }),
          ...(input.status !== undefined && { status: input.status }),
          date: updatedDate,
          start_at,
          end_at,
          duration_minutes: durationMinutes,
          updated_at: now,
        })
        .eq('id', input.id)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);

      // Sync CalendarEvent
      if (existing.linked_calendar_event_id) {
        await supabase
          .from('calendar_events')
          .update({
            ...(input.title !== undefined && { title: input.title.trim() }),
            ...(input.linked_contact_id !== undefined && { linked_contact_id: input.linked_contact_id }),
            ...(input.recurrence_rule !== undefined && { recurrence_rule: input.recurrence_rule }),
            ...(input.status !== undefined && { status: input.status }),
            ...(input.agenda !== undefined && { notes: input.agenda?.trim() ?? null }),
            date: updatedDate,
            start_at,
            end_at,
            duration_minutes: durationMinutes,
            updated_at: now,
          })
          .eq('id', existing.linked_calendar_event_id);
      }

      // Sync ScheduleInstance times
      if (input.date || input.start_time || input.duration_minutes) {
        await supabase
          .from('schedule_instances')
          .update({
            schedule_date: updatedDate,
            start_at,
            end_at,
            locked_minutes: durationMinutes,
            updated_at: now,
          })
          .eq('source_meeting_id', input.id)
          .eq('user_id', user.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['calendarEvents'] });
      qc.invalidateQueries({ queryKey: ['scheduleInstances'] });
    },
  });
}

export function useDeleteMeeting() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId }: { meetingId: string }) => {
      if (!user) throw new Error('Not authenticated.');
      // Deleting the meeting cascades to CalendarEvent (linked_meeting_id ON DELETE CASCADE)
      // and ScheduleInstance (source_meeting_id ON DELETE CASCADE)
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['calendarEvents'] });
      qc.invalidateQueries({ queryKey: ['scheduleInstances'] });
    },
  });
}

export function useArchiveMeeting() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId }: { meetingId: string }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('meetings')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', meetingId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: meetingKeys.archived });
    },
  });
}

export function useUnarchiveMeeting() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId }: { meetingId: string }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('meetings')
        .update({ archived: false, updated_at: new Date().toISOString() })
        .eq('id', meetingId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: meetingKeys.archived });
    },
  });
}
