import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  canScheduleAt,
  checkScheduleOverlap,
  validateFocusMinutes,
  validateLockedMinutes,
} from '@pm/domain';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';
import { activityKeys } from './useActivities';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const scheduleKeys = {
  all: ['scheduleInstances'] as const,
  forDate: (date: string) => ['scheduleInstances', 'date', date] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useScheduleInstancesForDate(date: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: scheduleKeys.forDate(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_instances')
        .select(`
          *,
          activity:source_activity_id (
            id, title, priority, status, section_type,
            estimated_minutes, remaining_minutes, linked_project_id
          ),
          meeting:source_meeting_id (
            id, title, location, agenda
          )
        `)
        .eq('user_id', user!.id)
        .eq('schedule_date', date)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!date,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useScheduleActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      scheduleDate,
      startAt,
      endAt,
      focusMinutes,
    }: {
      activityId: string;
      scheduleDate: string;
      startAt: string;
      endAt: string;
      focusMinutes: number;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // 1. Validate not in the past
      if (!canScheduleAt(startAt)) {
        throw new Error('Cannot schedule in the past');
      }

      // 2. Compute locked_minutes from wall-clock duration
      const lockedMinutes = Math.round(
        (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000
      );

      const lockedErr = validateLockedMinutes(lockedMinutes, startAt, endAt);
      if (lockedErr) throw new Error(lockedErr);

      // 3. Fetch activity — validate ownership and remaining time
      const { data: activity, error: actErr } = await supabase
        .from('activities')
        .select('id, remaining_minutes, estimated_minutes, linked_project_id, status')
        .eq('id', activityId)
        .eq('user_id', user.id)
        .single();

      if (actErr || !activity) throw new Error('Activity not found');
      if (activity.status === 'completed' || activity.status === 'cancelled') {
        throw new Error('Cannot schedule a completed or cancelled activity');
      }

      const focusErr = validateFocusMinutes(focusMinutes, activity.remaining_minutes);
      if (focusErr) throw new Error(focusErr);

      // 4. Fetch existing instances for overlap check
      const { data: existing } = await supabase
        .from('schedule_instances')
        .select(
          'id, start_at, end_at, source_activity_id, source_meeting_id, source_event_id, source_type, schedule_date, locked_minutes, focus_minutes, status_snapshot, keep_as_history, created_at, updated_at, user_id'
        )
        .eq('user_id', user.id)
        .eq('schedule_date', scheduleDate);

      const { overlaps, conflictingInstances } = checkScheduleOverlap(
        existing ?? [],
        startAt,
        endAt
      );

      if (overlaps) {
        throw new Error(
          `Time slot conflicts with ${conflictingInstances.length} existing block(s)`
        );
      }

      // 5. Insert schedule instance
      const { error: insertErr } = await supabase.from('schedule_instances').insert({
        user_id: user.id,
        source_type: 'activity',
        source_activity_id: activityId,
        source_meeting_id: null,
        source_event_id: null,
        schedule_date: scheduleDate,
        start_at: startAt,
        end_at: endAt,
        locked_minutes: lockedMinutes,
        focus_minutes: focusMinutes,
        status_snapshot: 'upcoming',
        keep_as_history: true,
      });

      if (insertErr) throw new Error(insertErr.message);

      // 6. Decrement remaining_minutes on activity
      const newRemaining = Math.max(0, activity.remaining_minutes - focusMinutes);
      await supabase
        .from('activities')
        .update({ remaining_minutes: newRemaining, updated_at: new Date().toISOString() })
        .eq('id', activityId)
        .eq('user_id', user.id);

      return { linkedProjectId: activity.linked_project_id };
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: scheduleKeys.forDate(vars.scheduleDate) });
      qc.invalidateQueries({ queryKey: activityKeys.all });
      if (data?.linkedProjectId) {
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });
}

export function useUnscheduleActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instanceId,
      activityId,
      scheduleDate,
    }: {
      instanceId: string;
      activityId: string;
      scheduleDate: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Fetch instance to get focus_minutes and validate ownership
      const { data: instance, error: instErr } = await supabase
        .from('schedule_instances')
        .select('id, start_at, focus_minutes, source_activity_id')
        .eq('id', instanceId)
        .eq('user_id', user.id)
        .single();

      if (instErr || !instance) throw new Error('Schedule block not found');

      // Only allow removing future blocks
      if (!canScheduleAt(instance.start_at)) {
        throw new Error('Cannot remove a past scheduled block (kept as history)');
      }

      // Fetch activity to restore remaining_minutes
      const { data: activity } = await supabase
        .from('activities')
        .select('remaining_minutes, estimated_minutes, linked_project_id')
        .eq('id', activityId)
        .eq('user_id', user.id)
        .single();

      // Delete the instance
      const { error: delErr } = await supabase
        .from('schedule_instances')
        .delete()
        .eq('id', instanceId)
        .eq('user_id', user.id);

      if (delErr) throw new Error(delErr.message);

      // Restore remaining_minutes (capped at estimated)
      if (activity && instance.focus_minutes) {
        const restored = Math.min(
          activity.remaining_minutes + instance.focus_minutes,
          activity.estimated_minutes
        );
        await supabase
          .from('activities')
          .update({ remaining_minutes: restored, updated_at: new Date().toISOString() })
          .eq('id', activityId)
          .eq('user_id', user.id);
      }

      return { linkedProjectId: activity?.linked_project_id, scheduleDate };
    },
    onSuccess: (data) => {
      if (data?.scheduleDate) {
        qc.invalidateQueries({ queryKey: scheduleKeys.forDate(data.scheduleDate) });
      }
      qc.invalidateQueries({ queryKey: activityKeys.all });
      if (data?.linkedProjectId) {
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });
}

