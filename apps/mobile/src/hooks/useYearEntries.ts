import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildLinkedProjectName,
  entryOverlapsYear,
} from '@pm/domain';
import type {
  AvailabilityStatus,
  YearEntry,
  YearEntryType,
} from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const yearEntryKeys = {
  all: ['yearEntries'] as const,
  forYear: (year: number) => ['yearEntries', 'year', year] as const,
};

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

/**
 * Returns all year entries that overlap the given year.
 * Fetches all user entries and filters client-side with `entryOverlapsYear` so
 * that birthday entries (stored with their original year) are always included.
 * Spec §10.1: birthdays have annual recurrence — they appear in every year's grid.
 */
export function useYearEntries(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: yearEntryKeys.forYear(year),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('year_entries')
        .select('*')
        .eq('user_id', user!.id)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return (data as YearEntry[]).filter((e) => entryOverlapsYear(e, year));
    },
    enabled: !!user && !!year,
  });
}

// ---------------------------------------------------------------------------
// Mutation input types
// ---------------------------------------------------------------------------

export interface CreateYearEntryInput {
  type: YearEntryType;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  note?: string | null;
  availability_status?: AvailabilityStatus | null;
  create_linked_trip_plan?: boolean;
}

export interface UpdateYearEntryInput {
  id: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  location?: string | null;
  note?: string | null;
  availability_status?: AvailabilityStatus | null;
  create_linked_trip_plan?: boolean;
}

// ---------------------------------------------------------------------------
// Shared validation
// ---------------------------------------------------------------------------

function validateEntryData(data: {
  type: YearEntryType;
  title: string;
  start_date: string;
  end_date?: string | null;
  availability_status?: AvailabilityStatus | null;
  create_linked_trip_plan?: boolean;
}): string | null {
  if (!data.title.trim()) return 'Title is required.';
  if (!data.start_date) return 'Start date is required.';

  if (data.type === 'birthday') {
    if (data.end_date) return 'Birthday entries cannot have an end date.';
    if (data.create_linked_trip_plan) return 'Birthday entries cannot have linked trip plans.';
  }

  if (data.type !== 'birthday' && !data.availability_status) {
    return 'Availability status is required for travel/away entries.';
  }

  if (data.end_date && data.end_date < data.start_date) {
    return 'End date must be on or after start date.';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateYearEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateYearEntryInput) => {
      if (!user) throw new Error('Not authenticated.');

      const validationError = validateEntryData(input);
      if (validationError) throw new Error(validationError);

      const { data: entry, error: entryError } = await supabase
        .from('year_entries')
        .insert({
          user_id: user.id,
          type: input.type,
          title: input.title.trim(),
          start_date: input.start_date,
          end_date: input.end_date ?? null,
          location: input.location?.trim() ?? null,
          note: input.note?.trim() ?? null,
          availability_status:
            input.type !== 'birthday' ? (input.availability_status ?? null) : null,
          create_linked_trip_plan: input.create_linked_trip_plan ?? false,
          linked_project_id: null,
        })
        .select('id')
        .single();

      if (entryError || !entry) {
        throw new Error(entryError?.message ?? 'Failed to create entry.');
      }

      // Create linked trip plan if requested (travel/away only — spec §10.1)
      if (input.create_linked_trip_plan && input.type !== 'birthday') {
        const projectName = buildLinkedProjectName({ title: input.title.trim() });

        const { data: project, error: projectError } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name: projectName,
            description: null,
            status: 'in_progress',
            start_date: input.start_date,
            target_end_date: input.end_date ?? null,
            notes: null,
          })
          .select('id')
          .single();

        if (!projectError && project) {
          await supabase
            .from('year_entries')
            .update({ linked_project_id: project.id })
            .eq('id', entry.id)
            .eq('user_id', user.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: yearEntryKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['calendarEvents'] });
    },
  });
}

export function useUpdateYearEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateYearEntryInput) => {
      if (!user) throw new Error('Not authenticated.');

      // Fetch existing to validate merged data (type is immutable)
      const { data: existing, error: fetchError } = await supabase
        .from('year_entries')
        .select('*')
        .eq('id', input.id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !existing) throw new Error('Entry not found.');

      const ex = existing as YearEntry;
      const mergedTitle = input.title ?? ex.title;
      const mergedStartDate = input.start_date ?? ex.start_date;
      const mergedEndDate = 'end_date' in input ? input.end_date : ex.end_date;
      const mergedAvailability =
        'availability_status' in input ? input.availability_status : ex.availability_status;
      const willCreatePlan = input.create_linked_trip_plan ?? ex.create_linked_trip_plan;

      const validationError = validateEntryData({
        type: ex.type,
        title: mergedTitle,
        start_date: mergedStartDate,
        end_date: mergedEndDate,
        availability_status: mergedAvailability,
        create_linked_trip_plan: willCreatePlan,
      });
      if (validationError) throw new Error(validationError);

      const { error } = await supabase
        .from('year_entries')
        .update({
          ...(input.title !== undefined && { title: input.title.trim() }),
          ...(input.start_date !== undefined && { start_date: input.start_date }),
          ...('end_date' in input && { end_date: input.end_date ?? null }),
          ...('location' in input && { location: input.location?.trim() ?? null }),
          ...('note' in input && { note: input.note?.trim() ?? null }),
          ...('availability_status' in input && {
            availability_status: input.availability_status ?? null,
          }),
          ...(input.create_linked_trip_plan !== undefined && {
            create_linked_trip_plan: input.create_linked_trip_plan,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);

      // Create linked trip plan if newly requested and none exists (spec §10.1)
      if (
        input.create_linked_trip_plan === true &&
        !ex.linked_project_id &&
        ex.type !== 'birthday'
      ) {
        const projectName = buildLinkedProjectName({ title: mergedTitle });

        const { data: project, error: projectError } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name: projectName,
            description: null,
            status: 'in_progress',
            start_date: mergedStartDate,
            target_end_date: mergedEndDate ?? null,
            notes: null,
          })
          .select('id')
          .single();

        if (!projectError && project) {
          await supabase
            .from('year_entries')
            .update({ linked_project_id: project.id })
            .eq('id', input.id)
            .eq('user_id', user.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: yearEntryKeys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['calendarEvents'] });
    },
  });
}

/**
 * Deletes year entry only — linked project is preserved (FK is ON DELETE SET NULL).
 * Spec §10.1: user deletes project separately via Project Planner if desired.
 */
export function useDeleteYearEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!user) throw new Error('Not authenticated.');

      const { error } = await supabase
        .from('year_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: yearEntryKeys.all });
      qc.invalidateQueries({ queryKey: ['calendarEvents'] });
    },
  });
}
