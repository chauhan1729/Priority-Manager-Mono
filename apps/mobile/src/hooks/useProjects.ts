import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { canCreateActivityOnDate } from '@pm/domain';
import type {
  MilestoneStatus,
  Project,
  ProjectMilestone,
  ProjectResource,
  ProjectStatus,
  ResourceStatus,
  ResourceType,
} from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const projectKeys = {
  all: ['projects'] as const,
  byId: (id: string) => ['projects', id] as const,
  milestones: (projectId: string) => ['projects', projectId, 'milestones'] as const,
  resources: (projectId: string) => ['projects', projectId, 'resources'] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });
}

export function useActiveProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...projectKeys.all, 'active'] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user!.id)
        .not('status', 'in', '("completed","archived")')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });
}

export function useProjectById(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: projectKeys.byId(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!user && !!id,
  });
}

export function useMilestones(projectId: string) {
  return useQuery({
    queryKey: projectKeys.milestones(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('target_date', { ascending: true });
      if (error) throw error;
      return data as ProjectMilestone[];
    },
    enabled: !!projectId,
  });
}

export function useResources(projectId: string) {
  return useQuery({
    queryKey: projectKeys.resources(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_resources')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ProjectResource[];
    },
    enabled: !!projectId,
  });
}

// ---------------------------------------------------------------------------
// Project mutation input types
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  start_date?: string | null;
  target_end_date?: string | null;
}

export interface UpdateProjectInput extends CreateProjectInput {
  id: string;
}

// ---------------------------------------------------------------------------
// Project mutations
// ---------------------------------------------------------------------------

export function useCreateProject() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (!input.name.trim()) throw new Error('Project name is required.');

      const { error } = await supabase.from('projects').insert({
        user_id: user.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        status: input.status ?? 'planned',
        start_date: input.start_date || null,
        target_end_date: input.target_end_date || null,
        notes: null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useUpdateProject() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProjectInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (!input.name.trim()) throw new Error('Project name is required.');

      const { error } = await supabase
        .from('projects')
        .update({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          status: input.status,
          start_date: input.start_date || null,
          target_end_date: input.target_end_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.byId(input.id) });
    },
  });
}

/**
 * Spec §10.10: Delete linked activities first (work activities require linked_project_id —
 * ON DELETE SET NULL would violate the DB constraint), then delete project.
 * Milestones and resources cascade automatically.
 */
export function useDeleteProject() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!user) throw new Error('Not authenticated.');

      const { error: actErr } = await supabase
        .from('activities')
        .delete()
        .eq('linked_project_id', id)
        .eq('user_id', user.id);
      if (actErr) throw new Error(actErr.message);

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Project activity mutations
// ---------------------------------------------------------------------------

export interface CreateProjectActivityInput {
  projectId: string;
  title: string;
  activity_date: string;
  section_type?: 'work' | 'delegated';
  delegated_contact_id?: string | null;
  estimated_hours: number;
  priority?: string | null;
  note?: string | null;
}

