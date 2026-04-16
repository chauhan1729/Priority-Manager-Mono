import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  canAddPriority,
  getNextMonthKey,
  isEligibleForCarryForward,
  isValidManualProgress,
  isValidMonthKey,
  isValidMPSection,
  isValidMPStatus,
  MAX_PRIORITIES_PER_SECTION,
} from '@pm/domain';
import type {
  MonthlyPriority,
  MonthlyPrioritySection,
  MonthlyPriorityStatus,
  ProgressMode,
} from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const monthlyPriorityKeys = {
  all: ['monthlyPriorities'] as const,
  forMonth: (monthKey: string) => ['monthlyPriorities', 'month', monthKey] as const,
};

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

export function useMonthlyPriorities(monthKey: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: monthlyPriorityKeys.forMonth(monthKey),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_priorities')
        .select('*')
        .eq('user_id', user!.id)
        .eq('month_key', monthKey)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as MonthlyPriority[];
    },
    enabled: !!user && isValidMonthKey(monthKey),
  });
}

/**
 * Returns all monthly priorities for the user, across all months.
 * Useful for building an id→title map in cross-module screens (e.g., project list).
 */
export function useAllMonthlyPriorities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: monthlyPriorityKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_priorities')
        .select('id, title, month_key')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data as { id: string; title: string; month_key: string }[];
    },
    enabled: !!user,
  });
}

// ---------------------------------------------------------------------------
// Mutation input types
// ---------------------------------------------------------------------------

export interface CreateMonthlyPriorityInput {
  section: MonthlyPrioritySection;
  title: string;
  month_key: string;
  category?: string | null;
  started_date?: string | null;
  target_date?: string | null;
  linked_annual_goal_id?: string | null;
  linked_project_id?: string | null;
  progress_mode?: ProgressMode;
  note?: string | null;
  pinned?: boolean;
}

export interface UpdateMonthlyPriorityInput {
  id: string;
  title?: string;
  category?: string | null;
  started_date?: string | null;
  target_date?: string | null;
  linked_annual_goal_id?: string | null;
  linked_project_id?: string | null;
  progress_mode?: ProgressMode;
  status?: MonthlyPriorityStatus;
  note?: string | null;
  pinned?: boolean;
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateMonthlyPriority() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMonthlyPriorityInput) => {
      if (!user) throw new Error('Not authenticated.');

      const title = input.title.trim();
      if (!title) throw new Error('Title is required.');
      if (!isValidMPSection(input.section)) throw new Error('Invalid section.');
      if (!isValidMonthKey(input.month_key)) throw new Error('Invalid month key.');

      const progressMode = input.progress_mode ?? 'manual';
      if (progressMode === 'auto_project' && !input.linked_project_id) {
        throw new Error('Auto progress requires a linked project.');
      }

      // Enforce section limit (spec §10.4: hard block at 5)
      const { data: existing, error: countError } = await supabase
        .from('monthly_priorities')
        .select('id')
        .eq('user_id', user.id)
        .eq('section', input.section)
        .eq('month_key', input.month_key);
      if (countError) throw new Error(countError.message);
      if ((existing ?? []).length >= MAX_PRIORITIES_PER_SECTION) {
        throw new Error(
          `Section is full. Maximum ${MAX_PRIORITIES_PER_SECTION} priorities per section per month.`,
        );
      }

      const { error } = await supabase.from('monthly_priorities').insert({
        user_id: user.id,
        section: input.section,
        title,
        month_key: input.month_key,
        category: input.category?.trim() || null,
        started_date: input.started_date ?? null,
        assigned_date: null,
        target_date: input.target_date ?? null,
        linked_annual_goal_id: input.linked_annual_goal_id ?? null,
        linked_project_id: input.linked_project_id ?? null,
        progress_mode: progressMode,
        manual_progress_percent: 0,
        status: 'planned',
        note: input.note?.trim() || null,
        pinned: input.pinned ?? false,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: monthlyPriorityKeys.forMonth(input.month_key) });
    },
  });
}

