import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  filterActive,
  filterArchived,
  groupGoalsBySection,
  isValidProgress,
  isValidSection,
  isValidStatus,
} from '@pm/domain';
import type { AnnualGoal, AnnualGoalSection, AnnualGoalStatus } from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const annualGoalKeys = {
  all: ['annualGoals'] as const,
  forYear: (year: number) => ['annualGoals', 'year', year] as const,
};

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

/**
 * Fetches all user's annual goals and filters client-side by year.
 * A goal is "for" a year if its target_date falls in that year,
 * or — when target_date is null — if its created_at falls in that year.
 */
export function useAnnualGoals(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: annualGoalKeys.forYear(year),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('annual_goals')
        .select('*')
        .eq('user_id', user!.id)
        .order('section', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      const goals = data as AnnualGoal[];
      return goals.filter((g) => {
        const dateStr = g.target_date ?? g.created_at;
        return new Date(dateStr).getFullYear() === year;
      });
    },
    enabled: !!user && !!year,
  });
}

// ---------------------------------------------------------------------------
// Derived helpers (re-exported for convenience)
// ---------------------------------------------------------------------------

export { filterActive, filterArchived, groupGoalsBySection };

// ---------------------------------------------------------------------------
// Mutation input types
// ---------------------------------------------------------------------------

export interface CreateAnnualGoalInput {
  section: AnnualGoalSection;
  title: string;
  description?: string;
  why_it_matters?: string;
  target_date?: string | null;
  notes?: string | null;
}

export interface UpdateAnnualGoalInput {
  id: string;
  title?: string;
  description?: string;
  why_it_matters?: string;
  target_date?: string | null;
  notes?: string | null;
  status?: AnnualGoalStatus;
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateAnnualGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAnnualGoalInput) => {
      if (!user) throw new Error('Not authenticated.');
      const title = input.title.trim();
      if (!title) throw new Error('Title is required.');
      if (!isValidSection(input.section)) {
        throw new Error('Section must be business, career, or personal.');
      }

      const { error } = await supabase.from('annual_goals').insert({
        user_id: user.id,
        section: input.section,
        title,
        description: input.description?.trim() ?? '',
        why_it_matters: input.why_it_matters?.trim() ?? '',
        target_date: input.target_date ?? null,
        progress_percent: 0,
        status: 'not_started',
        notes: input.notes?.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: annualGoalKeys.all });
    },
  });
}

export function useUpdateAnnualGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAnnualGoalInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (input.status !== undefined && !isValidStatus(input.status)) {
        throw new Error('Invalid status.');
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.title !== undefined) {
        const title = input.title.trim();
        if (!title) throw new Error('Title is required.');
        updatePayload.title = title;
      }
      if (input.description !== undefined) updatePayload.description = input.description.trim();
      if (input.why_it_matters !== undefined) updatePayload.why_it_matters = input.why_it_matters.trim();
      if ('target_date' in input) updatePayload.target_date = input.target_date ?? null;
      if ('notes' in input) updatePayload.notes = input.notes?.trim() || null;
      if (input.status !== undefined) updatePayload.status = input.status;

      const { error } = await supabase
        .from('annual_goals')
        .update(updatePayload)
        .eq('id', input.id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: annualGoalKeys.all });
    },
  });
}

export function useUpdateGoalProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, progressPercent }: { id: string; progressPercent: number }) => {
      if (!user) throw new Error('Not authenticated.');
      if (!isValidProgress(progressPercent)) {
        throw new Error('Progress must be an integer between 0 and 100.');
      }
      const { error } = await supabase
        .from('annual_goals')
        .update({ progress_percent: progressPercent, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: annualGoalKeys.all });
    },
  });
}

export function useDeleteAnnualGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!user) throw new Error('Not authenticated.');
      const { error } = await supabase
        .from('annual_goals')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: annualGoalKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Links a project to an annual goal by updating projects.linked_annual_goal_id.
 * Spec §10.3: the FK lives on the project, not the goal.
 */
export function useLinkProjectToGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, projectId }: { goalId: string; projectId: string }) => {
      if (!user) throw new Error('Not authenticated.');

      // Verify goal is not archived
      const { data: goal, error: goalError } = await supabase
        .from('annual_goals')
        .select('id, status')
        .eq('id', goalId)
        .eq('user_id', user.id)
        .single();
      if (goalError || !goal) throw new Error('Goal not found.');
      if (goal.status === 'completed' || goal.status === 'dropped') {
        throw new Error('Cannot link projects to an archived goal.');
      }

      const { error } = await supabase
        .from('projects')
        .update({ linked_annual_goal_id: goalId, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: annualGoalKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUnlinkProjectFromGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, projectId }: { goalId: string; projectId: string }) => {
      if (!user) throw new Error('Not authenticated.');

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, linked_annual_goal_id')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();
      if (projectError || !project) throw new Error('Project not found.');
      if (project.linked_annual_goal_id !== goalId) {
        throw new Error('Project is not linked to this goal.');
      }

      const { error } = await supabase
        .from('projects')
        .update({ linked_annual_goal_id: null, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: annualGoalKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
