import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildRecurringDates,
  canCreateActivityOnDate,
  MAX_A_PRIORITY_PER_DAY,
} from '@pm/domain';
import type { ActivityRecurrenceRule } from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const activityKeys = {
  all: ['activities'] as const,
  forDate: (date: string) => ['activities', 'date', date] as const,
  archivedForDate: (date: string) => ['activities', 'archived', date] as const,
  forProject: (projectId: string) => ['activities', 'project', projectId] as const,
  forContact: (contactId: string) => ['activities', 'contact', contactId] as const,
  previousDayIncomplete: (date: string) => ['activities', 'carry-forward', date] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useActivitiesForDate(date: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: activityKeys.forDate(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .eq('activity_date', date)
        .eq('archived', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!date,
  });
}

export function useActivitiesForProject(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: activityKeys.forProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .eq('linked_project_id', projectId)
        .eq('archived', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });
}

/** Returns active (not completed/cancelled) delegated activities for a contact. */
export function useActivitiesForContact(contactId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: activityKeys.forContact(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .eq('delegated_contact_id', contactId)
        .not('status', 'in', '(completed,cancelled)')
        .eq('archived', false)
        .order('activity_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!contactId,
  });
}

export function useArchivedActivitiesForDate(date: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: activityKeys.archivedForDate(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .eq('activity_date', date)
        .eq('archived', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!date,
  });
}

export function usePreviousDayIncomplete(previousDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: activityKeys.previousDayIncomplete(previousDate),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .eq('activity_date', previousDate)
        .in('status', ['not_started', 'postponed'])
        .eq('archived', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!previousDate,
  });
}

// ---------------------------------------------------------------------------
// Mutation input types
// ---------------------------------------------------------------------------

export interface CreateActivityInput {
  title: string;
  activity_date: string;
  section_type: string;
  priority?: string | null;
  linked_project_id?: string | null;
  delegated_contact_id?: string | null;
  estimated_minutes: number;
  note?: string | null;
  recurrence_rule?: ActivityRecurrenceRule | null;
}

export interface UpdateActivityInput {
  id: string;
  title: string;
  activity_date: string;
  section_type: string;
  priority?: string | null;
  linked_project_id?: string | null;
  delegated_contact_id?: string | null;
  estimated_minutes: number;
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateActivityInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (!input.title?.trim()) throw new Error('Title is required.');
      if (!canCreateActivityOnDate(input.activity_date)) {
        throw new Error('Cannot create activities in the past.');
      }
      if (input.section_type === 'delegated' && !input.delegated_contact_id) {
        throw new Error('Delegated activities require a contact.');
      }
      if (input.section_type === 'work' && !input.linked_project_id) {
        throw new Error('Work activities must be linked to a project.');
      }

      // Verify delegated contact belongs to this user
      if (input.section_type === 'delegated' && input.delegated_contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('id', input.delegated_contact_id)
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .single();
        if (!contact) throw new Error('Contact not found.');
      }

      // A-priority cap
      if (input.priority === 'A') {
        const { count } = await supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('activity_date', input.activity_date)
          .eq('priority', 'A');
        if ((count ?? 0) >= MAX_A_PRIORITY_PER_DAY) {
          throw new Error(`Maximum ${MAX_A_PRIORITY_PER_DAY} A-priority activities allowed per day.`);
        }
      }

      const base = {
        user_id: user.id,
        title: input.title.trim(),
        section_type: input.section_type,
        priority: input.priority ?? 'B', // Phase 0A: priority mandatory, default B.
        estimated_minutes: input.estimated_minutes,
        remaining_minutes: input.estimated_minutes,
        status: 'not_started' as const,
        linked_project_id: input.linked_project_id ?? null,
        delegated_contact_id:
          input.section_type === 'delegated' ? (input.delegated_contact_id ?? null) : null,
        note: input.note ?? null,
        origin_type: 'manual' as const,
        moved_from_date: null,
        recurrence_rule: input.recurrence_rule ?? null,
      };

      const { error } = await supabase
        .from('activities')
        .insert({ ...base, activity_date: input.activity_date });
      if (error) throw new Error(error.message);

      // Recurring siblings: 3 future copies (daily +3d, weekly +3w, monthly +3mo)
      if (input.recurrence_rule) {
        const siblings = buildRecurringDates(input.activity_date, input.recurrence_rule, 3);
        for (const sibDate of siblings) {
          await supabase
            .from('activities')
            .insert({ ...base, activity_date: sibDate });
        }
      }
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      if (input.linked_project_id) {
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
      qc.invalidateQueries({ queryKey: ['monthly_priorities'] });
    },
  });
}