export function useUpdateMonthlyPriority() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMonthlyPriorityInput & { month_key: string }) => {
      if (!user) throw new Error('Not authenticated.');
      if (input.status !== undefined && !isValidMPStatus(input.status)) {
        throw new Error('Invalid status.');
      }

      // Fetch existing to validate progress_mode/project relationship
      const { data: existing, error: fetchError } = await supabase
        .from('monthly_priorities')
        .select('id, linked_project_id, progress_mode')
        .eq('id', input.id)
        .eq('user_id', user.id)
        .single();
      if (fetchError || !existing) throw new Error('Priority not found.');

      const newProgressMode = input.progress_mode ?? existing.progress_mode;
      const newLinkedProject =
        'linked_project_id' in input ? input.linked_project_id : existing.linked_project_id;

      if (newProgressMode === 'auto_project' && !newLinkedProject) {
        throw new Error('Auto progress requires a linked project.');
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.title !== undefined) {
        const title = input.title.trim();
        if (!title) throw new Error('Title is required.');
        updatePayload.title = title;
      }
      if ('category' in input) updatePayload.category = input.category?.trim() || null;
      if ('started_date' in input) updatePayload.started_date = input.started_date ?? null;
      if ('target_date' in input) updatePayload.target_date = input.target_date ?? null;
      if ('linked_annual_goal_id' in input) {
        updatePayload.linked_annual_goal_id = input.linked_annual_goal_id ?? null;
      }
      if ('linked_project_id' in input) {
        updatePayload.linked_project_id = input.linked_project_id ?? null;
        // If project unlinked, force manual mode
        if (!input.linked_project_id) updatePayload.progress_mode = 'manual';
      }
      if (input.progress_mode !== undefined) updatePayload.progress_mode = input.progress_mode;
      if (input.status !== undefined) updatePayload.status = input.status;
      if ('note' in input) updatePayload.note = input.note?.trim() || null;
      if (input.pinned !== undefined) updatePayload.pinned = input.pinned;

      const { error } = await supabase
        .from('monthly_priorities')
        .update(updatePayload)
        .eq('id', input.id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: monthlyPriorityKeys.forMonth(input.month_key) });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdatePriorityStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      month_key,
    }: {
      id: string;
      status: MonthlyPriorityStatus;
      month_key: string;
    }) => {
      if (!user) throw new Error('Not authenticated.');
      if (!isValidMPStatus(status)) throw new Error('Invalid status.');
      const { error } = await supabase
        .from('monthly_priorities')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: monthlyPriorityKeys.forMonth(input.month_key) });
    },
  });
}

export function useUpdatePriorityProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      progressPercent,
      month_key,
    }: {
      id: string;
      progressPercent: number;
      month_key: string;
    }) => {
      if (!user) throw new Error('Not authenticated.');
      if (!isValidManualProgress(progressPercent)) {
        throw new Error('Progress must be an integer between 0 and 100.');
      }
      // Verify manual mode
      const { data: existing, error: fetchError } = await supabase
        .from('monthly_priorities')
        .select('progress_mode')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (fetchError || !existing) throw new Error('Priority not found.');
      if (existing.progress_mode !== 'manual') {
        throw new Error('Progress is auto-computed from the linked project.');
      }
      const { error } = await supabase
        .from('monthly_priorities')
        .update({
          manual_progress_percent: progressPercent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: monthlyPriorityKeys.forMonth(input.month_key) });
    },
  });
}

export function useDeleteMonthlyPriority() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, month_key }: { id: string; month_key: string }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('monthly_priorities')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: monthlyPriorityKeys.forMonth(input.month_key) });
    },
  });
}

/**
 * Spec §10.4: creates a new priority record in target month.
 * Checks eligibility + linked project status = in_progress.
 * Historical record is preserved.
 */
export function useCarryForwardPriority() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      priorityId,
      targetMonthKey,
      sourceMonthKey,
    }: {
      priorityId: string;
      targetMonthKey?: string;
      sourceMonthKey: string;
    }) => {
      if (!user) throw new Error('Not authenticated.');

      const { data: source, error: fetchError } = await supabase
        .from('monthly_priorities')
        .select('*')
        .eq('id', priorityId)
        .eq('user_id', user.id)
        .single();
      if (fetchError || !source) throw new Error('Priority not found.');

      const priority = source as MonthlyPriority;
      if (!isEligibleForCarryForward(priority)) {
        throw new Error(
          'Priority must have a linked project and not be completed or dropped.',
        );
      }

      // Verify linked project is still in progress
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, status')
        .eq('id', priority.linked_project_id!)
        .eq('user_id', user.id)
        .single();
      if (projectError || !project) throw new Error('Linked project not found.');
      if (project.status !== 'in_progress') {
        throw new Error(
          `Linked project is "${project.status}" — carry-forward requires an in-progress project.`,
        );
      }

      const nextKey = targetMonthKey ?? getNextMonthKey(priority.month_key);
      if (!isValidMonthKey(nextKey)) throw new Error('Invalid target month.');

      // Check target month capacity
      const { data: targetExisting, error: countError } = await supabase
        .from('monthly_priorities')
        .select('id')
        .eq('user_id', user.id)
        .eq('section', priority.section)
        .eq('month_key', nextKey);
      if (countError) throw new Error(countError.message);
      if ((targetExisting ?? []).length >= MAX_PRIORITIES_PER_SECTION) {
        throw new Error(
          `Target month section is full (max ${MAX_PRIORITIES_PER_SECTION} priorities).`,
        );
      }

      const { error: insertError } = await supabase.from('monthly_priorities').insert({
        user_id: user.id,
        section: priority.section,
        title: priority.title,
        month_key: nextKey,
        category: priority.category,
        started_date: priority.started_date,
        assigned_date: priority.assigned_date,
        target_date: priority.target_date,
        linked_annual_goal_id: priority.linked_annual_goal_id,
        linked_project_id: priority.linked_project_id,
        progress_mode: priority.progress_mode,
        manual_progress_percent: priority.manual_progress_percent,
        status: 'planned',
        note: priority.note,
        pinned: false,
      });
      if (insertError) throw new Error(insertError.message);

      return { nextKey };
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: monthlyPriorityKeys.forMonth(input.sourceMonthKey) });
      if (_data?.nextKey) {
        qc.invalidateQueries({ queryKey: monthlyPriorityKeys.forMonth(_data.nextKey) });
      }
    },
  });
}
