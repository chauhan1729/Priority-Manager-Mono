import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReminderPreference } from '@pm/types';
import type { User as AppUser } from '@pm/types';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

const reminderPrefKeys = {
  forUser: (userId: string) => ['reminderPreferences', userId] as const,
};

const profileKeys = {
  forUser: (userId: string) => ['profile', userId] as const,
};

// ---------------------------------------------------------------------------
// Reminder Preferences
// ---------------------------------------------------------------------------

export function useReminderPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: reminderPrefKeys.forUser(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminder_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ReminderPreference | null;
    },
    enabled: !!user,
  });
}

export type UpdateReminderPreferencesData = Partial<
  Pick<
    ReminderPreference,
    | 'eod_review_enabled'
    | 'eod_review_time'
    | 'meeting_reminder_minutes_before'
    | 'morning_summary_enabled'
    | 'morning_summary_time'
    | 'birthday_reminder_days_before'
    | 'travel_reminder_days_before'
    | 'renewal_reminder_days_before'
  >
>;

export function useUpdateReminderPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateReminderPreferencesData) => {
      const payload = { ...data, updated_at: new Date().toISOString() };
      const { data: existing } = await supabase
        .from('reminder_preferences')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('reminder_preferences')
          .update(payload)
          .eq('user_id', user!.id);
        if (error) throw new Error(error.message);
      } else {
        // Create defaults first, then apply update
        const { error } = await supabase.from('reminder_preferences').insert({
          user_id: user!.id,
          eod_review_enabled: true,
          eod_review_time: '21:00',
          meeting_reminder_minutes_before: 10,
          morning_summary_enabled: true,
          morning_summary_time: '08:00',
          birthday_reminder_days_before: 1,
          travel_reminder_days_before: 1,
          renewal_reminder_days_before: 1,
          ...data,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reminderPrefKeys.forUser(user!.id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKeys.forUser(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data as AppUser;
    },
    enabled: !!user,
  });
}

export type UpdateProfileData = Partial<Pick<AppUser, 'name' | 'timezone'>>;

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const { error } = await supabase
        .from('users')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.forUser(user!.id) });
    },
  });
}