export function useCreateProjectActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectActivityInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (!input.title.trim()) throw new Error('Activity title is required.');
      if (!input.activity_date) throw new Error('Date is required.');
      if (!canCreateActivityOnDate(input.activity_date)) {
        throw new Error('Cannot create activities in the past.');
      }
      if (!input.estimated_hours || input.estimated_hours <= 0) {
        throw new Error('Estimated time must be positive.');
      }

      const sectionType = input.section_type ?? 'work';
      const isDelegated = sectionType === 'delegated';
      const estimatedMinutes = Math.round(input.estimated_hours * 60);

      if (isDelegated && !input.delegated_contact_id) {
        throw new Error('Delegated activities require a contact.');
      }

      if (isDelegated && input.delegated_contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('id', input.delegated_contact_id)
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .single();
        if (!contact) throw new Error('Contact not found.');
      }

      const { error } = await supabase.from('activities').insert({
        user_id: user.id,
        title: input.title.trim(),
        section_type: sectionType,
        priority: input.priority ?? 'B', // Phase 0A: priority mandatory, default B.
        activity_date: input.activity_date,
        estimated_minutes: estimatedMinutes,
        remaining_minutes: estimatedMinutes,
        status: 'not_started',
        linked_project_id: input.projectId,
        delegated_contact_id: isDelegated ? (input.delegated_contact_id ?? null) : null,
        note: input.note?.trim() || null,
        origin_type: 'project',
        moved_from_date: null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      qc.invalidateQueries({ queryKey: projectKeys.byId(input.projectId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Milestone mutations
// ---------------------------------------------------------------------------

export interface CreateMilestoneInput {
  projectId: string;
  title: string;
  target_date?: string | null;
}

export function useCreateMilestone() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMilestoneInput) => {
      if (!input.title.trim()) throw new Error('Milestone title is required.');

      const { error } = await supabase.from('project_milestones').insert({
        project_id: input.projectId,
        title: input.title.trim(),
        target_date: input.target_date || null,
        status: 'pending',
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.milestones(input.projectId) });
    },
  });
}

export function useUpdateMilestoneStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      milestoneId,
      projectId,
      status,
    }: {
      milestoneId: string;
      projectId: string;
      status: MilestoneStatus;
    }) => {
      const { error } = await supabase
        .from('project_milestones')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', milestoneId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.milestones(input.projectId) });
    },
  });
}

export interface UpdateMilestoneInput {
  milestoneId: string;
  projectId: string;
  title: string;
  target_date?: string | null;
  status: MilestoneStatus;
}

export function useUpdateMilestone() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMilestoneInput) => {
      if (!input.title.trim()) throw new Error('Milestone title is required.');
      const { error } = await supabase
        .from('project_milestones')
        .update({
          title: input.title.trim(),
          target_date: input.target_date || null,
          status: input.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.milestoneId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.milestones(input.projectId) });
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      milestoneId,
      projectId,
    }: {
      milestoneId: string;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', milestoneId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.milestones(input.projectId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Resource mutations
// ---------------------------------------------------------------------------

export interface CreateResourceInput {
  projectId: string;
  resource_type: ResourceType;
  title: string;
  note?: string | null;
  estimated_cost?: number | null;
  status?: ResourceStatus;
  needed_by_date?: string | null;
}

export function useCreateResource() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateResourceInput) => {
      if (!input.title.trim()) throw new Error('Resource title is required.');

      const { error } = await supabase.from('project_resources').insert({
        project_id: input.projectId,
        resource_type: input.resource_type,
        title: input.title.trim(),
        note: input.note?.trim() || null,
        estimated_cost: input.estimated_cost ?? null,
        status: input.status ?? 'needed',
        assigned_contact_id: null,
        needed_by_date: input.needed_by_date || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.resources(input.projectId) });
    },
  });
}

export interface UpdateResourceInput {
  resourceId: string;
  projectId: string;
  resource_type: ResourceType;
  title: string;
  note?: string | null;
  estimated_cost?: number | null;
  status: ResourceStatus;
  needed_by_date?: string | null;
}

export function useUpdateResource() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateResourceInput) => {
      if (!input.title.trim()) throw new Error('Resource title is required.');
      const { error } = await supabase
        .from('project_resources')
        .update({
          resource_type: input.resource_type,
          title: input.title.trim(),
          note: input.note?.trim() || null,
          estimated_cost: input.estimated_cost ?? null,
          status: input.status,
          needed_by_date: input.needed_by_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.resourceId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.resources(input.projectId) });
    },
  });
}

export function useUpdateResourceStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      resourceId,
      projectId,
      status,
    }: {
      resourceId: string;
      projectId: string;
      status: ResourceStatus;
    }) => {
      const { error } = await supabase
        .from('project_resources')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', resourceId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.resources(input.projectId) });
    },
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      resourceId,
      projectId,
    }: {
      resourceId: string;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from('project_resources')
        .delete()
        .eq('id', resourceId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.resources(input.projectId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Project notes
// ---------------------------------------------------------------------------

export function useUpdateProjectNotes() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      if (!user) throw new Error('Not authenticated.');

      const { error } = await supabase
        .from('projects')
        .update({ notes: notes || null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: projectKeys.byId(input.id) });
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