export function useUnscheduleRunningBlock() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instanceId,
      activityId,
      mode,
      scheduleDate,
    }: {
      instanceId: string;
      activityId: string;
      mode: 'full' | 'split';
      scheduleDate: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: instance, error: instErr } = await supabase
        .from('schedule_instances')
        .select('id, start_at, end_at, focus_minutes, locked_minutes, source_activity_id')
        .eq('id', instanceId)
        .eq('user_id', user.id)
        .single();

      if (instErr || !instance) throw new Error('Schedule block not found');

      const now = new Date();
      const startMs = new Date(instance.start_at).getTime();
      const elapsedMin = Math.max(1, Math.floor((now.getTime() - startMs) / 60_000));
      const focusMin: number = instance.focus_minutes ?? instance.locked_minutes;
      const remainingMin = Math.max(0, focusMin - elapsedMin);

      const { data: activity } = await supabase
        .from('activities')
        .select('remaining_minutes, estimated_minutes, linked_project_id, hours_worked')
        .eq('id', activityId)
        .eq('user_id', user.id)
        .single();

      if (!activity) throw new Error('Activity not found');

      if (mode === 'full') {
        // Delete the block and restore all focus_minutes
        const { error: delErr } = await supabase
          .from('schedule_instances')
          .delete()
          .eq('id', instanceId)
          .eq('user_id', user.id);

        if (delErr) throw new Error(delErr.message);

        const restored = Math.min(
          activity.remaining_minutes + focusMin,
          activity.estimated_minutes
        );
        await supabase
          .from('activities')
          .update({ remaining_minutes: restored, updated_at: now.toISOString() })
          .eq('id', activityId)
          .eq('user_id', user.id);
      } else {
        // Split: truncate the block to elapsed time, mark completed
        const { error: updErr } = await supabase
          .from('schedule_instances')
          .update({
            end_at: now.toISOString(),
            locked_minutes: elapsedMin,
            focus_minutes: elapsedMin,
            status_snapshot: 'completed',
            updated_at: now.toISOString(),
          })
          .eq('id', instanceId)
          .eq('user_id', user.id);

        if (updErr) throw new Error(updErr.message);

        // Credit elapsed time to hours_worked; restore unelapsed portion to remaining
        const activityUpdate: Record<string, unknown> = {
          hours_worked: (activity.hours_worked ?? 0) + elapsedMin,
          updated_at: now.toISOString(),
        };
        if (remainingMin > 0) {
          activityUpdate.remaining_minutes = Math.min(
            activity.remaining_minutes + remainingMin,
            activity.estimated_minutes
          );
        }
        await supabase
          .from('activities')
          .update(activityUpdate)
          .eq('id', activityId)
          .eq('user_id', user.id);
      }

      return { linkedProjectId: activity.linked_project_id, scheduleDate };
    },
    onSuccess: (data) => {
      if (data?.scheduleDate) {
        qc.invalidateQueries({ queryKey: scheduleKeys.forDate(data.scheduleDate) });
      }
      qc.invalidateQueries({ queryKey: activityKeys.all });
      if (data?.linkedProjectId) {
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });
}

export function useUpdateScheduleBlockStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instanceId,
      status,
      scheduleDate,
    }: {
      instanceId: string;
      status: 'upcoming' | 'working' | 'completed' | 'postponed' | 'missed';
      scheduleDate: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Fetch instance to get source_activity_id
      const { data: instance } = await supabase
        .from('schedule_instances')
        .select('source_activity_id, source_type')
        .eq('id', instanceId)
        .eq('user_id', user.id)
        .single();

      // Update schedule block status
      const { error } = await supabase
        .from('schedule_instances')
        .update({ status_snapshot: status, updated_at: new Date().toISOString() })
        .eq('id', instanceId)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);

      // Sync to activity status
      if (instance?.source_type === 'activity' && instance.source_activity_id) {
        const activityStatusMap: Record<string, string | null> = {
          completed: 'completed',
          working: 'working',
          postponed: 'postponed',
          missed: 'not_started',
          upcoming: null,
        };
        const activityStatus = activityStatusMap[status];

        if (activityStatus) {
          const { data: activity } = await supabase
            .from('activities')
            .select('linked_project_id, hours_worked')
            .eq('id', instance.source_activity_id)
            .eq('user_id', user.id)
            .single();

          // When block completes, credit focus_minutes to hours_worked
          const { data: blockData } = await supabase
            .from('schedule_instances')
            .select('focus_minutes, locked_minutes')
            .eq('id', instanceId)
            .eq('user_id', user.id)
            .single();

          const workedMinutes = blockData?.focus_minutes ?? blockData?.locked_minutes ?? 0;
          const hoursWorkedUpdate =
            status === 'completed' && activity
              ? { hours_worked: (activity.hours_worked ?? 0) + workedMinutes }
              : {};

          await supabase
            .from('activities')
            .update({
              status: activityStatus,
              updated_at: new Date().toISOString(),
              ...hoursWorkedUpdate,
            })
            .eq('id', instance.source_activity_id)
            .eq('user_id', user.id);

          return { linkedProjectId: activity?.linked_project_id, scheduleDate };
        }
      }

      return { linkedProjectId: null, scheduleDate };
    },
    onSuccess: (data) => {
      if (data?.scheduleDate) {
        qc.invalidateQueries({ queryKey: scheduleKeys.forDate(data.scheduleDate) });
      }
      qc.invalidateQueries({ queryKey: activityKeys.all });
      if (data?.linkedProjectId) {
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });
}
