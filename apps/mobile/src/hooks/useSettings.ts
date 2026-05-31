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
// Defaults (mirror web: apps/web/src/components/settings/ReminderSettingsView.tsx)
// ---------------------------------------------------------------------------

const REMINDER_PREF_DEFAULTS = {
  eod_review_enabled: true,
  eod_review_time: '21:00',
  meeting_reminder_minutes_before: 15,
  morning_summary_enabled: true,
  morning_summary_time: '08:00',
  birthday_reminder_days_before: 1,
  travel_reminder_days_before: 1,
  renewal_reminder_days_before: 3,
  activity_starting_enabled: true,
  activity_reminder_minutes_before: 5,
  activity_overdue_enabled: true,
  event_reminder_minutes_before: 15,
  currency_code: 'USD',
} as const;

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
      // Merge defaults so prefs is never null — new users get sensible defaults
      // without needing a DB row first.
      return { ...REMINDER_PREF_DEFAULTS, ...(data ?? {}) } as ReminderPreference;
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
    | 'activity_starting_enabled'
    | 'activity_reminder_minutes_before'
    | 'activity_overdue_enabled'
    | 'event_reminder_minutes_before'
    | 'currency_code'
  >
>;

export function useUpdateReminderPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateReminderPreferencesData) => {
      const { error } = await supabase.from('reminder_preferences').upsert(
        {
          user_id: user!.id,
          ...REMINDER_PREF_DEFAULTS,
          ...data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) throw new Error(error.message);
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
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data as AppUser;
    },
    enabled: !!user,
  });
}

export type UpdateProfileData = Partial<
  Pick<AppUser, 'name' | 'timezone' | 'eod_review_time'>
>;

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.forUser(user!.id) });
    },
  });
}
