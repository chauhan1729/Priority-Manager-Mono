import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Contact, ContactCategory } from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const contactKeys = {
  all: ['contacts'] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: contactKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_deleted', false)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!user,
  });
}

// ---------------------------------------------------------------------------
// Mutation input types
// ---------------------------------------------------------------------------

export interface CreateContactInput {
  full_name: string;
  category: ContactCategory;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
}

export interface UpdateContactInput {
  id: string;
  full_name: string;
  category: ContactCategory;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateContact() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (!input.full_name.trim()) throw new Error('Name is required.');

      const { error } = await supabase.from('contacts').insert({
        user_id: user.id,
        category: input.category,
        full_name: input.full_name.trim(),
        company: input.company?.trim() || null,
        role: input.role?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        note: input.note?.trim() || null,
        is_deleted: false,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useUpdateContact() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateContactInput) => {
      if (!user) throw new Error('Not authenticated.');
      if (!input.full_name.trim()) throw new Error('Name is required.');

      const { error } = await supabase
        .from('contacts')
        .update({
          category: input.category,
          full_name: input.full_name.trim(),
          company: input.company?.trim() || null,
          role: input.role?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

/** Separate mutation for rolling note — spec §10.7 quick in-drawer save. */
export function useUpdateContactNote() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      if (!user) throw new Error('Not authenticated.');

      const { error } = await supabase
        .from('contacts')
        .update({ note: note.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

/**
 * Delete a contact.
 * mode "soft":   Set is_deleted = true. Historical activity FK intact.
 * mode "unlink": Set is_deleted = true AND null out delegated_contact_id on linked activities.
 * Spec §10.7 safe-delete rules.
 */
export function useDeleteContact() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'soft' | 'unlink' }) => {
      if (!user) throw new Error('Not authenticated.');

      if (mode === 'unlink') {
        const { error: unlinkErr } = await supabase
          .from('activities')
          .update({ delegated_contact_id: null, updated_at: new Date().toISOString() })
          .eq('delegated_contact_id', id)
          .eq('user_id', user.id);
        if (unlinkErr) throw new Error(unlinkErr.message);
      }

      const { error } = await supabase
        .from('contacts')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