export function useUpdateActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateActivityInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (!input.title?.trim()) throw new Error('Title is required.');
      if (!canCreateActivityOnDate(input.activity_date)) {
        throw new Error('Cannot move activities to a past date.');
      }
      if (input.section_type === 'work' && !input.linked_project_id) {
        throw new Error('Work activities must be linked to a project.');
      }
      if (input.section_type === 'delegated' && !input.delegated_contact_id) {
        throw new Error('Delegated activities require a contact.');
      }

      // Verify delegated contact belongs to this user
      if (input.section_type === 'delegated' && input.delegated_contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('id', input.delegated_contact_id)
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .single();
        if (!contact) throw new Error('Contact not found.');
      }

      // A-priority cap (exclude self)
      if (input.priority === 'A') {
        const { count } = await supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('activity_date', input.activity_date)
          .eq('priority', 'A')
          .neq('id', input.id);
        if ((count ?? 0) >= MAX_A_PRIORITY_PER_DAY) {
          throw new Error(`Maximum ${MAX_A_PRIORITY_PER_DAY} A-priority activities allowed per day.`);
        }
      }

      // Preserve remaining_minutes when estimate unchanged (don't stomp logged time)
      const { data: existing } = await supabase
        .from('activities')
        .select('estimated_minutes, remaining_minutes')
        .eq('id', input.id)
        .eq('user_id', user.id)
        .single();

      const estimateChanged =
        !existing || existing.estimated_minutes !== input.estimated_minutes;
      const newRemaining = estimateChanged
        ? input.estimated_minutes
        : (existing?.remaining_minutes ?? input.estimated_minutes);

      const { error } = await supabase
        .from('activities')
        .update({
          title: input.title.trim(),
          section_type: input.section_type,
          priority: input.priority ?? 'B', // Phase 0A: priority mandatory, default B.
          activity_date: input.activity_date,
          estimated_minutes: input.estimated_minutes,
          remaining_minutes: newRemaining,
          linked_project_id: input.linked_project_id ?? null,
          delegated_contact_id:
            input.section_type === 'delegated' ? (input.delegated_contact_id ?? null) : null,
          note: input.note ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      if (input.linked_project_id) {
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
      qc.invalidateQueries({ queryKey: ['monthly_priorities'] });
      qc.invalidateQueries({ queryKey: ['schedule_instances'] });
    },
  });
}

export function useUpdateActivityStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      status,
    }: {
      activityId: string;
      status: string;
    }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('activities')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', activityId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function usePostponeActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      toDate,
      currentDate,
    }: {
      activityId: string;
      toDate: string;
      currentDate: string;
    }) => {
      if (!user) throw new Error('Not authenticated.');
      if (!canCreateActivityOnDate(toDate)) {
        throw new Error('Cannot postpone to a past date.');
      }

      // First-move-wins: fetch existing moved_from_date
      const { data: existing } = await supabase
        .from('activities')
        .select('moved_from_date')
        .eq('id', activityId)
        .eq('user_id', user.id)
        .single();

      const movedFromDate = existing?.moved_from_date ?? currentDate;

      const { error } = await supabase
        .from('activities')
        .update({
          activity_date: toDate,
          status: 'postponed',
          moved_from_date: movedFromDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activityId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function useCarryForwardActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      fromDate,
      toDate,
    }: {
      activityId: string;
      fromDate: string;
      toDate: string;
      linkedProjectId?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated.');

      // First-move-wins: fetch existing moved_from_date
      const { data: existing } = await supabase
        .from('activities')
        .select('moved_from_date')
        .eq('id', activityId)
        .eq('user_id', user.id)
        .single();

      const movedFromDate = existing?.moved_from_date ?? fromDate;

      const { error } = await supabase
        .from('activities')
        .update({
          activity_date: toDate,
          origin_type: 'carry_forward',
          moved_from_date: movedFromDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activityId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      if (input.linkedProjectId) {
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
      qc.invalidateQueries({ queryKey: ['schedule_instances'] });
    },
  });
}

export function useDelegateActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      contactId,
    }: {
      activityId: string;
      contactId: string;
    }) => {
      if (!user) throw new Error('Not authenticated.');

      // Verify contact belongs to this user
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .single();
      if (!contact) throw new Error('Contact not found.');

      const { error } = await supabase
        .from('activities')
        .update({
          status: 'delegated',
          section_type: 'delegated',
          delegated_contact_id: contactId,
          linked_project_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activityId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useArchiveActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ activityId }: { activityId: string }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('activities')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', activityId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function useDeleteActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      linkedProjectId,
    }: {
      activityId: string;
      linkedProjectId?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return { linkedProjectId };
    },
    onSuccess: (_data) => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      if (_data?.linkedProjectId) {
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Bulk mutation hooks
// ---------------------------------------------------------------------------

export function useBulkMoveActivities() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityIds,
      toDate,
      fromDate,
    }: {
      activityIds: string[];
      toDate: string;
      fromDate: string;
    }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('activities')
        .update({
          activity_date: toDate,
          status: 'postponed',
          moved_from_date: fromDate,
          updated_at: new Date().toISOString(),
        })
        .in('id', activityIds)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['schedule_instances'] });
    },
  });
}

export function useBulkUpdateStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityIds,
      status,
    }: {
      activityIds: string[];
      status: string;
    }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('activities')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', activityIds)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['schedule_instances'] });
    },
  });
}

export function useBulkArchiveActivities() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ activityIds }: { activityIds: string[] }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('activities')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .in('id', activityIds)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['schedule_instances'] });
    },
  });
}

export function useBulkDeleteActivities() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ activityIds }: { activityIds: string[] }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('activities')
        .delete()
        .in('id', activityIds)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['schedule_instances'] });
    },
  });
}

export function useUnarchiveActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ activityId }: { activityId: string }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('activities')
        .update({ archived: false, updated_at: new Date().toISOString() })
        .eq('id', activityId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}
